package users

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
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
	Role     string `json:"role"`
	ClassID  string `json:"classId"`
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
	user, err := h.service.FindByID(r.Context(), id)
	if err != nil {
		jsonError(w, "Not found", http.StatusNotFound)
		return
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
	if req.Email == "" {
		req.Email = req.Username + "@lms.internal"
	}

	// Create in Supabase Auth
	supabaseID, err := h.createSupabaseUser(req)
	if err != nil {
		jsonError(w, "Lỗi tạo tài khoản: "+err.Error(), http.StatusInternalServerError)
		return
	}

	user := User{
		ID:         uuid.New().String(),
		SupabaseID: supabaseID,
		Username:   req.Username,
		FullName:   req.FullName,
		Email:      req.Email,
		Role:       req.Role,
		ClassID:    req.ClassID,
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
	if err := h.service.Update(r.Context(), id, updates); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, map[string]string{"status": "ok"}, http.StatusOK)
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
