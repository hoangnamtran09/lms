package reports

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/ai"
	"gorm.io/gorm"
)

type Service struct {
	db    *gorm.DB
	aiSvc *ai.Service
}

func NewService(db *gorm.DB, aiSvc *ai.Service) *Service {
	return &Service{db: db, aiSvc: aiSvc}
}

func weekBounds(t time.Time) (start, end string) {
	weekday := t.Weekday()
	if weekday == time.Sunday {
		weekday = 7
	}
	monday := t.AddDate(0, 0, -int(weekday-time.Monday))
	sunday := monday.AddDate(0, 0, 6)
	return monday.Format("2006-01-02"), sunday.Format("2006-01-02")
}

func (s *Service) GetOrGenerate(ctx context.Context, userID string, weekStart, weekEnd string) (*WeeklyReport, error) {
	if weekStart == "" || weekEnd == "" {
		weekStart, weekEnd = weekBounds(time.Now())
	}

	var report WeeklyReport
	err := s.db.WithContext(ctx).Where("user_id = ? AND week_start = ?", userID, weekStart).First(&report).Error
	if err == nil {
		return &report, nil
	}

	return s.Generate(ctx, userID, weekStart, weekEnd)
}

func (s *Service) Generate(ctx context.Context, userID string, weekStart, weekEnd string) (*WeeklyReport, error) {
	currentData := s.gatherData(ctx, userID, weekStart, weekEnd)

	prevStart, prevEnd := previousWeek(weekStart)
	prevData := s.gatherData(ctx, userID, prevStart, prevEnd)

	currentStr := s.formatDataForPrompt(currentData)
	prevStr := s.formatDataForPrompt(prevData)

	prompt := ai.BuildWeeklyReportPrompt(currentStr, prevStr)

	response, err := s.aiSvc.Chat([]ai.ChatMessage{
		{Role: "system", Content: "Bạn là chuyên gia phân tích học tập. Chỉ trả về JSON, không thêm markdown hay text khác."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		return nil, fmt.Errorf("AI error: %w", err)
	}

	var aiResp AIReportResponse
	cleaned := extractJSON(response)
	if err := json.Unmarshal([]byte(cleaned), &aiResp); err != nil {
		aiResp = AIReportResponse{
			Title:             "Báo cáo tuần",
			OverallAssessment: "neutral",
			CoachMessage:      response,
		}
	}

	reportJSON, _ := json.Marshal(ReportData{
		DailyStudy:           currentData.dailyStudy,
		TotalStudyMinutes:    currentData.totalMinutes,
		PreviousWeekMinutes:  prevData.totalMinutes,
		CompletedAssignments: currentData.completedAssignments,
		AvgScore:             currentData.avgScore,
		TopWeaknesses:        currentData.topWeaknesses,
		DiamondsEarned:       currentData.diamonds,
		PreviousWeekDiamonds: prevData.diamonds,
		CurrentStreak:        currentData.streak,
	})

	report := WeeklyReport{
		ID:         uuid.New().String(),
		UserID:     userID,
		WeekStart:  weekStart,
		WeekEnd:    weekEnd,
		ReportJSON: string(reportJSON),
		AIMessage:  safeMarshal(aiResp),
	}

	if err := s.db.WithContext(ctx).Create(&report).Error; err != nil {
		return nil, fmt.Errorf("save report: %w", err)
	}

	return &report, nil
}

func (s *Service) List(ctx context.Context, userID string, limit int) ([]WeeklyReport, error) {
	if limit <= 0 {
		limit = 20
	}
	var reports []WeeklyReport
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("week_start DESC").Limit(limit).Find(&reports).Error
	if reports == nil {
		reports = []WeeklyReport{}
	}
	return reports, err
}

func (s *Service) GetByID(ctx context.Context, id string) (*WeeklyReport, error) {
	var report WeeklyReport
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

type gatheredData struct {
	dailyStudy            []DailyStudyEntry
	totalMinutes          int
	completedAssignments  int
	avgScore              float64
	topWeaknesses         []WeaknessEntry
	diamonds              int
	streak                int
}

func (s *Service) gatherData(ctx context.Context, userID, weekStart, weekEnd string) gatheredData {
	var d gatheredData

	type dailyRow struct {
		Date    string
		Minutes int
	}
	var rows []dailyRow
	s.db.WithContext(ctx).Raw(`
		SELECT DATE(started_at) as date, COALESCE(SUM(duration_seconds)/60, 0) as minutes
		FROM study_sessions
		WHERE user_id = ? AND started_at >= ? AND started_at < ?
		GROUP BY DATE(started_at)
		ORDER BY date ASC
	`, userID, weekStart, weekEnd+"T23:59:59Z").Scan(&rows)

	for _, r := range rows {
		d.dailyStudy = append(d.dailyStudy, DailyStudyEntry{Date: r.Date, Minutes: r.Minutes})
		d.totalMinutes += r.Minutes
	}

	if d.dailyStudy == nil {
		d.dailyStudy = []DailyStudyEntry{}
	}

	var submissionStats struct {
		Count int
		Avg   float64
	}
	s.db.WithContext(ctx).Raw(`
		SELECT COUNT(*) as count, COALESCE(AVG(score), 0) as avg
		FROM submissions
		WHERE student_id = ? AND status = 'GRADED' AND graded_at >= ? AND graded_at < ?
	`, userID, weekStart, weekEnd+"T23:59:59Z").Scan(&submissionStats)
	d.completedAssignments = submissionStats.Count
	d.avgScore = submissionStats.Avg

	type weakRow struct {
		Topic      string
		ErrorCount int
	}
	var weakRows []weakRow
	s.db.WithContext(ctx).Table("weakness_profiles").
		Where("user_id = ? AND resolved = false", userID).
		Order("error_count DESC").
		Limit(5).
		Select("topic, error_count").
		Find(&weakRows)

	for _, w := range weakRows {
		trend := "needsAttention"
		d.topWeaknesses = append(d.topWeaknesses, WeaknessEntry{
			Topic:      w.Topic,
			ErrorCount: w.ErrorCount,
			Trend:      trend,
		})
	}
	if d.topWeaknesses == nil {
		d.topWeaknesses = []WeaknessEntry{}
	}

	s.db.WithContext(ctx).Raw(`
		SELECT COALESCE(SUM(amount), 0) FROM diamond_transactions
		WHERE user_id = ? AND created_at >= ? AND created_at < ?
	`, userID, weekStart, weekEnd+"T23:59:59Z").Scan(&d.diamonds)

	s.db.WithContext(ctx).Table("streaks").
		Where("user_id = ?", userID).
		Select("COALESCE(current_streak, 0)").
		Scan(&d.streak)

	return d
}

func (s *Service) formatDataForPrompt(d gatheredData) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Tổng thời gian học: %d phút (%d giờ %d phút)\n", d.totalMinutes, d.totalMinutes/60, d.totalMinutes%60))
	sb.WriteString(fmt.Sprintf("Số bài tập hoàn thành: %d\n", d.completedAssignments))
	sb.WriteString(fmt.Sprintf("Điểm trung bình: %.1f\n", d.avgScore))
	sb.WriteString(fmt.Sprintf("Kim cương kiếm được: %d\n", d.diamonds))
	sb.WriteString(fmt.Sprintf("Streak hiện tại: %d ngày\n\n", d.streak))

	sb.WriteString("Thời gian học theo ngày:\n")
	for _, ds := range d.dailyStudy {
		sb.WriteString(fmt.Sprintf("- %s: %d phút\n", ds.Date, ds.Minutes))
	}

	sb.WriteString("\nĐiểm yếu:\n")
	if len(d.topWeaknesses) > 0 {
		for _, w := range d.topWeaknesses {
			sb.WriteString(fmt.Sprintf("- %s (%d lỗi)\n", w.Topic, w.ErrorCount))
		}
	} else {
		sb.WriteString("- Không có điểm yếu nào được ghi nhận\n")
	}

	return sb.String()
}

func previousWeek(weekStart string) (string, string) {
	t, err := time.Parse("2006-01-02", weekStart)
	if err != nil {
		now := time.Now()
		ws, _ := weekBounds(now.AddDate(0, 0, -7))
		we, _ := weekBounds(now.AddDate(0, 0, -7))
		return ws, we
	}
	ps := t.AddDate(0, 0, -7)
	return ps.Format("2006-01-02"), ps.AddDate(0, 0, 6).Format("2006-01-02")
}

func extractJSON(raw string) string {
	s := strings.TrimSpace(raw)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		if idx := strings.Index(s, "\n"); idx >= 0 && idx < 20 {
			tag := strings.TrimSpace(s[:idx])
			if len(tag) < 15 && !strings.Contains(tag, " ") {
				s = s[idx+1:]
			}
		}
		if idx := strings.LastIndex(s, "```"); idx >= 0 {
			s = s[:idx]
		}
		s = strings.TrimSpace(s)
	}
	if !strings.HasPrefix(s, "[") && !strings.HasPrefix(s, "{") {
		if idx := strings.Index(s, "["); idx >= 0 {
			s = s[idx:]
		} else if idx := strings.Index(s, "{"); idx >= 0 {
			s = s[idx:]
		}
	}
	return s
}

func safeMarshal(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
