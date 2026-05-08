package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
	"gorm.io/gorm"
)

type ChatMessageRecord struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	UserID    string    `gorm:"size:36;not null;index" json:"userId"`
	LessonID  string    `gorm:"size:36;not null;index" json:"lessonId"`
	Role      string    `gorm:"size:20;not null" json:"role"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

func (r *ChatMessageRecord) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

type ChatHistoryService struct {
	db *gorm.DB
}

func NewChatHistoryService(db *gorm.DB) *ChatHistoryService {
	return &ChatHistoryService{db: db}
}

type ChatHistoryHandler struct {
	service *ChatHistoryService
}

func NewChatHistoryHandler(svc *ChatHistoryService) *ChatHistoryHandler {
	return &ChatHistoryHandler{service: svc}
}

func (s *ChatHistoryService) SaveBatch(ctx context.Context, records []ChatMessageRecord) error {
	if len(records) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Create(&records).Error
}

func (s *ChatHistoryService) ListByLesson(ctx context.Context, userID, lessonID string) ([]ChatMessageRecord, error) {
	var records []ChatMessageRecord
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND lesson_id = ?", userID, lessonID).
		Order("created_at ASC").
		Limit(200).
		Find(&records).Error
	if records == nil {
		records = []ChatMessageRecord{}
	}
	return records, err
}

// ClearHistory xoá lịch sử chat của một bài học
func (s *ChatHistoryService) ClearHistory(ctx context.Context, userID, lessonID string) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND lesson_id = ?", userID, lessonID).
		Delete(&ChatMessageRecord{}).Error
}

// ---- Handler ----

type saveChatInput struct {
	LessonID string              `json:"lessonId"`
	Messages []chatMessageInput_ `json:"messages"`
}

type chatMessageInput_ struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (h *ChatHistoryHandler) Save(w http.ResponseWriter, r *http.Request) {
	var req saveChatInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := middleware.GetClaims(r.Context()).UserID

	records := make([]ChatMessageRecord, len(req.Messages))
	for i, m := range req.Messages {
		records[i] = ChatMessageRecord{
			UserID:   userID,
			LessonID: req.LessonID,
			Role:     m.Role,
			Content:  m.Content,
		}
	}

	if err := h.service.SaveBatch(r.Context(), records); err != nil {
		jsonErr(w, "Lỗi lưu lịch sử: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"status": "saved"})
}

func (h *ChatHistoryHandler) Load(w http.ResponseWriter, r *http.Request) {
	lessonID := r.URL.Query().Get("lessonId")
	if lessonID == "" {
		jsonErr(w, "lessonId is required", http.StatusBadRequest)
		return
	}

	userID := middleware.GetClaims(r.Context()).UserID

	records, err := h.service.ListByLesson(r.Context(), userID, lessonID)
	if err != nil {
		jsonErr(w, "Lỗi tải lịch sử: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]interface{}{"messages": records})
}

type clearChatInput struct {
	LessonID string `json:"lessonId"`
}

func (h *ChatHistoryHandler) Clear(w http.ResponseWriter, r *http.Request) {
	var req clearChatInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	userID := middleware.GetClaims(r.Context()).UserID

	if err := h.service.ClearHistory(r.Context(), userID, req.LessonID); err != nil {
		jsonErr(w, "Lỗi xoá lịch sử: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"status": "cleared"})
}
