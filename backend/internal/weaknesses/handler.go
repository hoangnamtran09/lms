package weaknesses

import (
	"encoding/json"
	"net/http"

	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	profiles, err := h.service.ListByUser(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, profiles)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	p, err := h.service.FindByID(r.Context(), extractID(r.URL.Path))
	if err != nil {
		jsonErr(w, "Không tìm thấy", http.StatusNotFound)
		return
	}
	jsonOk(w, p)
}

func (h *Handler) RecordError(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var req struct {
		LessonID string `json:"lessonId"`
		Topic    string `json:"topic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if err := h.service.RecordError(r.Context(), claims.UserID, req.LessonID, req.Topic); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "recorded"})
}

func (h *Handler) Improve(w http.ResponseWriter, r *http.Request) {
	// Path: /api/weaknesses/{id}/improve
	parts := splitPath(r.URL.Path)
	id := ""
	if len(parts) >= 2 {
		id = parts[len(parts)-2]
	}
	if err := h.service.MarkImproved(r.Context(), id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Reload to get current state
	p, _ := h.service.FindByID(r.Context(), id)
	jsonOk(w, p)
}

func (h *Handler) Resolve(w http.ResponseWriter, r *http.Request) {
	// Path: /api/weaknesses/{id}/resolve
	parts := splitPath(r.URL.Path)
	id := ""
	if len(parts) >= 2 {
		id = parts[len(parts)-2]
	}
	if err := h.service.Resolve(r.Context(), id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "resolved"})
}

func (h *Handler) UpdateCoachNotes(w http.ResponseWriter, r *http.Request) {
	weaknessID := extractID(r.URL.Path)
	var req struct {
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if err := h.service.UpdateCoachNotes(r.Context(), weaknessID, req.Notes); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "updated"})
}

func splitPath(path string) []string {
	parts := make([]string, 0)
	current := ""
	for _, c := range path {
		if c == '/' {
			if current != "" {
				parts = append(parts, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

func extractID(path string) string {
	parts := make([]string, 0)
	current := ""
	for _, c := range path {
		if c == '/' {
			if current != "" {
				parts = append(parts, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return ""
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
