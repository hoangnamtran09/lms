package lessons

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service      *Service
	deleteR2File func(ctx context.Context, url string) error
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) SetR2Delete(fn func(ctx context.Context, url string) error) {
	h.deleteR2File = fn
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	lessons, err := h.service.List(r.Context(), r.URL.Query().Get("courseId"))
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, lessons)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	l, err := h.service.FindByID(r.Context(), extractID(r.URL.Path))
	if err != nil {
		jsonErr(w, "Not found", http.StatusNotFound)
		return
	}
	jsonOk(w, l)
}

func (h *Handler) Context(w http.ResponseWriter, r *http.Request) {
	ctx, err := h.service.GetContext(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		jsonErr(w, "Not found", http.StatusNotFound)
		return
	}
	jsonOk(w, ctx)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var l Lesson
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.Create(r.Context(), &l); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(l)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var u map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.Update(r.Context(), extractID(r.URL.Path), u); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "ok"})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)

	// Delete R2 file if exists
	if h.deleteR2File != nil {
		lesson, _ := h.service.FindByID(r.Context(), id)
		if lesson != nil && lesson.MediaURL != "" {
			h.deleteR2File(r.Context(), lesson.MediaURL)
		}
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "deleted"})
}

func extractID(path string) string {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	return parts[len(parts)-1]
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
