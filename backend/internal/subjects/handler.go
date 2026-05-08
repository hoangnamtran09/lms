package subjects

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

type Handler struct {
	service      *Service
	db           *gorm.DB
	deleteR2File func(ctx context.Context, url string) error
}

func NewHandler(service *Service, db *gorm.DB) *Handler {
	return &Handler{service: service, db: db}
}

func (h *Handler) SetR2Delete(fn func(ctx context.Context, url string) error) {
	h.deleteR2File = fn
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	grade, _ := strconv.Atoi(r.URL.Query().Get("gradeLevel"))
	subjects, err := h.service.List(r.Context(), grade)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, subjects, http.StatusOK)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	subject, err := h.service.FindByID(r.Context(), id)
	if err != nil {
		jsonError(w, "Not found", http.StatusNotFound)
		return
	}
	jsonRespond(w, subject, http.StatusOK)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var subject Subject
	if err := json.NewDecoder(r.Body).Decode(&subject); err != nil {
		jsonError(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.Create(r.Context(), &subject); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonRespond(w, subject, http.StatusCreated)
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

	// Delete all R2 files for lessons under this subject
	if h.deleteR2File != nil {
		var urls []string
		h.db.Raw(`
			SELECT l.media_url FROM lessons l
			JOIN courses c ON c.id = l.course_id
			WHERE c.subject_id = ? AND l.media_url != ''
		`, id).Scan(&urls)
		for _, u := range urls {
			h.deleteR2File(r.Context(), u)
		}
	}

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
