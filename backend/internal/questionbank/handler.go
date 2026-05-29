package questionbank

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit < 1 || limit > 200 {
		limit = 50
	}

	filter := ListFilter{
		SubjectID:      q.Get("subjectId"),
		Topic:          q.Get("topic"),
		CognitiveLevel: q.Get("cognitiveLevel"),
		QuestionType:   q.Get("questionType"),
		Search:         q.Get("search"),
		Limit:          limit,
		Offset:         offset,
	}

	items, total, err := h.service.List(r.Context(), filter)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]interface{}{
		"data":  items,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	m, err := h.service.FindByID(r.Context(), extractID(r.URL.Path))
	if err != nil {
		jsonErr(w, "Not found", http.StatusNotFound)
		return
	}
	jsonOk(w, m)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var m QuestionBank
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if m.Question == "" {
		jsonErr(w, "Thieu cau hoi", http.StatusBadRequest)
		return
	}
	claims := middleware.GetClaims(r.Context())
	if claims != nil {
		m.CreatedBy = claims.UserID
	}
	if err := h.service.Create(r.Context(), &m); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

func (h *Handler) BatchCreate(w http.ResponseWriter, r *http.Request) {
	var items []QuestionBank
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if len(items) == 0 {
		jsonErr(w, "Danh sach trong", http.StatusBadRequest)
		return
	}
	claims := middleware.GetClaims(r.Context())
	for i := range items {
		if items[i].Question == "" {
			jsonErr(w, "Thieu cau hoi o vi tri "+strconv.Itoa(i), http.StatusBadRequest)
			return
		}
		if claims != nil {
			items[i].CreatedBy = claims.UserID
		}
	}
	if err := h.service.BatchCreate(r.Context(), items); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": len(items),
	})
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

func (h *Handler) GetTopics(w http.ResponseWriter, r *http.Request) {
	topics, err := h.service.GetTopics(r.Context(), r.URL.Query().Get("subjectId"))
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, topics)
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
