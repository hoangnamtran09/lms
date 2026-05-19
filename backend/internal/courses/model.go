package courses

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Course struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	SubjectID    string    `gorm:"size:36;not null;index" json:"subjectId"`
	Title        string    `gorm:"size:500;not null" json:"title"`
	Description  string    `gorm:"size:2000" json:"description"`
	GradeLevel   int       `gorm:"not null" json:"gradeLevel"`
	SortOrder    int       `gorm:"default:0" json:"sortOrder"`
	ThumbnailURL string    `gorm:"size:500" json:"thumbnailUrl"`
	IsPublished  bool      `gorm:"default:false" json:"isPublished"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (c *Course) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

func (s *Service) List(ctx context.Context, subjectID string, gradeLevel int, page, limit int) ([]Course, int64, error) {
	var total int64
	q := s.db.WithContext(ctx).Model(&Course{})
	if subjectID != "" {
		q = q.Where("subject_id = ?", subjectID)
	}
	if gradeLevel > 0 {
		q = q.Where("grade_level = ?", gradeLevel)
	}
	q.Count(&total)

	var courses []Course
	err := q.Order("sort_order ASC").Limit(limit).Offset((page-1)*limit).Find(&courses).Error
	return courses, total, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*Course, error) {
	var course Course
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&course).Error
	return &course, err
}

func (s *Service) Create(ctx context.Context, course *Course) error {
	return s.db.WithContext(ctx).Create(course).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&Course{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&Course{}).Error
}
