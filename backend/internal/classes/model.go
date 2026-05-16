package classes

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Class struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	Name         string    `gorm:"size:100;not null" json:"name"`
	GradeLevelID string    `gorm:"size:36;not null;index" json:"gradeLevelId"`
	TeacherID    string    `gorm:"size:36;index" json:"teacherId"`
	SortOrder    int       `gorm:"default:0" json:"sortOrder"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`

	// Joined fields (not stored, mapped via Raw SQL aliases)
	GradeLevelName string `json:"gradeLevelName,omitempty"`
	TeacherName    string `json:"teacherName,omitempty"`
}

func (c *Class) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, gradeLevelID string) ([]Class, error) {
	var classes []Class
	query := `SELECT c.*, gl.name AS grade_level_name, u.full_name AS teacher_name
		FROM classes c
		LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
		LEFT JOIN users u ON u.id = c.teacher_id`
	args := make([]interface{}, 0)
	if gradeLevelID != "" {
		query += ` WHERE c.grade_level_id = ?`
		args = append(args, gradeLevelID)
	}
	query += ` ORDER BY c.sort_order ASC, c.name ASC`
	err := s.db.WithContext(ctx).Raw(query, args...).Scan(&classes).Error
	return classes, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*Class, error) {
	var class Class
	err := s.db.WithContext(ctx).Raw(
		`SELECT c.*, gl.name AS grade_level_name, u.full_name AS teacher_name
		FROM classes c
		LEFT JOIN grade_levels gl ON gl.id = c.grade_level_id
		LEFT JOIN users u ON u.id = c.teacher_id
		WHERE c.id = ?`, id,
	).Scan(&class).Error
	return &class, err
}

func (s *Service) Create(ctx context.Context, class *Class) error {
	return s.db.WithContext(ctx).Create(class).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&Class{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&Class{}).Error
}
