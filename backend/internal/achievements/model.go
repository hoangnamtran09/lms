package achievements

import (
	"context"
	"time"

	"github.com/google/uuid"
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

// Evaluate checks all active achievements against the user's current stats
// and awards any that are newly earned. Returns the list of newly awarded achievement IDs.
func (s *Service) Evaluate(ctx context.Context, userID string) ([]string, error) {
	// Load all active achievements
	var all []Achievement
	if err := s.db.WithContext(ctx).Where("is_active = ?", true).Find(&all).Error; err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return nil, nil
	}

	// Load user's current stats
	stats, err := s.loadUserStats(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Load already earned achievement IDs
	var earnedIDs []string
	s.db.WithContext(ctx).Table("user_achievements").
		Where("user_id = ?", userID).
		Pluck("achievement_id", &earnedIDs)
	earnedSet := make(map[string]bool, len(earnedIDs))
	for _, id := range earnedIDs {
		earnedSet[id] = true
	}

	// Check each achievement against stats
	var newlyAwarded []string
	now := time.Now()
	for _, a := range all {
		if earnedSet[a.ID] {
			continue // already earned
		}
		if s.checkRule(&a, stats) {
			ua := struct {
				ID            string    `gorm:"primaryKey;size:36"`
				UserID        string    `gorm:"size:36;not null;index"`
				AchievementID string    `gorm:"size:36;not null"`
				EarnedAt      time.Time `json:"earnedAt"`
			}{
				ID:            uuid.New().String(),
				UserID:        userID,
				AchievementID: a.ID,
				EarnedAt:      now,
			}
			if err := s.db.WithContext(ctx).Create(&ua).Error; err != nil {
				continue // skip on duplicate
			}
			newlyAwarded = append(newlyAwarded, a.ID)
		}
	}
	return newlyAwarded, nil
}

type userStats struct {
	currentStreak  int
	lessonsDone    int64
	quizzesPassed  int64
	assignmentsDone int64
	diamondsEarned int64
}

func (s *Service) loadUserStats(ctx context.Context, userID string) (*userStats, error) {
	stats := &userStats{}

	// Streak
	var streak struct{ CurrentStreak int }
	s.db.WithContext(ctx).Table("streaks").Where("user_id = ?", userID).Select("current_streak").Scan(&streak)
	stats.currentStreak = streak.CurrentStreak

	// Lessons completed (via progress.StudySession counting distinct days or sessions)
	s.db.WithContext(ctx).Table("study_sessions").Where("user_id = ?", userID).Count(&stats.lessonsDone)

	// Quizzes passed (quiz_results where passed = true)
	s.db.WithContext(ctx).Table("quiz_results").Where("user_id = ? AND passed = ?", userID, true).Count(&stats.quizzesPassed)

	// Assignments done (submissions)
	s.db.WithContext(ctx).Table("submissions").Where("student_id = ?", userID).Count(&stats.assignmentsDone)

	// Diamonds earned (sum of diamond_transaction amounts)
	var totalDiamonds struct{ Total int64 }
	s.db.WithContext(ctx).Table("diamond_transactions").
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0) as total").Scan(&totalDiamonds)
	stats.diamondsEarned = totalDiamonds.Total

	return stats, nil
}

func (s *Service) checkRule(a *Achievement, stats *userStats) bool {
	switch a.RuleType {
	case "study_streak":
		return stats.currentStreak >= a.Threshold
	case "lessons_completed":
		return int(stats.lessonsDone) >= a.Threshold
	case "quizzes_passed":
		return int(stats.quizzesPassed) >= a.Threshold
	case "assignments_done":
		return int(stats.assignmentsDone) >= a.Threshold
	case "diamonds_earned":
		return int(stats.diamondsEarned) >= a.Threshold
	}
	return false
}