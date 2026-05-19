package progress

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type StudySession struct {
	ID              string     `gorm:"primaryKey;size:36" json:"id"`
	UserID          string     `gorm:"size:36;not null;index" json:"userId"`
	LessonID        string     `gorm:"size:36" json:"lessonId"`
	CourseID        string     `gorm:"size:36" json:"courseId"`
	DurationSeconds int        `json:"durationSeconds"`
	StartedAt       time.Time  `json:"startedAt"`
	EndedAt         *time.Time `json:"endedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) Start(ctx context.Context, session *StudySession) error {
	session.StartedAt = time.Now()
	return s.db.WithContext(ctx).Create(session).Error
}

func (s *Service) End(ctx context.Context, sessionID string) (*StudySession, error) {
	now := time.Now()
	var session StudySession
	if err := s.db.WithContext(ctx).Where("id = ?", sessionID).First(&session).Error; err != nil {
		return nil, err
	}
	session.EndedAt = &now
	session.DurationSeconds = int(now.Sub(session.StartedAt).Seconds())
	return &session, s.db.WithContext(ctx).Model(&StudySession{}).Where("id = ?", sessionID).Updates(map[string]interface{}{
		"ended_at":         &now,
		"duration_seconds": session.DurationSeconds,
	}).Error
}

type LeaderboardEntry struct {
	UserID         string `json:"userId"`
	UserName       string `json:"userName"`
	TotalSeconds   int    `json:"totalSeconds"`
	TotalDiamonds  int    `json:"totalDiamonds"`
}

func (s *Service) Leaderboard(ctx context.Context, period string) ([]LeaderboardEntry, error) {
	var entries []LeaderboardEntry
	since := time.Time{}
	switch period {
	case "week":
		since = time.Now().AddDate(0, 0, -7)
	case "month":
		since = time.Now().AddDate(0, -1, 0)
	}

	q := s.db.WithContext(ctx).
		Table("study_sessions ss").
		Select("ss.user_id, u.full_name as user_name, SUM(ss.duration_seconds) as total_seconds, COALESCE(SUM(d.total_diamonds), 0) as total_diamonds").
		Joins("JOIN users u ON u.id = ss.user_id").
		Joins("LEFT JOIN (SELECT user_id, SUM(amount) as total_diamonds FROM diamond_transactions GROUP BY user_id) d ON d.user_id = ss.user_id").
		Group("ss.user_id, u.full_name")
	if !since.IsZero() {
		q = q.Where("ss.started_at >= ?", since)
	}
	if err := q.Order("total_seconds DESC").Limit(20).Find(&entries).Error; err != nil {
		return nil, err
	}
	return entries, nil
}

type UserStats struct {
	TotalStudySeconds int     `json:"totalStudySeconds"`
	TotalSessions     int64   `json:"totalSessions"`
	TodaySeconds      int     `json:"todaySeconds"`
	WeekSeconds       int     `json:"weekSeconds"`
	AvgScore          float64 `json:"avgScore"`
}

func (s *Service) UserStats(ctx context.Context, userID string) (*UserStats, error) {
	today := time.Now().Truncate(24 * time.Hour)
	weekAgo := time.Now().AddDate(0, 0, -7)

	var stats UserStats
	s.db.WithContext(ctx).Model(&StudySession{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(duration_seconds), 0)").
		Scan(&stats.TotalStudySeconds)
	s.db.WithContext(ctx).Model(&StudySession{}).
		Where("user_id = ?", userID).
		Count(&stats.TotalSessions)
	s.db.WithContext(ctx).Model(&StudySession{}).
		Where("user_id = ? AND started_at >= ?", userID, today).
		Select("COALESCE(SUM(duration_seconds), 0)").
		Scan(&stats.TodaySeconds)
	s.db.WithContext(ctx).Model(&StudySession{}).
		Where("user_id = ? AND started_at >= ?", userID, weekAgo).
		Select("COALESCE(SUM(duration_seconds), 0)").
		Scan(&stats.WeekSeconds)

	// Average score from graded submissions
	s.db.WithContext(ctx).Table("submissions").
		Where("student_id = ? AND score IS NOT NULL", userID).
		Select("COALESCE(AVG(score), 0)").
		Scan(&stats.AvgScore)

	return &stats, nil
}

func (s *Service) WeeklyChart(ctx context.Context, userID string) ([]map[string]interface{}, error) {
	var rows []struct {
		Date    string `json:"date"`
		Seconds int    `json:"seconds"`
	}
	s.db.WithContext(ctx).Model(&StudySession{}).
		Where("user_id = ? AND started_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Select("DATE(started_at) as date, SUM(duration_seconds) as seconds").
		Group("DATE(started_at)").
		Order("date ASC").
		Find(&rows)

	result := make([]map[string]interface{}, len(rows))
	for i, r := range rows {
		result[i] = map[string]interface{}{
			"date":    r.Date,
			"seconds": r.Seconds,
		}
	}
	return result, nil
}
