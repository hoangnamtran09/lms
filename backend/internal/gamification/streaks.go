package gamification

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Streak struct {
	ID            string     `gorm:"primaryKey;size:36" json:"id"`
	UserID        string     `gorm:"uniqueIndex;size:36;not null" json:"userId"`
	CurrentStreak int        `gorm:"default:0" json:"currentStreak"`
	LongestStreak int        `gorm:"default:0" json:"longestStreak"`
	LastStudyDate *time.Time `json:"lastStudyDate"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type StreakService struct {
	db *gorm.DB
}

func NewStreakService(db *gorm.DB) *StreakService { return &StreakService{db: db} }

func (s *StreakService) Get(ctx context.Context, userID string) (*Streak, error) {
	var streak Streak
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&streak).Error
	if err != nil {
		streak = Streak{UserID: userID, CurrentStreak: 0, LongestStreak: 0}
	}
	return &streak, nil
}

func (s *StreakService) RecordStudy(ctx context.Context, userID string) error {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var streak Streak
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&streak).Error
	if err != nil {
		streak = Streak{UserID: userID, CurrentStreak: 1, LongestStreak: 1, LastStudyDate: &today}
		return s.db.WithContext(ctx).Create(&streak).Error
	}

	if streak.LastStudyDate != nil {
		lastDate := *streak.LastStudyDate
		lastDay := time.Date(lastDate.Year(), lastDate.Month(), lastDate.Day(), 0, 0, 0, 0, lastDate.Location())
		diff := today.Sub(lastDay).Hours() / 24

		if diff < 1 {
			// Already studied today
			return nil
		} else if diff <= 1 {
			streak.CurrentStreak++
		} else {
			streak.CurrentStreak = 1
		}
	} else {
		streak.CurrentStreak = 1
	}

	if streak.CurrentStreak > streak.LongestStreak {
		streak.LongestStreak = streak.CurrentStreak
	}
	streak.LastStudyDate = &today
	streak.UpdatedAt = now

	return s.db.WithContext(ctx).Save(&streak).Error
}
