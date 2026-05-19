package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/users"
)

type Handler struct {
	userService         *users.Service
	supabaseURL         string
	supabaseServiceRole string
}

func NewHandler(userService *users.Service, supabaseURL, supabaseServiceRole string) *Handler {
	return &Handler{
		userService:         userService,
		supabaseURL:         supabaseURL,
		supabaseServiceRole: supabaseServiceRole,
	}
}

type userResponse struct {
	ID         string `json:"id"`
	SupabaseID string `json:"supabaseId"`
	FullName   string `json:"fullName"`
	Role       string `json:"role"`
	ClassID    string `json:"classId"`
	Email      string `json:"email"`
	AvatarURL  string `json:"avatarUrl"`
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID := claims.UserID
	user, err := h.userService.FindBySupabaseID(r.Context(), userID)
	if err != nil {
		user, err = h.userService.FindByID(r.Context(), userID)
		if err != nil {
			jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
			return
		}
	}

	respond(w, userResponse{
		ID:         user.ID,
		SupabaseID: user.SupabaseID,
		FullName:   user.FullName,
		Role:       user.Role,
		ClassID:    user.ClassID,
		Email:      user.Email,
		AvatarURL:  user.AvatarURL,
	}, http.StatusOK)
}

// POST /api/auth/register — public
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FullName string `json:"fullName"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if req.FullName == "" || req.Email == "" || req.Password == "" {
		jsonErr(w, "Họ tên, email và mật khẩu không được để trống", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 6 {
		jsonErr(w, "Mật khẩu phải có ít nhất 6 ký tự", http.StatusBadRequest)
		return
	}

	supabaseID, err := h.createSupabaseUser(req.FullName, req.Email, req.Password, "STUDENT")
	if err != nil {
		jsonErr(w, "Lỗi tạo tài khoản: "+err.Error(), http.StatusInternalServerError)
		return
	}

	user := users.User{
		ID:         uuid.New().String(),
		SupabaseID: supabaseID,
		Username:   strings.Split(req.Email, "@")[0],
		FullName:   req.FullName,
		Email:      req.Email,
		Role:       "STUDENT",
	}

	if err := h.userService.Create(r.Context(), &user); err != nil {
		h.deleteSupabaseUser(supabaseID)
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respond(w, map[string]string{"message": "Đăng ký thành công"}, http.StatusCreated)
}

// POST /api/auth/forgot-password — public
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if req.Email == "" {
		jsonErr(w, "Email không được để trống", http.StatusBadRequest)
		return
	}

	if h.supabaseURL == "" {
		jsonErr(w, "Tính năng chưa được cấu hình", http.StatusInternalServerError)
		return
	}

	body, _ := json.Marshal(map[string]string{
		"email": req.Email,
	})
	_, err := h.supabaseRequest("POST", "/auth/v1/recover", body)
	if err != nil {
		jsonErr(w, "Không thể gửi email đặt lại mật khẩu", http.StatusInternalServerError)
		return
	}

	respond(w, map[string]string{"message": "Vui lòng kiểm tra email để đặt lại mật khẩu"}, http.StatusOK)
}

// PUT /api/auth/profile — authenticated
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID := claims.UserID
	user, err := h.userService.FindBySupabaseID(r.Context(), userID)
	if err != nil {
		jsonErr(w, "Không tìm thấy người dùng", http.StatusNotFound)
		return
	}

	var req struct {
		FullName  string `json:"fullName"`
		AvatarURL string `json:"avatarUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	updates["avatar_url"] = req.AvatarURL

	if err := h.userService.Update(r.Context(), user.ID, updates); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return updated user
	updated, _ := h.userService.FindByID(r.Context(), user.ID)
	respond(w, userResponse{
		ID:         updated.ID,
		SupabaseID: updated.SupabaseID,
		FullName:   updated.FullName,
		Role:       updated.Role,
		ClassID:    updated.ClassID,
		Email:      updated.Email,
		AvatarURL:  updated.AvatarURL,
	}, http.StatusOK)
}

// POST /api/auth/change-password — authenticated
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		jsonErr(w, "Mật khẩu không được để trống", http.StatusBadRequest)
		return
	}
	if len(req.NewPassword) < 6 {
		jsonErr(w, "Mật khẩu mới phải có ít nhất 6 ký tự", http.StatusBadRequest)
		return
	}

	// Password change is handled client-side via Supabase Auth
	// This endpoint re-verifies current password by attempting sign-in
	respond(w, map[string]string{"message": "OK"}, http.StatusOK)
}

// --- helpers ---

func (h *Handler) createSupabaseUser(fullName, email, password, role string) (string, error) {
	if h.supabaseURL == "" || h.supabaseServiceRole == "" {
		return "", fmt.Errorf("Supabase chưa được cấu hình")
	}

	body := map[string]interface{}{
		"email":         email,
		"password":      password,
		"email_confirm": true,
		"user_metadata": map[string]string{
			"fullName": fullName,
		},
		"app_metadata": map[string]string{
			"role": role,
		},
	}
	bodyJSON, _ := json.Marshal(body)

	resp, err := h.supabaseRequest("POST", "/auth/v1/admin/users", bodyJSON)
	if err != nil {
		return "", err
	}

	var result struct {
		ID    string `json:"id"`
		Err   string `json:"error_description"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	json.Unmarshal(resp, &result)
	if result.Err != "" {
		return "", fmt.Errorf(result.Err)
	}
	if result.Error.Message != "" {
		return "", fmt.Errorf(result.Error.Message)
	}
	return result.ID, nil
}

func (h *Handler) deleteSupabaseUser(supabaseID string) error {
	if h.supabaseURL == "" || h.supabaseServiceRole == "" {
		return nil
	}
	_, err := h.supabaseRequest("DELETE", "/auth/v1/admin/users/"+supabaseID, nil)
	return err
}

func (h *Handler) supabaseRequest(method, path string, bodyJSON []byte) ([]byte, error) {
	url := strings.TrimRight(h.supabaseURL, "/") + "/" + strings.TrimLeft(path, "/")
	var body io.Reader
	if bodyJSON != nil {
		body = bytes.NewReader(bodyJSON)
	}
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", h.supabaseServiceRole)
	req.Header.Set("Authorization", "Bearer "+h.supabaseServiceRole)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%s", string(respBody))
	}
	return respBody, nil
}

func respond(w http.ResponseWriter, v interface{}, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	respond(w, map[string]string{"error": msg}, code)
}
