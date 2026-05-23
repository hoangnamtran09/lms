package progress

import (
	"context"
	"time"

	"gorm.io/gorm"
)

const (
	MinTotalTime = 60 // seconds
	MinPages     = 3
	MinPageTime  = 10 // seconds per page
)

type StudySession struct {
	ID              string     `gorm:"primaryKey;size:36" json:"id"`
	UserID          string     `gorm:"size:36;not null;index" json:"userId"`
	LessonID        string     `gorm:"size:36" json:"lessonId"`
	CourseID        string     `gorm:"size:36" json:"courseId"`
	DurationSeconds int        `json:"durationSeconds"`
	StartedAt       time.Time  `json:"startedAt"`
	EndedAt         *time.Time `json:"endedAt"`
	LastHeartbeatAt *time.Time `gorm:"column:last_heartbeat_at" json:"-"`
}

// SessionPageTrack tracks cumulative time per page within a session.
type SessionPageTrack struct {
	SessionID  string `gorm:"primaryKey;size:36" json:"sessionId"`
	PageNumber int    `gorm:"primaryKey" json:"pageNumber"`
	Seconds    int    `json:"seconds"`
}

type SessionStatus struct {
	ElapsedSeconds int   `json:"elapsedSeconds"`
	QualifiedPages []int `json:"qualifiedPages"`
	ChatUnlocked   bool  `json:"chatUnlocked"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&StudySession{}, &SessionPageTrack{})
}

func (s *Service) Start(ctx context.Context, session *StudySession) error {
	session.StartedAt = time.Now()
	now := time.Now()
	session.LastHeartbeatAt = &now
	return s.db.WithContext(ctx).Create(session).Error
}

func (s *Service) Cancel(ctx context.Context, sessionID string) error {
	s.db.WithContext(ctx).Delete(&SessionPageTrack{}, "session_id = ?", sessionID)
	return s.db.WithContext(ctx).Delete(&StudySession{}, "id = ?", sessionID).Error
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

// Heartbeat records visible pages for a session and tracks cumulative page time.
// intervalSeconds is the approximate time since the last heartbeat.
func (s *Service) Heartbeat(ctx context.Context, sessionID string, visiblePages []int, intervalSeconds int) error {
	if intervalSeconds <= 0 {
		intervalSeconds = 5
	}
	now := time.Now()

	// Update last heartbeat time
	if err := s.db.WithContext(ctx).Model(&StudySession{}).
		Where("id = ?", sessionID).
		Update("last_heartbeat_at", &now).Error; err != nil {
		return err
	}

	// Upsert page time for each visible page
	for _, page := range visiblePages {
		var track SessionPageTrack
		result := s.db.WithContext(ctx).
			Where("session_id = ? AND page_number = ?", sessionID, page).
			First(&track)
		if result.Error != nil {
			// Create new
			track = SessionPageTrack{
				SessionID:  sessionID,
				PageNumber: page,
				Seconds:    intervalSeconds,
			}
			if err := s.db.WithContext(ctx).Create(&track).Error; err != nil {
				return err
			}
		} else {
			// Update existing
			if err := s.db.WithContext(ctx).Model(&SessionPageTrack{}).
				Where("session_id = ? AND page_number = ?", sessionID, page).
				Update("seconds", gorm.Expr("seconds + ?", intervalSeconds)).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// GetStatus returns the current session status including chat unlock state.
func (s *Service) GetStatus(ctx context.Context, sessionID string) (*SessionStatus, error) {
	var session StudySession
	if err := s.db.WithContext(ctx).Where("id = ?", sessionID).First(&session).Error; err != nil {
		return nil, err
	}

	// Calculate elapsed seconds
	elapsed := session.DurationSeconds
	if session.EndedAt == nil {
		elapsed = int(time.Now().Sub(session.StartedAt).Seconds())
	}

	// Get qualified pages (cumulative time >= MinPageTime)
	var tracks []SessionPageTrack
	s.db.WithContext(ctx).
		Where("session_id = ? AND seconds >= ?", sessionID, MinPageTime).
		Find(&tracks)

	qualifiedPages := make([]int, 0, len(tracks))
	for _, t := range tracks {
		qualifiedPages = append(qualifiedPages, t.PageNumber)
	}

	chatUnlocked := elapsed >= MinTotalTime && len(qualifiedPages) >= MinPages

	return &SessionStatus{
		ElapsedSeconds: elapsed,
		QualifiedPages: qualifiedPages,
		ChatUnlocked:   chatUnlocked,
	}, nil
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
