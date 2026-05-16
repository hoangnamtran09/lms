package gradelevels

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GradeLevel struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Level     int       `gorm:"not null;uniqueIndex" json:"level"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (g *GradeLevel) BeforeCreate(tx *gorm.DB) error {
	if g.ID == "" {
		g.ID = uuid.New().String()
	}
	return nil
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context) ([]GradeLevel, error) {
	var levels []GradeLevel
	err := s.db.WithContext(ctx).Order("level ASC").Find(&levels).Error
	return levels, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*GradeLevel, error) {
	var level GradeLevel
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&level).Error
	return &level, err
}

func (s *Service) Create(ctx context.Context, level *GradeLevel) error {
	return s.db.WithContext(ctx).Create(level).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&GradeLevel{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&GradeLevel{}).Error
}
