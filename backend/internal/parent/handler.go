package parent

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) Children(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	children, err := h.service.GetChildren(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, children)
}

func (h *Handler) ChildDetail(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	childID := ""
	for i, p := range parts {
		if p == "children" && i+1 < len(parts) {
			childID = parts[i+1]
			break
		}
	}
	if childID == "" {
		jsonErr(w, "Missing child ID", http.StatusBadRequest)
		return
	}
	detail, err := h.service.GetChildDetail(r.Context(), claims.UserID, childID)
	if err != nil {
		jsonErr(w, "Không tìm thấy hoặc không có quyền xem", http.StatusNotFound)
		return
	}
	jsonOk(w, detail)
}

func (h *Handler) LinkChild(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var req struct {
		ChildID string `json:"childId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.LinkChild(r.Context(), claims.UserID, req.ChildID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "linked"})
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
