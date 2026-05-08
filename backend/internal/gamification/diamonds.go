package gamification

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DiamondTransaction struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	UserID      string    `gorm:"size:36;not null;index" json:"userId"`
	Amount      int       `gorm:"not null" json:"amount"`
	Reason      string    `gorm:"size:100" json:"reason"`
	ReferenceID string    `gorm:"size:36" json:"referenceId"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (t *DiamondTransaction) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return nil
}

type DiamondService struct {
	db *gorm.DB
}

func NewDiamondService(db *gorm.DB) *DiamondService { return &DiamondService{db: db} }

func (s *DiamondService) Balance(ctx context.Context, userID string) (int, error) {
	var sum int
	err := s.db.WithContext(ctx).
		Model(&DiamondTransaction{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&sum).Error
	return sum, err
}

func (s *DiamondService) Add(ctx context.Context, userID string, amount int, reason string, refID string) error {
	return s.db.WithContext(ctx).Create(&DiamondTransaction{
		UserID:      userID,
		Amount:      amount,
		Reason:      reason,
		ReferenceID: refID,
	}).Error
}

func (s *DiamondService) History(ctx context.Context, userID string) ([]DiamondTransaction, error) {
	var txs []DiamondTransaction
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(50).
		Find(&txs).Error
	return txs, err
}
