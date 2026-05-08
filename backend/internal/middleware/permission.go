package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/lms/backend/internal/permissions"
)

func RequirePermission(resource permissions.Resource, action permissions.Action) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r.Context())
			if claims == nil {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			if !permissions.HasPermission(permissions.Role(claims.Role), resource, action) {
				jsonErr(w, "Forbidden", http.StatusForbidden)
				return
			}

			scope := permissions.BuildScopeFilter(permissions.Role(claims.Role), claims.UserID, claims.ClassID)
			ctx := context.WithValue(r.Context(), contextKey("scope"), scope)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetScopeFilter(ctx context.Context) *permissions.ScopeFilter {
	s, _ := ctx.Value(contextKey("scope")).(*permissions.ScopeFilter)
	if s == nil {
		return &permissions.ScopeFilter{All: true}
	}
	return s
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
