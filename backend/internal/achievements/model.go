package achievements

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Achievement struct {
	ID            string    `gorm:"primaryKey;size:36" json:"id"`
	Title         string    `gorm:"size:500;not null" json:"title"`
	Description   string    `gorm:"size:2000" json:"description"`
	Icon          string    `gorm:"size:50;default:Trophy" json:"icon"`
	RuleType      string    `gorm:"size:50;not null" json:"ruleType"`
	Threshold     int       `gorm:"not null" json:"threshold"`
	DiamondReward int       `gorm:"default:0" json:"diamondReward"`
	IsActive      bool      `gorm:"default:true" json:"isActive"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) List(ctx context.Context) ([]Achievement, error) {
	var achievements []Achievement
	err := s.db.WithContext(ctx).Find(&achievements).Error
	return achievements, err
}

func (s *Service) Create(ctx context.Context, a *Achievement) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *Service) Update(ctx context.Context, id string, a *Achievement) error {
	return s.db.WithContext(ctx).Model(&Achievement{}).Where("id = ?", id).Updates(a).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&Achievement{}).Error
}
