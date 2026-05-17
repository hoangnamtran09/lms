package studyplanner

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/ai"
	"github.com/lms/backend/internal/middleware"
	"gorm.io/gorm"
)

type Handler struct {
	svc     *Service
	aiSvc   *ai.Service
	db      *gorm.DB
}

func NewHandler(svc *Service, aiSvc *ai.Service, db *gorm.DB) *Handler {
	return &Handler{svc: svc, aiSvc: aiSvc, db: db}
}

func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	today := time.Now().Format("2006-01-02")

	// Gather data for AI
	prompt := h.buildGeneratePrompt(r.Context(), claims.UserID)

	response, err := h.aiSvc.Chat([]ai.ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý lập kế hoạch học tập. Chỉ trả về MẢNG JSON, không thêm markdown hay text khác."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var tasks []PlanTask
	cleaned := extractJSON(response)
	if err := json.Unmarshal([]byte(cleaned), &tasks); err != nil {
		jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Assign IDs to each task
	for i := range tasks {
		if tasks[i].ID == "" {
			tasks[i].ID = uuid.New().String()
		}
		tasks[i].Priority = i + 1
	}

	planJSON, _ := json.Marshal(tasks)

	// Upsert plan
	plan, err := h.svc.Upsert(r.Context(), claims.UserID, today, string(planJSON))
	if err != nil {
		jsonErr(w, "Lỗi lưu kế hoạch: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]interface{}{
		"plan":  mapPlanResponse(plan, tasks),
	})
}

func (h *Handler) GetToday(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	plan, err := h.svc.GetByDate(r.Context(), claims.UserID, date)
	if err != nil {
		jsonOk(w, map[string]interface{}{
			"plan": nil,
			"date": date,
		})
		return
	}

	var tasks []PlanTask
	json.Unmarshal([]byte(plan.PlanJSON), &tasks)
	jsonOk(w, map[string]interface{}{
		"plan": mapPlanResponse(plan, tasks),
	})
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	plans, err := h.svc.History(r.Context(), claims.UserID, 14)
	if err != nil {
		jsonErr(w, "Lỗi truy vấn lịch sử: "+err.Error(), http.StatusInternalServerError)
		return
	}

	type historyItem struct {
		ID             string  `json:"id"`
		Date           string  `json:"date"`
		TotalTasks     int     `json:"totalTasks"`
		CompletedTasks int     `json:"completedTasks"`
	}
	items := make([]historyItem, 0, len(plans))
	for _, p := range plans {
		var tasks []PlanTask
		json.Unmarshal([]byte(p.PlanJSON), &tasks)
		completions := make(map[string]bool)
		if p.CompletionJSON != "" {
			json.Unmarshal([]byte(p.CompletionJSON), &completions)
		}
		completed := 0
		for _, t := range tasks {
			if completions[t.ID] {
				completed++
			}
		}
		items = append(items, historyItem{
			ID:             p.ID,
			Date:           p.Date,
			TotalTasks:     len(tasks),
			CompletedTasks: completed,
		})
	}

	jsonOk(w, map[string]interface{}{
		"history": items,
	})
}

func (h *Handler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	parts := splitPath(r.URL.Path)
	// Path: /api/study-planner/{id}/task/{taskId}
	if len(parts) < 4 {
		jsonErr(w, "Invalid path", http.StatusBadRequest)
		return
	}
	planID := parts[len(parts)-3]
	taskID := parts[len(parts)-1]

	var req struct {
		Completed bool `json:"completed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Completed = true
	}

	plan, err := h.svc.UpdateCompletion(r.Context(), planID, taskID, req.Completed)
	if err != nil {
		jsonErr(w, "Lỗi cập nhật: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var tasks []PlanTask
	json.Unmarshal([]byte(plan.PlanJSON), &tasks)
	jsonOk(w, map[string]interface{}{
		"plan": mapPlanResponse(plan, tasks),
	})
}

func (h *Handler) Reorder(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Path: /api/study-planner/{id}/reorder
	parts := splitPath(r.URL.Path)
	if len(parts) < 2 {
		jsonErr(w, "Invalid path", http.StatusBadRequest)
		return
	}
	planID := parts[len(parts)-2]

	var req struct {
		Tasks []PlanTask `json:"tasks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	for i := range req.Tasks {
		req.Tasks[i].Priority = i + 1
	}
	planJSON, _ := json.Marshal(req.Tasks)

	if _, err := h.svc.Reorder(r.Context(), planID, string(planJSON)); err != nil {
		jsonErr(w, "Lỗi sắp xếp: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"status": "ok"})
}

// buildGeneratePrompt assembles user context for AI study plan generation.
func (h *Handler) buildGeneratePrompt(ctx context.Context, userID string) string {
	var sb strings.Builder

	// User weaknesses
	var weakTopics []string
	h.db.WithContext(ctx).Table("weakness_profiles").
		Where("user_id = ? AND resolved = false", userID).
		Pluck("topic", &weakTopics)

	sb.WriteString("**Điểm yếu hiện tại:**\n")
	if len(weakTopics) > 0 {
		for _, t := range weakTopics {
			sb.WriteString("- " + t + "\n")
		}
	} else {
		sb.WriteString("Chưa có điểm yếu nào được ghi nhận.\n")
	}

	// Pending assignments
	type assignRow struct {
		Title   string
		DueDate *time.Time
		Status  string
	}
	var assignments []assignRow
	h.db.WithContext(ctx).Table("assignments").
		Select("title, due_date, status").
		Where("student_ids LIKE ?", "%"+userID+"%").
		Where("status != ?", "RETURNED").
		Order("due_date ASC").
		Limit(5).
		Find(&assignments)

	sb.WriteString("\n**Bài tập đang có hạn:**\n")
	if len(assignments) > 0 {
		for _, a := range assignments {
			due := "Không có hạn"
			if a.DueDate != nil {
				due = a.DueDate.Format("2006-01-02")
			}
			sb.WriteString("- " + a.Title + " (hạn: " + due + ")\n")
		}
	} else {
		sb.WriteString("Không có bài tập đang chờ.\n")
	}

	// Available subjects and lessons
	type subjectLesson struct {
		SubjectName string
		LessonTitle string
		Studied     bool
	}
	var available []subjectLesson
	h.db.WithContext(ctx).
		Table("users u").
		Select("DISTINCT s.name AS subject_name, l.title AS lesson_title, EXISTS(SELECT 1 FROM study_sessions ss WHERE ss.user_id = u.id AND ss.lesson_id = l.id) AS studied").
		Joins("JOIN classes c ON c.id = u.class_id").
		Joins("JOIN courses co ON co.grade_level = c.grade_level_id").
		Joins("JOIN subjects s ON s.id = co.subject_id").
		Joins("JOIN lessons l ON l.course_id = co.id AND l.is_published = true").
		Where("u.id = ?", userID).
		Order("s.name ASC, l.sort_order ASC").
		Limit(20).
		Find(&available)

	sb.WriteString("\n**Môn học và bài học có sẵn:**\n")
	if len(available) > 0 {
		// Group by subject
		currentSubject := ""
		for _, sl := range available {
			if sl.SubjectName != currentSubject {
				sb.WriteString("- " + sl.SubjectName + ":\n")
				currentSubject = sl.SubjectName
			}
			status := "chưa học"
			if sl.Studied {
				status = "đã học"
			}
			sb.WriteString("    • " + sl.LessonTitle + " (" + status + ")\n")
		}
	} else {
		sb.WriteString("Chưa có dữ liệu môn học.\n")
	}

	// Study stats this week
	type statsRow struct {
		TotalSeconds  int
		TotalSessions int64
	}
	var stats statsRow
	weekAgo := time.Now().AddDate(0, 0, -7)
	h.db.WithContext(ctx).Table("study_sessions").
		Select("COALESCE(SUM(duration_seconds), 0) as total_seconds, COUNT(*) as total_sessions").
		Where("user_id = ? AND started_at >= ?", userID, weekAgo).
		Scan(&stats)

	sb.WriteString("\n**Thời gian học tuần này:** ")
	sb.WriteString(formatMinutes(stats.TotalSeconds / 60))
	sb.WriteString("\n**Số buổi học tuần này:** ")
	sb.WriteString(fmt.Sprintf("%d", int(stats.TotalSessions)))

	// Streak
	var currentStreak int
	h.db.WithContext(ctx).Table("streaks").
		Where("user_id = ?", userID).
		Select("COALESCE(current_streak, 0)").
		Scan(&currentStreak)
	sb.WriteString("\n**Streak hiện tại:** ")
	sb.WriteString(fmt.Sprintf("%d", currentStreak))
	sb.WriteString(" ngày\n")

	// Today's date for context
	sb.WriteString("\n**Hôm nay:** ")
	sb.WriteString(time.Now().Format("2006-01-02 (Monday)"))
	sb.WriteString("\n")

	return ai.BuildStudyPlannerPrompt(sb.String())
}

func mapPlanResponse(plan *StudyPlan, tasks []PlanTask) map[string]interface{} {
	completions := make(map[string]bool)
	if plan.CompletionJSON != "" {
		json.Unmarshal([]byte(plan.CompletionJSON), &completions)
	}

	taskList := make([]map[string]interface{}, 0, len(tasks))
	completedCount := 0
	for _, t := range tasks {
		done := completions[t.ID]
		if done {
			completedCount++
		}
		taskList = append(taskList, map[string]interface{}{
			"id":               t.ID,
			"title":            t.Title,
			"description":      t.Description,
			"type":             t.Type,
			"estimatedMinutes": t.EstimatedMinutes,
			"lessonId":         t.LessonID,
			"subjectName":      t.SubjectName,
			"priority":         t.Priority,
			"completed":        done,
		})
	}

	return map[string]interface{}{
		"id":             plan.ID,
		"date":           plan.Date,
		"tasks":          taskList,
		"totalTasks":     len(taskList),
		"completedTasks": completedCount,
	}
}

func formatMinutes(minutes int) string {
	h := minutes / 60
	m := minutes % 60
	if h > 0 {
		return fmt.Sprintf("%d giờ %d phút", h, m)
	}
	return fmt.Sprintf("%d phút", m)
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
	if strings.HasPrefix(s, "[") {
		if idx := strings.LastIndex(s, "]"); idx > 0 {
			s = s[:idx+1]
		}
	}
	return s
}

func splitPath(path string) []string {
	parts := make([]string, 0)
	current := ""
	for _, c := range path {
		if c == '/' {
			if current != "" {
				parts = append(parts, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
