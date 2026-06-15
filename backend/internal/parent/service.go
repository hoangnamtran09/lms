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

		// Get pending assignments count — exclude those already submitted by this child
		var childSupabaseID string
		s.db.WithContext(ctx).Table("users").Where("id = ?", u.ID).Select("supabase_id").Scan(&childSupabaseID)
		var pendingCount int64
		s.db.WithContext(ctx).Table("assignments a").
			Where("a.class_id = ? AND a.status = ? AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND (s.student_id = ? OR s.student_id = ?))", u.ClassID, "ASSIGNED", childSupabaseID, u.ID).
			Count(&pendingCount)

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
		ID              string     `json:"id"`
		AssignmentTitle string     `gorm:"column:title" json:"title"`
		Score           *float64   `json:"score"`
		Status          string     `json:"status"`
		SubmittedAt     time.Time  `json:"submittedAt"`
	}
	var submissions []SubRow
	// Get child's supabase ID
	var childSupabaseID string
	s.db.WithContext(ctx).Table("users").Where("id = ?", childID).Select("supabase_id").Scan(&childSupabaseID)

	s.db.WithContext(ctx).Table("submissions s").
		Select("s.id, a.title, s.score, s.status, s.submitted_at").
		Joins("JOIN assignments a ON a.id = s.assignment_id").
		Where("s.student_id = ? OR s.student_id = ?", childSupabaseID, childID).
		Order("s.submitted_at DESC").Limit(10).Find(&submissions)

	// Get assignments for child's class
	type AssignmentRow struct {
		ID         string     `json:"id"`
		Title      string     `json:"title"`
		MaxScore   int        `json:"maxScore"`
		DueDate    time.Time  `json:"dueDate"`
		Status     string     `json:"status"`
		Score      *float64   `json:"score"`
		SubmittedAt *time.Time `json:"submittedAt,omitempty"`
	}
	// First get all assignments for the class
	type rawAssignment struct {
		ID       string
		Title    string
		MaxScore int
		DueDate  time.Time
		Status   string
	}
	var rawAssignments []rawAssignment
	// Get assignments: class-wide ones + individually assigned ones
	query := s.db.WithContext(ctx).Table("assignments").
		Where("class_id = ? OR student_ids LIKE ?", child.ClassID, "%\""+childSupabaseID+"\"%").
		Order("due_date ASC, created_at DESC").Limit(20).
		Select("id, title, max_score, due_date, status")
	query.Find(&rawAssignments)

	// Get submissions for this child
	type rawSubmission struct {
		AssignmentID string
		Status       string
		Score        *float64
		SubmittedAt  time.Time
	}
	var childSubmissions []rawSubmission
	s.db.WithContext(ctx).Table("submissions").
		Where("student_id = ? OR student_id = ?", childSupabaseID, childID).
		Select("assignment_id, status, score, submitted_at").Find(&childSubmissions)

	subMap := make(map[string]rawSubmission)
	for _, s := range childSubmissions {
		subMap[s.AssignmentID] = s
	}

	var assignments []AssignmentRow
	for _, a := range rawAssignments {
		row := AssignmentRow{ID: a.ID, Title: a.Title, MaxScore: a.MaxScore, DueDate: a.DueDate, Status: a.Status}
		if sub, ok := subMap[a.ID]; ok {
			row.Status = sub.Status
			row.Score = sub.Score
			row.SubmittedAt = &sub.SubmittedAt
		}
		assignments = append(assignments, row)
	}

	return map[string]interface{}{
		"id":           child.ID,
		"fullName":     child.FullName,
		"totalSeconds": totalSec,
		"weaknesses":   weaknesses,
		"submissions":  submissions,
		"assignments":  assignments,
	}, nil
}

func (s *Service) DeleteLinkByID(ctx context.Context, linkID string) error {
	return s.db.WithContext(ctx).Where("id = ?", linkID).Delete(&ChildLink{}).Error
}

func (s *Service) LinkChild(ctx context.Context, parentID, childID string) error {
	link := ChildLink{
		ID:        uuid.New().String(),
		ParentID:  parentID,
		ChildID:   childID,
	}
	return s.db.WithContext(ctx).Create(&link).Error
}

func (s *Service) UnlinkChild(ctx context.Context, parentID, childID string) error {
	return s.db.WithContext(ctx).
		Where("parent_id = ? AND child_id = ?", parentID, childID).
		Delete(&ChildLink{}).Error
}

type LinkWithNames struct {
	ID         string    `json:"id"`
	ParentID   string    `json:"parentId"`
	ParentName string    `json:"parentName"`
	ChildID    string    `json:"childId"`
	ChildName  string    `json:"childName"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (s *Service) ListAllLinks(ctx context.Context) ([]LinkWithNames, error) {
	var links []ChildLink
	if err := s.db.WithContext(ctx).Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return []LinkWithNames{}, nil
	}

	userIDs := make(map[string]bool)
	for _, l := range links {
		userIDs[l.ParentID] = true
		userIDs[l.ChildID] = true
	}
	ids := make([]string, 0, len(userIDs))
	for id := range userIDs {
		ids = append(ids, id)
	}

	type UserRow struct {
		ID       string
		FullName string
	}
	var users []UserRow
	s.db.WithContext(ctx).Table("users").Where("id IN ?", ids).Find(&users)
	nameMap := make(map[string]string, len(users))
	for _, u := range users {
		nameMap[u.ID] = u.FullName
	}

	result := make([]LinkWithNames, len(links))
	for i, l := range links {
		result[i] = LinkWithNames{
			ID:         l.ID,
			ParentID:   l.ParentID,
			ParentName: nameMap[l.ParentID],
			ChildID:    l.ChildID,
			ChildName:  nameMap[l.ChildID],
			CreatedAt:  l.CreatedAt,
		}
	}
	return result, nil
}
