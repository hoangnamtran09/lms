package reports

import "time"

type WeeklyReport struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	UserID     string    `gorm:"size:36;not null;uniqueIndex:idx_user_week;index" json:"userId"`
	WeekStart  string    `gorm:"size:10;not null;uniqueIndex:idx_user_week" json:"weekStart"`
	WeekEnd    string    `gorm:"size:10;not null" json:"weekEnd"`
	ReportJSON string    `gorm:"type:jsonb" json:"reportJson"`
	AIMessage  string    `gorm:"type:text" json:"aiMessage"`
	CreatedAt  time.Time `json:"createdAt"`
}

type ReportData struct {
	DailyStudy           []DailyStudyEntry    `json:"dailyStudy"`
	TotalStudyMinutes    int                  `json:"totalStudyMinutes"`
	PreviousWeekMinutes  int                  `json:"previousWeekMinutes"`
	CompletedAssignments int                  `json:"completedAssignments"`
	AvgScore             float64              `json:"avgScore"`
	TopWeaknesses        []WeaknessEntry      `json:"topWeaknesses"`
	DiamondsEarned       int                  `json:"diamondsEarned"`
	CurrentStreak        int                  `json:"currentStreak"`
	PreviousWeekDiamonds int                  `json:"previousWeekDiamonds"`
}

type DailyStudyEntry struct {
	Date    string `json:"date"`
	Minutes int    `json:"minutes"`
}

type WeaknessEntry struct {
	Topic      string `json:"topic"`
	ErrorCount int    `json:"errorCount"`
	Trend      string `json:"trend"`
}

type AIReportResponse struct {
	Title              string   `json:"title"`
	OverallAssessment  string   `json:"overallAssessment"`
	Highlights         []string `json:"highlights"`
	WeaknessAnalysis   string   `json:"weaknessAnalysis"`
	TrendComparison    string   `json:"trendComparison"`
	Recommendations    []string `json:"recommendations"`
	CoachMessage       string   `json:"coachMessage"`
}
