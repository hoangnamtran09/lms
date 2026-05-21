package attendance

import (
	"encoding/json"
	"net/http"

	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	classID := r.URL.Query().Get("classId")
	date := r.URL.Query().Get("date")
	if classID == "" || date == "" {
		jsonErr(w, "classId và date là bắt buộc", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims.ClassID != "" && claims.ClassID != classID {
		if claims.Role != "SUPER_ADMIN" && claims.Role != "ADMIN" {
			jsonErr(w, "Không có quyền xem điểm danh của lớp này", http.StatusForbidden)
			return
		}
	}

	list, err := h.service.GetByClassAndDate(r.Context(), classID, date)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []Attendance{}
	}
	jsonOk(w, list)
}

type markRequest struct {
	ClassID string `json:"classId"`
	Date    string `json:"date"`
	Records []Record `json:"records"`
}

func (h *Handler) Mark(w http.ResponseWriter, r *http.Request) {
	var req markRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if req.ClassID == "" || req.Date == "" {
		jsonErr(w, "classId và date là bắt buộc", http.StatusBadRequest)
		return
	}

	if err := h.service.Mark(r.Context(), req.ClassID, req.Date, req.Records); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "ok"})
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
