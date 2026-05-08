package parent

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChildLink struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	ParentID  string    `gorm:"size:36;not null;index" json:"parentId"`
	ChildID   string    `gorm:"size:36;not null;index" json:"childId"`
	CreatedAt time.Time `json:"createdAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) GetChildren(ctx context.Context, parentID string) ([]map[string]interface{}, error) {
	var links []ChildLink
	if err := s.db.WithContext(ctx).Where("parent_id = ?", parentID).Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return []map[string]interface{}{}, nil
	}

	childIDs := make([]string, len(links))
	for i, l := range links {
		childIDs[i] = l.ChildID
	}

	type UserRow struct {
		ID       string `json:"id"`
		FullName string `json:"fullName"`
		ClassID  string `json:"classId"`
	}
	var users []UserRow
	s.db.WithContext(ctx).Table("users").Where("id IN ?", childIDs).Find(&users)

	result := make([]map[string]interface{}, len(users))
	for i, u := range users {
		// Get study stats for this child
		var todaySec, weekSec int
		s.db.WithContext(ctx).Table("study_sessions").
			Where("user_id = ? AND started_at >= ?", u.ID, time.Now().Truncate(24*time.Hour)).
			Select("COALESCE(SUM(duration_seconds), 0)").Scan(&todaySec)
		s.db.WithContext(ctx).Table("study_sessions").
			Where("user_id = ? AND started_at >= ?", u.ID, time.Now().AddDate(0, 0, -7)).
			Select("COALESCE(SUM(duration_seconds), 0)").Scan(&weekSec)

		// Get pending assignments count
		var pendingCount int64
		s.db.WithContext(ctx).Table("assignments").
			Where("class_id = ? AND status = ?", u.ClassID, "ASSIGNED").Count(&pendingCount)

		// Get streak
		var currentStreak int
		s.db.WithContext(ctx).Table("streaks").
			Where("user_id = ?", u.ID).Select("current_streak").Scan(&currentStreak)

		result[i] = map[string]interface{}{
			"id":             u.ID,
			"fullName":       u.FullName,
			"classId":        u.ClassID,
			"todaySeconds":   todaySec,
			"weekSeconds":    weekSec,
			"pendingTasks":   pendingCount,
			"currentStreak":  currentStreak,
		}
	}
	return result, nil
}

func (s *Service) GetChildDetail(ctx context.Context, parentID, childID string) (map[string]interface{}, error) {
	// Verify parent-child link
	var link ChildLink
	if err := s.db.WithContext(ctx).Where("parent_id = ? AND child_id = ?", parentID, childID).First(&link).Error; err != nil {
		return nil, err
	}

	type UserRow struct {
		ID       string `json:"id"`
		FullName string `json:"fullName"`
		ClassID  string `json:"classId"`
	}
	var child UserRow
	s.db.WithContext(ctx).Table("users").Where("id = ?", childID).First(&child)

	// Stats
	var totalSec int
	s.db.WithContext(ctx).Table("study_sessions").
		Where("user_id = ?", childID).Select("COALESCE(SUM(duration_seconds), 0)").Scan(&totalSec)

	// Weaknesses
	type WeakRow struct {
		Topic      string `json:"topic"`
		ErrorCount int    `json:"errorCount"`
	}
	var weaknesses []WeakRow
	s.db.WithContext(ctx).Table("weakness_profiles").
		Where("user_id = ?", childID).Order("error_count DESC").Limit(5).Find(&weaknesses)

	// Recent submissions
	type SubRow struct {
		ID         string     `json:"id"`
		AssignmentTitle string `json:"title"`
		Score      *int       `json:"score"`
		Status     string     `json:"status"`
		SubmittedAt time.Time `json:"submittedAt"`
	}
	var submissions []SubRow
	s.db.WithContext(ctx).Table("submissions s").
		Select("s.id, a.title, s.score, s.status, s.submitted_at").
		Joins("JOIN assignments a ON a.id = s.assignment_id").
		Where("s.student_id = ?", childID).
		Order("s.submitted_at DESC").Limit(10).Find(&submissions)

	return map[string]interface{}{
		"id":           child.ID,
		"fullName":     child.FullName,
		"totalSeconds": totalSec,
		"weaknesses":   weaknesses,
		"submissions":  submissions,
	}, nil
}

func (s *Service) LinkChild(ctx context.Context, parentID, childID string) error {
	link := ChildLink{
		ID:        uuid.New().String(),
		ParentID:  parentID,
		ChildID:   childID,
	}
	return s.db.WithContext(ctx).Create(&link).Error
}
