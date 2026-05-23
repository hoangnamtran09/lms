package progress

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/weaknesses"
	"gorm.io/gorm"
)

type Handler struct {
	service         *Service
	weaknessService *weaknesses.Service
	db              *gorm.DB
}

func NewHandler(service *Service, weaknessSvc *weaknesses.Service, db *gorm.DB) *Handler {
	return &Handler{service: service, weaknessService: weaknessSvc, db: db}
}

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

func (h *Handler) CancelSession(w http.ResponseWriter, r *http.Request) {
	parts := splitPath(r.URL.Path)
	sessionID := ""
	if len(parts) >= 2 {
		sessionID = parts[len(parts)-2]
	}
	if err := h.service.Cancel(r.Context(), sessionID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "cancelled"})
}

func (h *Handler) EndSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	// Path: /api/study-sessions/{id}/end → extract second-to-last segment
	parts := splitPath(r.URL.Path)
	sessionID := ""
	if len(parts) >= 2 {
		sessionID = parts[len(parts)-2]
	}
	session, err := h.service.End(r.Context(), sessionID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Stuck detection: > 30 min on a lesson → record progress weakness
	if session.DurationSeconds > 1800 && session.LessonID != "" && h.weaknessService != nil {
		_ = h.weaknessService.RecordError(r.Context(), claims.UserID, session.LessonID, session.LessonID, "progress", 1)
	}

	jsonOk(w, map[string]string{"status": "ended"})
}

func (h *Handler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	parts := splitPath(r.URL.Path)
	sessionID := ""
	if len(parts) >= 2 {
		sessionID = parts[len(parts)-2]
	}
	var req struct {
		VisiblePages []int `json:"visiblePages"`
	}
	intervalSeconds := 5
	json.NewDecoder(r.Body).Decode(&req)
	if iv := r.URL.Query().Get("interval"); iv != "" {
		if n, err := strconv.Atoi(iv); err == nil && n > 0 {
			intervalSeconds = n
		}
	}

	if err := h.service.Heartbeat(r.Context(), sessionID, req.VisiblePages, intervalSeconds); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "ok"})
}

func (h *Handler) SessionStatus(w http.ResponseWriter, r *http.Request) {
	parts := splitPath(r.URL.Path)
	sessionID := ""
	if len(parts) >= 2 {
		sessionID = parts[len(parts)-2]
	}
	status, err := h.service.GetStatus(r.Context(), sessionID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonOk(w, status)
}

func (h *Handler) ActiveSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	lessonID := r.URL.Query().Get("lessonId")

	var session StudySession
	err := h.db.WithContext(r.Context()).
		Where("user_id = ? AND lesson_id = ? AND ended_at IS NULL", claims.UserID, lessonID).
		Order("started_at DESC").
		First(&session).Error
	if err != nil {
		jsonOk(w, nil)
		return
	}
	// Check if session is stale (no heartbeat for > 30s)
	if session.LastHeartbeatAt != nil && time.Since(*session.LastHeartbeatAt) > 30*time.Second {
		// End the stale session
		now := time.Now()
		session.EndedAt = &now
		session.DurationSeconds = int(now.Sub(session.StartedAt).Seconds())
		h.db.WithContext(r.Context()).Model(&StudySession{}).Where("id = ?", session.ID).Updates(map[string]interface{}{
			"ended_at":         &now,
			"duration_seconds": session.DurationSeconds,
		})
		jsonOk(w, nil)
		return
	}
	jsonOk(w, &session)
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
