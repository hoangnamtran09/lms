package search

import (
	"encoding/json"
	"net/http"
	"strings"

	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

type SearchResult struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"`
	Link        string `json:"link"`
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		jsonOk(w, []interface{}{})
		return
	}

	like := "%" + q + "%"
	var results []SearchResult

	// Search subjects
	var subjects []struct {
		ID   string
		Name string
	}
	h.db.WithContext(r.Context()).Raw("SELECT id, name FROM subjects WHERE LOWER(name) LIKE LOWER(?) LIMIT 5", like).Scan(&subjects)
	for _, s := range subjects {
		results = append(results, SearchResult{
			ID:    s.ID,
			Title: s.Name,
			Type:  "subject",
			Link:  "/courses/" + s.ID,
		})
	}

	// Search courses
	var courses []struct {
		ID          string
		Title       string
		Description string
		SubjectID   string `gorm:"column:subject_id"`
	}
	h.db.WithContext(r.Context()).Raw("SELECT id, title, description, subject_id FROM courses WHERE LOWER(title) LIKE LOWER(?) LIMIT 5", like).Scan(&courses)
	for _, c := range courses {
		results = append(results, SearchResult{
			ID:          c.ID,
			Title:       c.Title,
			Description: c.Description,
			Type:        "course",
			Link:        "/courses/" + c.SubjectID + "/" + c.ID,
		})
	}

	// Search lessons
	var lessons []struct {
		ID          string
		Title       string
		Description string
		CourseID    string `gorm:"column:course_id"`
	}
	h.db.WithContext(r.Context()).Raw(`
		SELECT l.id, l.title, l.description, l.course_id 
		FROM lessons l 
		WHERE LOWER(l.title) LIKE LOWER(?) 
		LIMIT 5
	`, like).Scan(&lessons)
	for _, l := range lessons {
		var subjectID string
		h.db.WithContext(r.Context()).Raw("SELECT subject_id FROM courses WHERE id = ?", l.CourseID).Scan(&subjectID)
		results = append(results, SearchResult{
			ID:          l.ID,
			Title:       l.Title,
			Description: l.Description,
			Type:        "lesson",
			Link:        "/courses/" + subjectID + "/" + l.CourseID + "/" + l.ID,
		})
	}

	jsonOk(w, results)
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
