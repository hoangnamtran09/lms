package analytics

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler { return &Handler{db: db} }

type Overview struct {
	TotalUsers       int            `json:"totalUsers"`
	UsersByRole      map[string]int `json:"usersByRole"`
	TotalSubjects    int64          `json:"totalSubjects"`
	TotalCourses     int64          `json:"totalCourses"`
	TotalLessons     int64          `json:"totalLessons"`
	TotalAssignments int64          `json:"totalAssignments"`
	TotalSubmissions int64          `json:"totalSubmissions"`
	PendingGrading   int64          `json:"pendingGrading"`
	TotalStudyMin    int64          `json:"totalStudyMin"`
}

func (h *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	var o Overview

	h.db.Raw("SELECT COUNT(*) FROM users").Scan(&o.TotalUsers)

	o.UsersByRole = make(map[string]int)
	var roleRows []struct {
		Role  string
		Count int
	}
	h.db.Raw("SELECT role, COUNT(*) as count FROM users GROUP BY role").Scan(&roleRows)
	for _, rr := range roleRows {
		o.UsersByRole[rr.Role] = rr.Count
	}

	h.db.Model(&struct{ ID string }{}).Table("subjects").Count(&o.TotalSubjects)
	h.db.Model(&struct{ ID string }{}).Table("courses").Count(&o.TotalCourses)
	h.db.Model(&struct{ ID string }{}).Table("lessons").Count(&o.TotalLessons)
	h.db.Model(&struct{ ID string }{}).Table("assignments").Count(&o.TotalAssignments)
	h.db.Model(&struct{ ID string }{}).Table("submissions").Count(&o.TotalSubmissions)
	h.db.Model(&struct{ ID string }{}).Table("submissions").Where("status = ?", "SUBMITTED").Count(&o.PendingGrading)

	var totalSec int64
	h.db.Raw("SELECT COALESCE(SUM(duration_seconds), 0) FROM study_sessions").Scan(&totalSec)
	o.TotalStudyMin = totalSec / 60

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

func (h *Handler) StudyTime(w http.ResponseWriter, r *http.Request) {
	var rows []struct {
		Date    string `json:"date"`
		Seconds int    `json:"seconds"`
	}
	h.db.Raw(`
		SELECT DATE(started_at) as date, COALESCE(SUM(duration_seconds), 0) as seconds
		FROM study_sessions
		WHERE started_at >= ?
		GROUP BY DATE(started_at)
		ORDER BY date ASC
	`, time.Now().AddDate(0, 0, -30)).Scan(&rows)

	type entry struct {
		Date    string `json:"date"`
		Seconds int    `json:"seconds"`
	}
	result := make([]entry, len(rows))
	for i, r := range rows {
		result[i] = entry{Date: r.Date, Seconds: r.Seconds}
	}
	if result == nil {
		result = []entry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"daily":    result,
		"periodDays": 30,
	})
}

func (h *Handler) ExportUsers(w http.ResponseWriter, r *http.Request) {
	var users []struct {
		ID        string
		Username  string
		FullName  string
		Email     string
		Role      string
		ClassID   string
		CreatedAt time.Time
	}
	h.db.Raw("SELECT id, username, full_name, email, role, class_id, created_at FROM users ORDER BY created_at DESC").Scan(&users)

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=users_%s.csv", time.Now().Format("20060102")))
	w.Write([]byte{0xEF, 0xBB, 0xBF}) // BOM for Excel UTF-8

	cw := csv.NewWriter(w)
	cw.Write([]string{"ID", "Username", "Họ tên", "Email", "Vai trò", "Lớp", "Ngày tạo"})
	for _, u := range users {
		cw.Write([]string{
			u.ID, u.Username, u.FullName, u.Email, u.Role, u.ClassID,
			u.CreatedAt.Format("2006-01-02 15:04"),
		})
	}
	cw.Flush()
}

func (h *Handler) ExportAssignments(w http.ResponseWriter, r *http.Request) {
	var rows []struct {
		AssignmentID string
		Title        string
		StudentName  string
		Score        *float64
		MaxScore     int
		Status       string
		SubmittedAt  *time.Time
	}
	h.db.Raw(`
		SELECT a.id as assignment_id, a.title, u.full_name as student_name,
			s.score, a.max_score, s.status, s.submitted_at
		FROM submissions s
		JOIN assignments a ON a.id = s.assignment_id
		JOIN users u ON u.id = s.student_id
		ORDER BY s.submitted_at DESC
	`).Scan(&rows)

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=assignments_%s.csv", time.Now().Format("20060102")))
	w.Write([]byte{0xEF, 0xBB, 0xBF})

	cw := csv.NewWriter(w)
	cw.Write([]string{"Bài tập", "Học sinh", "Điểm", "Điểm tối đa", "Trạng thái", "Ngày nộp"})
	for _, r := range rows {
		scoreStr := ""
		if r.Score != nil {
			scoreStr = fmt.Sprintf("%.1f", *r.Score)
		}
		submittedStr := ""
		if r.SubmittedAt != nil {
			submittedStr = r.SubmittedAt.Format("2006-01-02 15:04")
		}
		cw.Write([]string{r.Title, r.StudentName, scoreStr, fmt.Sprintf("%d", r.MaxScore), r.Status, submittedStr})
	}
	cw.Flush()
}
