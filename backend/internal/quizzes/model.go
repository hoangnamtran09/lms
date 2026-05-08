package quizzes

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Quiz struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	LessonID       string    `gorm:"size:36;not null;index" json:"lessonId"`
	Title          string    `gorm:"size:500;not null" json:"title"`
	Questions      string    `gorm:"type:jsonb" json:"questions"`
	IsAIGenerated  bool      `gorm:"default:false" json:"isAiGenerated"`
	PassingScore   int       `gorm:"default:70" json:"passingScore"`
	CreatedAt      time.Time `json:"createdAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) ListByLesson(ctx context.Context, lessonID string) ([]Quiz, error) {
	var quizzes []Quiz
	err := s.db.WithContext(ctx).Where("lesson_id = ?", lessonID).Find(&quizzes).Error
	return quizzes, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*Quiz, error) {
	var q Quiz
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&q).Error
	return &q, err
}

func (s *Service) Create(ctx context.Context, quiz *Quiz) error {
	return s.db.WithContext(ctx).Create(quiz).Error
}
