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

	var aiResp AIReportResponse

	// Try AI first; fall back to rule-based if AI fails or is not configured
	prompt := ai.BuildWeeklyReportPrompt(currentStr, prevStr)
	response, aiErr := s.aiSvc.Chat([]ai.ChatMessage{
		{Role: "system", Content: "Bạn là chuyên gia phân tích học tập. Chỉ trả về JSON, không thêm markdown hay text khác."},
		{Role: "user", Content: prompt},
	})
	if aiErr == nil {
		cleaned := extractJSON(response)
		if err := json.Unmarshal([]byte(cleaned), &aiResp); err != nil {
			aiResp = generateSimpleReport(currentData, prevData)
		}
	} else {
		// AI unavailable — use rule-based report
		aiResp = generateSimpleReport(currentData, prevData)
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

// generateSimpleReport creates a coaching report from data without AI.
func generateSimpleReport(current, previous gatheredData) AIReportResponse {
	var (
		totalMins      = current.totalMinutes
		prevMins       = previous.totalMinutes
		assignments    = current.completedAssignments
		avgScore       = current.avgScore
		diamonds       = current.diamonds
		streak         = current.streak
		weaknesses     = current.topWeaknesses
	)

	// --- Overall assessment ---
	assessment := "neutral"
	if totalMins >= 300 && avgScore >= 7.0 && len(weaknesses) <= 1 {
		assessment = "great"
	} else if totalMins < 60 || avgScore < 5.0 && assignments > 0 {
		assessment = "needs_improvement"
	} else if totalMins >= 120 || avgScore >= 6.0 {
		assessment = "good"
	}

	// --- Title ---
	title := "Báo cáo tuần"
	if assessment == "great" {
		title = "Tuần học xuất sắc!"
	} else if assessment == "good" {
		title = "Tuần học hiệu quả"
	} else if assessment == "needs_improvement" {
		title = "Cần cố gắng thêm"
	}

	// --- Coach message ---
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("📊 **Tổng thời gian học:** %d giờ %d phút", totalMins/60, totalMins%60))

	if prevMins > 0 {
		diff := totalMins - prevMins
		if diff > 0 {
			msg.WriteString(fmt.Sprintf(" (tăng %d phút so với tuần trước).\n", diff))
		} else if diff < 0 {
			msg.WriteString(fmt.Sprintf(" (giảm %d phút so với tuần trước).\n", -diff))
		} else {
			msg.WriteString(" (bằng tuần trước).\n")
		}
	} else {
		msg.WriteString(".\n")
	}

	if assignments > 0 {
		msg.WriteString(fmt.Sprintf("📝 **%d bài tập** đã hoàn thành, điểm trung bình **%.1f**.\n", assignments, avgScore))
	}

	msg.WriteString(fmt.Sprintf("💎 **%d kim cương** kiếm được tuần này.\n", diamonds))

	if streak > 0 {
		msg.WriteString(fmt.Sprintf("🔥 Streak học tập: **%d ngày liên tiếp**.\n", streak))
	}

	// --- Recommendations based on data ---
	msg.WriteString("\n---\n\n")
	if assessment == "great" {
		msg.WriteString("🌟 Bạn đang có một tuần học rất tốt! Tiếp tục duy trì phong độ này nhé.\n")
	} else if totalMins < 60 {
		msg.WriteString("⏰ Hãy dành thêm thời gian học tập mỗi ngày. Mỗi ngày 30 phút sẽ tạo ra khác biệt lớn!\n")
	}

	if avgScore < 6.0 && assignments > 0 {
		msg.WriteString("📚 Điểm trung bình còn thấp — hãy xem lại các câu sai và học từ những lỗi đó.\n")
	}

	if len(weaknesses) > 0 {
		msg.WriteString("\n🎯 **Điểm cần cải thiện:**\n")
		for _, w := range weaknesses {
			msg.WriteString(fmt.Sprintf("  - **%s** (%d lỗi)\n", w.Topic, w.ErrorCount))
		}
	} else if assignments > 0 {
		msg.WriteString("\n✅ Không có điểm yếu nào được ghi nhận — rất tốt!\n")
	}

	if prevMins > 0 && totalMins < prevMins {
		msg.WriteString("\n📉 Thời gian học giảm so với tuần trước. Hãy lên lịch học cố định mỗi ngày để duy trì đều đặn.\n")
	}

	// Trend comparison
	trend := "ổn định"
	if previous.totalMinutes > 0 {
		if totalMins > previous.totalMinutes {
			trend = fmt.Sprintf("tăng %d phút so với tuần trước", totalMins-prevMins)
		} else if totalMins < previous.totalMinutes {
			trend = fmt.Sprintf("giảm %d phút so với tuần trước", prevMins-totalMins)
		}
	}

	return AIReportResponse{
		Title:             title,
		OverallAssessment: assessment,
		CoachMessage:      msg.String(),
		Highlights:        buildHighlights(current, assessment),
		TrendComparison:   trend,
		Recommendations:   buildRecommendations(current),
	}
}

func buildHighlights(d gatheredData, assessment string) []string {
	var s []string
	if d.totalMinutes >= 120 {
		s = append(s, fmt.Sprintf("⏱️ %d phút học tập trong tuần", d.totalMinutes))
	}
	if d.avgScore >= 7.0 && d.completedAssignments > 0 {
		s = append(s, fmt.Sprintf("📝 Điểm trung bình %.1f — làm tốt!", d.avgScore))
	}
	if d.streak >= 3 {
		s = append(s, fmt.Sprintf("🔥 Streak %d ngày liên tiếp", d.streak))
	}
	if d.diamonds >= 20 {
		s = append(s, fmt.Sprintf("💎 %d kim cương kiếm được", d.diamonds))
	}
	if len(s) == 0 {
		s = append(s, "🚀 Đã bắt đầu hành trình học tập")
	}
	return s
}

func buildRecommendations(d gatheredData) []string {
	var a []string
	if d.totalMinutes < 120 {
		a = append(a, "Đặt mục tiêu học ít nhất 20 phút mỗi ngày")
	}
	if d.completedAssignments == 0 {
		a = append(a, "Hoàn thành ít nhất 1 bài tập mỗi tuần để củng cố kiến thức")
	}
	if d.avgScore < 6.0 && d.completedAssignments > 0 {
		a = append(a, "Xem lại các câu sai và ghi chú kiến thức cần nhớ")
	}
	if len(d.topWeaknesses) > 2 {
		a = append(a, "Dành thêm thời gian cho các chủ đề yếu")
	}
	if len(a) == 0 && d.totalMinutes >= 120 {
		a = append(a, "Tiếp tục duy trì lịch học đều đặn")
		a = append(a, "Thử thách bản thân với bài tập nâng cao")
	}
	if len(a) == 0 {
		a = append(a, "Bắt đầu học ngay hôm nay — mỗi phút đều có giá trị!")
	}
	return a
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
