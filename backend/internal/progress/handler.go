package progress

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) StartSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var req struct {
		LessonID string `json:"lessonId"`
		CourseID string `json:"courseId"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	session := &StudySession{
		ID:       uuid.New().String(),
		UserID:   claims.UserID,
		LessonID: req.LessonID,
		CourseID: req.CourseID,
	}
	if err := h.service.Start(r.Context(), session); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(session)
}

func (h *Handler) EndSession(w http.ResponseWriter, r *http.Request) {
	// Path: /api/study-sessions/{id}/end → extract second-to-last segment
	parts := splitPath(r.URL.Path)
	sessionID := ""
	if len(parts) >= 2 {
		sessionID = parts[len(parts)-2]
	}
	if err := h.service.End(r.Context(), sessionID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "ended"})
}

func (h *Handler) Leaderboard(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "week"
	}
	entries, err := h.service.Leaderboard(r.Context(), period)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if entries == nil {
		entries = []LeaderboardEntry{}
	}
	jsonOk(w, entries)
}

func (h *Handler) UserStats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	stats, err := h.service.UserStats(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, stats)
}

func (h *Handler) WeeklyChart(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	chart, err := h.service.WeeklyChart(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if chart == nil {
		chart = []map[string]interface{}{}
	}
	jsonOk(w, chart)
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

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
