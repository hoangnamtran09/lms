package notifications

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Notification struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	UserID    string    `gorm:"size:36;not null;index" json:"userId"`
	Title     string    `gorm:"size:255;not null" json:"title"`
	Body      string    `gorm:"type:text" json:"body"`
	Type      string    `gorm:"size:50;not null;default:info" json:"type"`
	Read      bool      `gorm:"not null;default:false" json:"read"`
	Link      string    `gorm:"size:500" json:"link"`
	CreatedAt time.Time `json:"createdAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, userID string, limit, offset int) ([]Notification, int64, error) {
	var total int64
	s.db.WithContext(ctx).Model(&Notification{}).Where("user_id = ?", userID).Count(&total)
	var items []Notification
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error
	return items, total, err
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&Notification{}).Where("user_id = ? AND read = ?", userID, false).Count(&count).Error
	return count, err
}

func (s *Service) MarkRead(ctx context.Context, id, userID string) error {
	return s.db.WithContext(ctx).Model(&Notification{}).Where("id = ? AND user_id = ?", id, userID).Update("read", true).Error
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	return s.db.WithContext(ctx).Model(&Notification{}).Where("user_id = ? AND read = ?", userID, false).Update("read", true).Error
}

func (s *Service) Create(ctx context.Context, n *Notification) error {
	return s.db.WithContext(ctx).Create(n).Error
}
