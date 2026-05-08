package lessons

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Lesson struct {
	ID              string    `gorm:"primaryKey;size:36" json:"id"`
	CourseID        string    `gorm:"size:36;not null;index" json:"courseId"`
	Title           string    `gorm:"size:500;not null" json:"title"`
	Description     string    `gorm:"type:text" json:"description"`
	MediaURL        string    `gorm:"size:1000" json:"mediaUrl"`      // R2 PDF URL
	DurationMinutes int       `json:"durationMinutes"`
	SortOrder       int       `gorm:"default:0" json:"sortOrder"`
	IsPublished     bool      `gorm:"default:false" json:"isPublished"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (l *Lesson) BeforeCreate(tx *gorm.DB) error {
	if l.ID == "" {
		l.ID = uuid.New().String()
	}
	return nil
}

func (s *Service) List(ctx context.Context, courseID string) ([]Lesson, error) {
	var lessons []Lesson
	q := s.db.WithContext(ctx)
	if courseID != "" {
		q = q.Where("course_id = ?", courseID)
	}
	err := q.Order("sort_order ASC").Find(&lessons).Error
	return lessons, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*Lesson, error) {
	var lesson Lesson
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&lesson).Error
	return &lesson, err
}

func (s *Service) Create(ctx context.Context, lesson *Lesson) error {
	return s.db.WithContext(ctx).Create(lesson).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&Lesson{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&Lesson{}).Error
}

type LessonContext struct {
	SubjectName string `json:"subjectName"`
	LessonTitle string `json:"lessonTitle"`
	Description string `json:"description"`
	GradeLevel  int    `json:"gradeLevel"`
}

func (s *Service) GetContext(ctx context.Context, id string) (*LessonContext, error) {
	var ctx_ LessonContext
	err := s.db.WithContext(ctx).
		Table("lessons l").
		Select("s.name AS subject_name, l.title AS lesson_title, l.description, c.grade_level").
		Joins("JOIN courses c ON c.id = l.course_id").
		Joins("JOIN subjects s ON s.id = c.subject_id").
		Where("l.id = ?", id).
		Scan(&ctx_).Error
	if err != nil {
		return nil, err
	}
	return &ctx_, nil
}
