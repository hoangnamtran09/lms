package achievements

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
	"gorm.io/gorm"
)

type UserAchievement struct {
	ID            string     `gorm:"primaryKey;size:36" json:"id"`
	UserID        string     `gorm:"size:36;not null;index" json:"userId"`
	AchievementID string     `gorm:"size:36;not null" json:"achievementId"`
	EarnedAt      time.Time  `json:"earnedAt"`
}

type Handler struct {
	service *Service
	db      *gorm.DB
}

func NewHandler(service *Service, db *gorm.DB) *Handler {
	return &Handler{service: service, db: db}
}

// --- Achievements CRUD ---

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.List(r.Context())
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []Achievement{}
	}
	jsonOk(w, list)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var a Achievement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	a.ID = uuid.New().String()
	if err := h.service.Create(r.Context(), &a); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(a)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var a Achievement
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.service.Update(r.Context(), extractID(r.URL.Path), &a); err != nil {
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

// --- User Achievements ---

func (h *Handler) MyAchievements(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var earned []struct {
		UserAchievement
		Title       string `json:"title"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	h.db.WithContext(r.Context()).
		Table("user_achievements").
		Joins("JOIN achievements ON achievements.id = user_achievements.achievement_id").
		Where("user_achievements.user_id = ?", claims.UserID).
		Select("user_achievements.*, achievements.title, achievements.description, achievements.icon").
		Find(&earned)

	if earned == nil {
		earned = []struct {
			UserAchievement
			Title       string `json:"title"`
			Description string `json:"description"`
			Icon        string `json:"icon"`
		}{}
	}
	jsonOk(w, earned)
}

func (h *Handler) AwardAchievement(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID        string `json:"userId"`
		AchievementID string `json:"achievementId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	ua := UserAchievement{
		ID:            uuid.New().String(),
		UserID:        req.UserID,
		AchievementID: req.AchievementID,
		EarnedAt:      time.Now(),
	}
	if err := h.db.WithContext(r.Context()).Create(&ua).Error; err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, ua)
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
