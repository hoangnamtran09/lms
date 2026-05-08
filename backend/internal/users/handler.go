package users

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
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
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		jsonError(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.Create(r.Context(), &user); err != nil {
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
	scope := middleware.GetScopeFilter(r.Context())
	if scope == nil || !scope.All {
		jsonError(w, "Forbidden: only SUPER_ADMIN can delete users", http.StatusForbidden)
		return
	}
	id := extractID(r.URL.Path)
	if err := h.service.Delete(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, map[string]string{"status": "deleted"}, http.StatusOK)
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
