package teacher

import (
	"encoding/json"
	"net/http"

	"github.com/lms/backend/internal/middleware"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler { return &Handler{db: db} }

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())

	// Students in teacher's class
	type StudentRow struct {
		ID          string `json:"id"`
		FullName    string `json:"fullName"`
		ClassID     string `json:"classId"`
		TotalStudy  int    `json:"totalStudy"`
		Streak      int    `json:"streak"`
	}
	var students []StudentRow
	h.db.Table("users").
		Where("role = ? AND class_id IN (SELECT class_id FROM users WHERE id = ?)", "STUDENT", claims.UserID).
		Select("id, full_name, class_id, 0 as total_study, 0 as streak").
		Limit(20).Find(&students)

	// Enrich with study data
	for i := range students {
		h.db.Table("study_sessions").
			Where("user_id = ?", students[i].ID).
			Select("COALESCE(SUM(duration_seconds), 0)").Scan(&students[i].TotalStudy)
		h.db.Table("streaks").
			Where("user_id = ?", students[i].ID).
			Select("current_streak").Scan(&students[i].Streak)
	}

	// Assignments created by this teacher
	var assignmentCount int64
	h.db.Table("assignments").Where("creator_id = ?", claims.UserID).Count(&assignmentCount)

	// Pending submissions (submitted but not graded)
	var pendingGrading int64
	h.db.Table("submissions s").
		Joins("JOIN assignments a ON a.id = s.assignment_id").
		Where("a.creator_id = ? AND s.status = ?", claims.UserID, "SUBMITTED").
		Count(&pendingGrading)

	// Recent submissions
	type RecentSub struct {
		StudentName string `json:"studentName"`
		Title       string `json:"title"`
		Status      string `json:"status"`
		SubmittedAt string `json:"submittedAt"`
	}
	var recentSubs []RecentSub
	h.db.Table("submissions s").
		Select("u.full_name as student_name, a.title, s.status, s.submitted_at").
		Joins("JOIN assignments a ON a.id = s.assignment_id").
		Joins("JOIN users u ON u.id = s.student_id").
		Where("a.creator_id = ?", claims.UserID).
		Order("s.submitted_at DESC").Limit(10).Find(&recentSubs)

	jsonOk(w, map[string]interface{}{
		"students":       students,
		"assignmentCount": assignmentCount,
		"pendingGrading":  pendingGrading,
		"recentSubmissions": recentSubs,
	})
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
