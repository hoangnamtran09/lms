package auth

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lms/backend/internal/users"
)

type Handler struct {
	authService *Service
	userService *users.Service
}

func NewHandler(authService *Service, userService *users.Service) *Handler {
	return &Handler{authService: authService, userService: userService}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

type userResponse struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Role     string `json:"role"`
	ClassID  string `json:"classId"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErrRespond(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.userService.FindByUsername(r.Context(), req.Username)
	if err != nil {
		jsonErrRespond(w, "Sai tên đăng nhập hoặc mật khẩu", http.StatusUnauthorized)
		return
	}

	if !h.authService.CheckPassword(req.Password, user.PasswordHash) {
		jsonErrRespond(w, "Sai tên đăng nhập hoặc mật khẩu", http.StatusUnauthorized)
		return
	}

	token, err := h.authService.GenerateToken(user.ID, user.Role, user.ClassID, user.FullName)
	if err != nil {
		jsonErrRespond(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   8 * 60 * 60,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResponse{
		Token: token,
		User: userResponse{
			ID:       user.ID,
			FullName: user.FullName,
			Role:     user.Role,
			ClassID:  user.ClassID,
		},
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	tokenStr := extractToken(r)
	if tokenStr == "" {
		jsonErrRespond(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	claims, err := h.authService.ParseToken(tokenStr)
	if err != nil {
		jsonErrRespond(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.userService.FindByID(r.Context(), claims.UserID)
	if err != nil {
		jsonErrRespond(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userResponse{
		ID:       user.ID,
		FullName: user.FullName,
		Role:     user.Role,
		ClassID:  user.ClassID,
	})
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

func jsonErrRespond(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
