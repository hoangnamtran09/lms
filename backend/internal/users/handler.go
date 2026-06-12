package users

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service             *Service
	supabaseURL         string
	supabaseServiceRole string
}

func NewHandler(service *Service, supabaseURL, supabaseServiceRole string) *Handler {
	return &Handler{
		service:             service,
		supabaseURL:         supabaseURL,
		supabaseServiceRole: supabaseServiceRole,
	}
}

type createUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
	ClassID  string `json:"classId"`
	DOB      string `json:"dob"`
	Gender   string `json:"gender"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	classID := r.URL.Query().Get("classId")
	users, err := h.service.List(r.Context(), role, classID)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, users, http.StatusOK)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	user, err := h.service.FindBySupabaseID(r.Context(), id)
	if err != nil {
		user, err = h.service.FindByID(r.Context(), id)
		if err != nil {
			jsonError(w, "Not found", http.StatusNotFound)
			return
		}
	}
	jsonRespond(w, user, http.StatusOK)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if req.Username == "" || req.FullName == "" || req.Password == "" {
		jsonError(w, "Tên đăng nhập, mật khẩu và họ tên không được để trống", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "STUDENT"
	}

	// Role-based access control for user creation
	if claims := middleware.GetClaims(r.Context()); claims != nil {
		switch claims.Role {
		case "SUPER_ADMIN", "ADMIN":
			// Full access - can create any role
		case "TEACHER":
			if req.Role != "STUDENT" && req.Role != "PARENT" {
				jsonError(w, "Giáo viên chỉ có thể tạo tài khoản Học sinh hoặc Phụ huynh", http.StatusForbidden)
				return
			}
			if claims.ClassID != "" {
				req.ClassID = claims.ClassID
			}
		default:
			jsonError(w, "Không có quyền tạo tài khoản", http.StatusForbidden)
			return
		}
	}

	if req.Email == "" {
		safe := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '_' || r == '-' {
				return r
			}
			return -1
		}, req.Username)
		req.Email = safe + "@lms.edu.vn"
	}

	// Create in Supabase Auth
	supabaseID, err := h.createSupabaseUser(req)
	if err != nil {
		jsonError(w, "Lỗi tạo tài khoản: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var dob *time.Time
	if req.DOB != "" {
		if parsed, err := time.Parse("2006-01-02", req.DOB); err == nil {
			dob = &parsed
		}
	}

	user := User{
		ID:         uuid.New().String(),
		SupabaseID: supabaseID,
		Username:   req.Username,
		FullName:   req.FullName,
		Email:      req.Email,
		Phone:      req.Phone,
		Role:       req.Role,
		ClassID:    req.ClassID,
		DOB:        dob,
		Gender:     req.Gender,
	}

	if err := h.service.Create(r.Context(), &user); err != nil {
		// Rollback Supabase user
		h.deleteSupabaseUser(supabaseID)
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, user, http.StatusCreated)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// If role is being changed, sync to Supabase app_metadata so proxy.ts sees the correct role
	if role, ok := updates["role"].(string); ok && role != "" {
		user, err := h.service.FindByID(r.Context(), id)
		if err == nil && user.SupabaseID != "" {
			h.updateSupabaseAppMeta(user.SupabaseID, role)
		}
	}

	if err := h.service.Update(r.Context(), id, updates); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, map[string]string{"status": "ok"}, http.StatusOK)
}

type resetPasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	// Path: /api/users/{id}/reset-password → extract user ID from path
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	id := parts[len(parts)-2] // second-to-last segment is the user ID
	user, err := h.service.FindByID(r.Context(), id)
	if err != nil {
		jsonError(w, "Không tìm thấy người dùng", http.StatusNotFound)
		return
	}

	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if len(req.NewPassword) < 6 {
		jsonError(w, "Mật khẩu mới phải có ít nhất 6 ký tự", http.StatusBadRequest)
		return
	}

	if user.SupabaseID == "" {
		jsonError(w, "Tài khoản chưa được đồng bộ với Supabase", http.StatusInternalServerError)
		return
	}

	if err := h.updateSupabasePassword(user.SupabaseID, req.NewPassword); err != nil {
		jsonError(w, "Không thể đổi mật khẩu: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonRespond(w, map[string]string{"status": "ok", "message": "Đã đổi mật khẩu thành công"}, http.StatusOK)
}

func (h *Handler) updateSupabasePassword(supabaseID, password string) error {
	if h.supabaseURL == "" || h.supabaseServiceRole == "" {
		return fmt.Errorf("Supabase chưa được cấu hình")
	}
	body := map[string]interface{}{
		"password": password,
	}
	bodyJSON, _ := json.Marshal(body)
	_, err := h.supabaseRequest("PUT", "/auth/v1/admin/users/"+supabaseID, bodyJSON)
	return err
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	user, err := h.service.FindByID(r.Context(), id)
	if err != nil {
		jsonError(w, "Not found", http.StatusNotFound)
		return
	}

	if user.SupabaseID != "" {
		h.deleteSupabaseUser(user.SupabaseID)
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, map[string]string{"status": "deleted"}, http.StatusOK)
}

func (h *Handler) createSupabaseUser(req createUserRequest) (string, error) {
	if h.supabaseURL == "" || h.supabaseServiceRole == "" {
		return "", fmt.Errorf("Supabase chưa được cấu hình")
	}

	body := map[string]interface{}{
		"email":         req.Email,
		"password":      req.Password,
		"email_confirm": true,
		"user_metadata": map[string]string{
			"fullName": req.FullName,
			"username": req.Username,
		},
		"app_metadata": map[string]string{
			"role": req.Role,
		},
	}
	bodyJSON, _ := json.Marshal(body)

	resp, err := h.supabaseRequest("POST", "/auth/v1/admin/users", bodyJSON)
	if err != nil {
		return "", err
	}

	var result struct {
		ID    string `json:"id"`
		Error string `json:"error_description"`
	}
	json.Unmarshal(resp, &result)
	if result.Error != "" {
		return "", fmt.Errorf(result.Error)
	}
	return result.ID, nil
}

func (h *Handler) updateSupabaseAppMeta(supabaseID, role string) error {
	if h.supabaseURL == "" || h.supabaseServiceRole == "" {
		return fmt.Errorf("Supabase chưa được cấu hình")
	}
	body := map[string]interface{}{
		"app_metadata": map[string]string{
			"role": role,
		},
	}
	bodyJSON, _ := json.Marshal(body)
	_, err := h.supabaseRequest("PUT", "/auth/v1/admin/users/"+supabaseID, bodyJSON)
	return err
}

func (h *Handler) deleteSupabaseUser(supabaseID string) error {
	if h.supabaseURL == "" || h.supabaseServiceRole == "" {
		return nil
	}
	_, err := h.supabaseRequest("DELETE", "/auth/v1/admin/users/"+supabaseID, nil)
	return err
}

func (h *Handler) supabaseRequest(method, path string, bodyJSON []byte) ([]byte, error) {
	url := strings.TrimRight(h.supabaseURL, "/") + path
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

func extractID(path string) string {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	return parts[len(parts)-1]
}

func jsonRespond(w http.ResponseWriter, v interface{}, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	jsonRespond(w, map[string]string{"error": msg}, code)
}
