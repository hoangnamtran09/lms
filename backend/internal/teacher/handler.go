package teacher

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
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
		Where("role = ? AND class_id IN (SELECT class_id FROM users WHERE supabase_id = ?)", "STUDENT", claims.UserID).
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
		"students":        students,
		"assignmentCount": assignmentCount,
		"pendingGrading":  pendingGrading,
		"recentSubmissions": recentSubs,
	})
}

// ListStudents returns students in the teacher's class.
func (h *Handler) ListStudents(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())

	type StudentRow struct {
		ID         string `json:"id"`
		SupabaseID string `json:"supabaseId"`
		FullName   string `json:"fullName"`
		Username   string `json:"username"`
		Email      string `json:"email"`
		ClassID    string `json:"classId"`
		TotalStudy int    `json:"totalStudy"`
		Streak     int    `json:"streak"`
	}
	var students []StudentRow
	h.db.Table("users").
		Where("role = ? AND class_id = ?", "STUDENT", claims.ClassID).
		Select("id, supabase_id, full_name, username, email, class_id, 0 as total_study, 0 as streak").
		Find(&students)

	for i := range students {
		h.db.Table("study_sessions").
			Where("user_id = ?", students[i].ID).
			Select("COALESCE(SUM(duration_seconds), 0)").Scan(&students[i].TotalStudy)
		h.db.Table("streaks").
			Where("user_id = ?", students[i].ID).
			Select("current_streak").Scan(&students[i].Streak)
	}

	jsonOk(w, students)
}

// LinkParent links a parent to a student (child). Only allows linking students in the teacher's class.
func (h *Handler) LinkParent(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())

	var req struct {
		ChildID  string `json:"childId"`
		ParentID string `json:"parentId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if req.ChildID == "" || req.ParentID == "" {
		jsonError(w, "childId và parentId không được để trống", http.StatusBadRequest)
		return
	}

	// Verify the child is in the teacher's class
	var childClassID string
	if err := h.db.Table("users").Where("id = ? AND role = ?", req.ChildID, "STUDENT").Select("class_id").Scan(&childClassID).Error; err != nil || childClassID == "" {
		jsonError(w, "Không tìm thấy học sinh", http.StatusNotFound)
		return
	}
	if childClassID != claims.ClassID {
		jsonError(w, "Học sinh không thuộc lớp của bạn", http.StatusForbidden)
		return
	}

	// Verify the parent exists
	var parentRole string
	if err := h.db.Table("users").Where("id = ? AND role = ?", req.ParentID, "PARENT").Select("role").Scan(&parentRole).Error; err != nil || parentRole == "" {
		jsonError(w, "Không tìm thấy phụ huynh", http.StatusNotFound)
		return
	}

	// Check if link already exists
	var existingID string
	if err := h.db.Table("child_links").Where("parent_id = ? AND child_id = ?", req.ParentID, req.ChildID).Select("id").Scan(&existingID).Error; err == nil && existingID != "" {
		jsonError(w, "Phụ huynh đã được liên kết với học sinh này", http.StatusConflict)
		return
	}

	// Create link
	linkID := uuid.New().String()
	if err := h.db.Table("child_links").Create(map[string]interface{}{
		"id":         linkID,
		"parent_id":  req.ParentID,
		"child_id":   req.ChildID,
		"created_at": time.Now(),
	}).Error; err != nil {
		jsonError(w, "Lỗi tạo liên kết: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"id": linkID, "status": "linked"})
}

type LinkRow struct {
	ID         string `json:"id"`
	ParentID   string `json:"parentId"`
	ParentName string `json:"parentName"`
	ChildID    string `json:"childId"`
	ChildName  string `json:"childName"`
}

// ListLinks lists all parent-student links for the teacher's class.
func (h *Handler) ListLinks(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())

	// Get students in teacher's class
	var studentIDs []string
	h.db.Table("users").Where("role = ? AND class_id = ?", "STUDENT", claims.ClassID).Pluck("id", &studentIDs)
	if len(studentIDs) == 0 {
		jsonOk(w, []LinkRow{})
		return
	}

	type rawLink struct {
		ID       string
		ParentID string
		ChildID  string
	}
	var links []rawLink
	h.db.Table("child_links").Where("child_id IN ?", studentIDs).Select("id, parent_id, child_id").Find(&links)
	if len(links) == 0 {
		jsonOk(w, []LinkRow{})
		return
	}

	// Collect parent IDs for name lookup
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
	h.db.Table("users").Where("id IN ?", ids).Select("id, full_name").Find(&users)
	nameMap := make(map[string]string, len(users))
	for _, u := range users {
		nameMap[u.ID] = u.FullName
	}

	result := make([]LinkRow, len(links))
	for i, l := range links {
		result[i] = LinkRow{
			ID:         l.ID,
			ParentID:   l.ParentID,
			ParentName: nameMap[l.ParentID],
			ChildID:    l.ChildID,
			ChildName:  nameMap[l.ChildID],
		}
	}
	jsonOk(w, result)
}

// DeleteLink deletes a parent-student link, scoped to the teacher's class.
func (h *Handler) DeleteLink(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	linkID := extractID(r.URL.Path)

	// Verify the link's child is in teacher's class
	var childID string
	if err := h.db.Table("child_links").Where("id = ?", linkID).Select("child_id").Scan(&childID).Error; err != nil || childID == "" {
		jsonError(w, "Không tìm thấy liên kết", http.StatusNotFound)
		return
	}

	var classID string
	h.db.Table("users").Where("id = ? AND role = ?", childID, "STUDENT").Select("class_id").Scan(&classID)
	if classID != claims.ClassID {
		jsonError(w, "Học sinh không thuộc lớp của bạn", http.StatusForbidden)
		return
	}

	h.db.Table("child_links").Where("id = ?", linkID).Delete(nil)
	jsonOk(w, map[string]string{"status": "deleted"})
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func extractID(path string) string {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	return parts[len(parts)-1]
}
