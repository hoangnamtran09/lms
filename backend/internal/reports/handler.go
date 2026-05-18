package reports

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/lms/backend/internal/middleware"
	"gorm.io/gorm"
)

type Handler struct {
	svc *Service
	db  *gorm.DB
}

func NewHandler(svc *Service, db *gorm.DB) *Handler {
	return &Handler{svc: svc, db: db}
}

func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	weekParam := r.URL.Query().Get("week")
	var weekStart, weekEnd string
	if weekParam != "" {
		t, err := time.Parse("2006-01-02", weekParam)
		if err != nil {
			jsonErr(w, "Invalid week format (use YYYY-MM-DD)", http.StatusBadRequest)
			return
		}
		weekStart, weekEnd = weekBounds(t)
	}

	report, err := h.svc.GetOrGenerate(r.Context(), claims.UserID, weekStart, weekEnd)
	if err != nil {
		jsonErr(w, "Lỗi tạo báo cáo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, mapReportResponse(report))
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)

	reports, err := h.svc.List(r.Context(), claims.UserID, limit)
	if err != nil {
		jsonErr(w, "Lỗi truy vấn: "+err.Error(), http.StatusInternalServerError)
		return
	}

	result := make([]map[string]interface{}, len(reports))
	for i, rpt := range reports {
		result[i] = mapReportResponse(&rpt)
	}

	jsonOk(w, map[string]interface{}{
		"reports": result,
	})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	id := extractID(r.URL.Path)
	if id == "" {
		jsonErr(w, "Missing report ID", http.StatusBadRequest)
		return
	}

	report, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		jsonErr(w, "Không tìm thấy báo cáo", http.StatusNotFound)
		return
	}

	if report.UserID != claims.UserID {
		jsonErr(w, "Forbidden", http.StatusForbidden)
		return
	}

	jsonOk(w, mapReportResponse(report))
}

func (h *Handler) GetForStudent(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	parts := splitPath(r.URL.Path)
	if len(parts) < 2 {
		jsonErr(w, "Missing student ID", http.StatusBadRequest)
		return
	}
	studentID := parts[len(parts)-1]

	if !h.canAccessStudent(r.Context(), claims, studentID) {
		jsonErr(w, "Forbidden", http.StatusForbidden)
		return
	}

	weekParam := r.URL.Query().Get("week")
	var weekStart, weekEnd string
	if weekParam != "" {
		t, err := time.Parse("2006-01-02", weekParam)
		if err != nil {
			weekStart, weekEnd = weekBounds(time.Now())
		} else {
			weekStart, weekEnd = weekBounds(t)
		}
	}

	report, err := h.svc.GetOrGenerate(r.Context(), studentID, weekStart, weekEnd)
	if err != nil {
		jsonErr(w, "Lỗi tạo báo cáo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, mapReportResponse(report))
}

func (h *Handler) canAccessStudent(ctx context.Context, claims *middleware.Claims, studentID string) bool {
	if claims == nil {
		return false
	}

	switch claims.Role {
	case "SUPER_ADMIN", "ADMIN":
		return true
	case "TEACHER":
		var count int64
		h.db.WithContext(ctx).
			Table("users u").
			Joins("JOIN classes c ON c.id = u.class_id").
			Where("u.id = ? AND c.teacher_id = ?", studentID, claims.UserID).
			Count(&count)
		return count > 0
	case "PARENT":
		var count int64
		h.db.WithContext(ctx).
			Table("child_links").
			Where("parent_id = ? AND child_id = ?", claims.UserID, studentID).
			Count(&count)
		return count > 0
	default:
		return false
	}
}

func mapReportResponse(r *WeeklyReport) map[string]interface{} {
	var reportData interface{}
	if r.ReportJSON != "" {
		json.Unmarshal([]byte(r.ReportJSON), &reportData)
	}
	var aiMessage interface{}
	if r.AIMessage != "" {
		json.Unmarshal([]byte(r.AIMessage), &aiMessage)
	}

	return map[string]interface{}{
		"id":        r.ID,
		"userId":    r.UserID,
		"weekStart": r.WeekStart,
		"weekEnd":   r.WeekEnd,
		"report":    reportData,
		"aiMessage": aiMessage,
		"createdAt": r.CreatedAt,
	}
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

func extractID(path string) string {
	parts := splitPath(path)
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return ""
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
