package subjects

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Subject struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	Name        string    `gorm:"uniqueIndex;size:200;not null" json:"name"`
	Icon        string    `gorm:"size:50;default:BookOpen" json:"icon"`
	Color       string    `gorm:"size:20;default:'#4F46E5'" json:"color"`
	Description string    `gorm:"size:1000" json:"description"`
	GradeLevel  int       `gorm:"not null" json:"gradeLevel"`
	SortOrder   int       `gorm:"default:0" json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Subject) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

func (s *Service) List(ctx context.Context, gradeLevel int) ([]Subject, error) {
	var subjects []Subject
	q := s.db.WithContext(ctx)
	if gradeLevel > 0 {
		q = q.Where("grade_level = ?", gradeLevel)
	}
	err := q.Order("sort_order ASC").Find(&subjects).Error
	return subjects, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*Subject, error) {
	var subject Subject
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&subject).Error
	return &subject, err
}

func (s *Service) Create(ctx context.Context, subject *Subject) error {
	return s.db.WithContext(ctx).Create(subject).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&Subject{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&Subject{}).Error
}
