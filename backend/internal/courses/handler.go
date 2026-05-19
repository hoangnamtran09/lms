package courses

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	grade, _ := strconv.Atoi(r.URL.Query().Get("gradeLevel"))
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	if pageStr == "" && limitStr == "" {
		courses, _, err := h.service.List(r.Context(), r.URL.Query().Get("subjectId"), grade, 1, 10000)
		if err != nil {
			jsonErr(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOk(w, courses)
		return
	}

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	courses, total, err := h.service.List(r.Context(), r.URL.Query().Get("subjectId"), grade, page, limit)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]interface{}{
		"data":  courses,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	c, err := h.service.FindByID(r.Context(), extractID(r.URL.Path))
	if err != nil {
		jsonErr(w, "Not found", http.StatusNotFound)
		return
	}
	jsonOk(w, c)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var c Course
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.Create(r.Context(), &c); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
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
	if err := h.service.Delete(r.Context(), extractID(r.URL.Path)); err != nil {
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
