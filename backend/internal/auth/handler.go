package auth

import (
	"encoding/json"
	"net/http"

	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/users"
)

type Handler struct {
	userService *users.Service
}

func NewHandler(userService *users.Service) *Handler {
	return &Handler{userService: userService}
}

type userResponse struct {
	ID         string `json:"id"`
	SupabaseID string `json:"supabaseId"`
	FullName   string `json:"fullName"`
	Role       string `json:"role"`
	ClassID    string `json:"classId"`
	Email      string `json:"email"`
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Look up by supabase_id (from JWT sub) first, fall back to legacy uid
	userID := claims.UserID
	user, err := h.userService.FindBySupabaseID(r.Context(), userID)
	if err != nil {
		// Fallback: try legacy ID lookup
		user, err = h.userService.FindByID(r.Context(), userID)
		if err != nil {
			jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userResponse{
		ID:         user.ID,
		SupabaseID: user.SupabaseID,
		FullName:   user.FullName,
		Role:       user.Role,
		ClassID:    user.ClassID,
		Email:      user.Email,
	})
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
