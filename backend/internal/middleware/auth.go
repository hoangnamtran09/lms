package middleware

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type contextKey string

const ClaimsKey contextKey = "claims"

type Claims struct {
	jwt.RegisteredClaims
	UserID   string `json:"uid"`
	Role     string `json:"role"`
	ClassID  string `json:"cid,omitempty"`
	UserName string `json:"name"`
}

func Auth(jwtSecret, supabaseURL string, db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr == "" {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			claims, err := parseJWT(tokenStr, jwtSecret, supabaseURL)
			if err != nil {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			// Enrich claims with local DB user data (Role + ClassID)
			if db != nil {
				var localUser struct {
					ClassID string
					Role    string
				}
				db.Table("users").Where("supabase_id = ?", claims.UserID).Select("class_id, role").Scan(&localUser)
				claims.ClassID = localUser.ClassID
				if localUser.Role != "" {
					claims.Role = localUser.Role
				}
			}

			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// JWKS cache
type jwksEntry struct {
	keys   map[string]*ecdsa.PublicKey
	expiry time.Time
}

var (
	jwksCache sync.Map
	jwksMu    sync.Mutex
)

func parseJWT(tokenStr, jwtSecret, supabaseURL string) (*Claims, error) {
	// Peek at the JWT header to determine the signing algorithm
	alg := peekAlg(tokenStr)

	if alg == "ES256" {
		return parseES256(tokenStr, supabaseURL)
	}

	// Fallback: try legacy HS256 with Claims struct
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err == nil && token.Valid && claims.UserID != "" {
		return claims, nil
	}

	// Try Supabase HS256 format with MapClaims
	mapClaims := jwt.MapClaims{}
	token2, err2 := jwt.ParseWithClaims(tokenStr, mapClaims, func(t *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err2 == nil && token2.Valid {
		return extractSupabaseClaims(mapClaims)
	}

	// Final fallback: ES256 via JWKS
	if supabaseURL != "" {
		if claims, err := parseES256(tokenStr, supabaseURL); err == nil {
			return claims, nil
		}
	}

	return nil, err2
}

func peekAlg(tokenStr string) string {
	parser := jwt.Parser{}
	unverified, _, err := parser.ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		return ""
	}
	alg, _ := unverified.Header["alg"].(string)
	return alg
}

func fetchJWKS(supabaseURL string) (map[string]*ecdsa.PublicKey, error) {
	// Check cache
	if cached, ok := jwksCache.Load(supabaseURL); ok {
		entry := cached.(jwksEntry)
		if time.Now().Before(entry.expiry) {
			return entry.keys, nil
		}
	}

	// Thundering-herd protection
	jwksMu.Lock()
	defer jwksMu.Unlock()

	if cached, ok := jwksCache.Load(supabaseURL); ok {
		entry := cached.(jwksEntry)
		if time.Now().Before(entry.expiry) {
			return entry.keys, nil
		}
	}

	jwksURL := strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(jwksURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var jwks struct {
		Keys []struct {
			KID string `json:"kid"`
			KTY string `json:"kty"`
			CRV string `json:"crv"`
			X   string `json:"x"`
			Y   string `json:"y"`
			ALG string `json:"alg"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, err
	}

	keys := make(map[string]*ecdsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.KTY != "EC" {
			continue
		}
		xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil {
			continue
		}
		yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
		if err != nil {
			continue
		}
		keys[k.KID] = &ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}
	}

	jwksCache.Store(supabaseURL, jwksEntry{keys: keys, expiry: time.Now().Add(1 * time.Hour)})
	return keys, nil
}

func parseES256(tokenStr, supabaseURL string) (*Claims, error) {
	if supabaseURL == "" {
		return nil, fmt.Errorf("supabase URL not configured")
	}

	keys, err := fetchJWKS(supabaseURL)
	if err != nil {
		return nil, err
	}

	// Get kid from token header
	kid := extractKID(tokenStr)

	pubKey, ok := keys[kid]
	if !ok {
		return nil, fmt.Errorf("no matching JWK for kid: %s", kid)
	}

	mapClaims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, mapClaims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return pubKey, nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("ES256 verification failed")
	}

	return extractSupabaseClaims(mapClaims)
}

func extractKID(tokenStr string) string {
	parser := jwt.Parser{}
	unverified, _, err := parser.ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		return ""
	}
	kid, _ := unverified.Header["kid"].(string)
	return kid
}

func extractSupabaseClaims(mapClaims jwt.MapClaims) (*Claims, error) {
	userID, _ := mapClaims["sub"].(string)
	if userID == "" {
		return nil, jwt.ErrSignatureInvalid
	}

	role := ""
	if appMeta, ok := mapClaims["app_metadata"]; ok {
		if meta, ok := appMeta.(map[string]interface{}); ok {
			if r, ok := meta["role"]; ok {
				role, _ = r.(string)
			}
		}
	}
	if role == "" {
		role = "STUDENT"
	}

	userName, _ := mapClaims["email"].(string)
	if meta, ok := mapClaims["user_metadata"]; ok {
		if m, ok := meta.(map[string]interface{}); ok {
			if name, ok := m["fullName"]; ok {
				userName, _ = name.(string)
			}
		}
	}

	return &Claims{
		UserID:   userID,
		Role:     role,
		UserName: userName,
	}, nil
}

func extractToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); h != "" {
		if strings.HasPrefix(h, "Bearer ") {
			return strings.TrimPrefix(h, "Bearer ")
		}
		return h
	}
	if c, err := r.Cookie("token"); err == nil {
		return c.Value
	}
	return ""
}

func GetClaims(ctx context.Context) *Claims {
	c, _ := ctx.Value(ClaimsKey).(*Claims)
	return c
}
