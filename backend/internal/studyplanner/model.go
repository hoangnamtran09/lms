package studyplanner

import "time"

type StudyPlan struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	UserID       string    `gorm:"size:36;not null;index" json:"userId"`
	Date         string    `gorm:"size:10;not null;index" json:"date"` // YYYY-MM-DD
	PlanJSON     string    `gorm:"type:text;not null" json:"planJson"`
	CompletionJSON string  `gorm:"type:text" json:"completionJson"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type PlanTask struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	Type             string `json:"type"` // review, practice, quiz, assignment
	EstimatedMinutes int    `json:"estimatedMinutes"`
	LessonID         string `json:"lessonId,omitempty"`
	SubjectName      string `json:"subjectName"`
	Priority         int    `json:"priority"`
}

type PlanCompletion struct {
	TaskID    string `json:"taskId"`
	Completed bool   `json:"completed"`
	StartedAt string `json:"startedAt,omitempty"`
}
