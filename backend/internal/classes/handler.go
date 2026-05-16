package classes

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	classes, err := h.service.List(r.Context(), r.URL.Query().Get("gradeLevelId"))
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, classes, http.StatusOK)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	class, err := h.service.FindByID(r.Context(), id)
	if err != nil {
		jsonError(w, "Không tìm thấy lớp học", http.StatusNotFound)
		return
	}
	jsonRespond(w, class, http.StatusOK)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var class Class
	if err := json.NewDecoder(r.Body).Decode(&class); err != nil {
		jsonError(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if class.Name == "" {
		jsonError(w, "Tên lớp không được để trống", http.StatusBadRequest)
		return
	}
	if class.GradeLevelID == "" {
		jsonError(w, "Khối lớp không được để trống", http.StatusBadRequest)
		return
	}
	if err := h.service.Create(r.Context(), &class); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, class, http.StatusCreated)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		jsonError(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
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
