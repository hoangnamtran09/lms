package assignments

import (
	"encoding/json"
	"time"
)

// Status workflow: DRAFT → ASSIGNED → SUBMITTED → GRADED → RETURNED → ACCEPTED
const (
	StatusDraft     = "DRAFT"
	StatusAssigned  = "ASSIGNED"
	StatusSubmitted = "SUBMITTED"
	StatusGraded    = "GRADED"
	StatusReturned  = "RETURNED"
	StatusAccepted  = "ACCEPTED"
)

// Question represents a single question in an assignment
type Question struct {
	ID             string          `json:"id"`
	Question       string          `json:"question"`
	Type           string          `json:"type"` // "mcq", "short_answer", "essay", etc.
	Score          float64         `json:"score"`
	ExpectedAnswer string          `json:"expectedAnswer"`
	Options        json.RawMessage `json:"options"`
}

// SubmissionAnswer represents a student's answer to a question
type SubmissionAnswer struct {
	QuestionID string `json:"questionId"`
	Answer     string `json:"answer"`
}

// SubmissionPayload is the request body for submitting an assignment
type SubmissionPayload struct {
	Answers []SubmissionAnswer `json:"answers"`
}

type Assignment struct {
	ID               string    `gorm:"primaryKey;size:36" json:"id"`
	CreatorID        string    `gorm:"size:36;not null;index" json:"creatorId"`
	CreatorName      string    `gorm:"size:200" json:"creatorName"`
	Title            string    `gorm:"size:500;not null" json:"title"`
	Description      string    `gorm:"type:text" json:"description"`
	SubjectID        string    `gorm:"size:36" json:"subjectId"`
	GradeLevel       int       `json:"gradeLevel"`
	ClassID          string    `gorm:"size:36;index" json:"classId"`
	StudentIDs       string    `gorm:"type:text" json:"studentIds"`
	MaxScore         int       `gorm:"default:100" json:"maxScore"`
	Rubric           string    `gorm:"type:text" json:"rubric"`
	DueDate          time.Time `json:"dueDate"`
	AttachmentURL    string    `gorm:"size:1000" json:"attachmentUrl"`
	Questions        string    `gorm:"type:text" json:"questions"`
	MatrixMetadata   string    `gorm:"type:text" json:"matrixMetadata"`
	Status           string    `gorm:"size:20" json:"status"`
	Source           string    `gorm:"size:20;default:teacher" json:"source"`
	AllowResubmit    bool      `gorm:"default:false" json:"allowResubmit"`
	SubmissionCount  int64     `gorm:"-" json:"submissionCount"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type Submission struct {
	ID           string     `gorm:"primaryKey;size:36" json:"id"`
	AssignmentID string     `gorm:"size:36;not null;index" json:"assignmentId"`
	StudentID    string     `gorm:"size:36;not null;index" json:"studentId"`
	StudentName  string     `gorm:"size:200" json:"studentName"`
	Content      string     `gorm:"type:text" json:"content"`
	FileURL      string     `gorm:"size:1000" json:"fileUrl"`
	Score        *float64  `json:"score"`
	Feedback     string     `gorm:"type:text" json:"feedback"`
	Status       string     `gorm:"size:20;default:SUBMITTED" json:"status"`
	GradedBy     string     `gorm:"size:36" json:"gradedBy"`
	SubmittedAt  time.Time  `json:"submittedAt"`
	GradedAt     *time.Time `json:"gradedAt"`
	CreatedAt    time.Time  `json:"createdAt"`
}

// AuditLog tracks assignment events.
type AuditLog struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	AssignmentID string    `gorm:"size:36;not null;index" json:"assignmentId"`
	SubmissionID string    `gorm:"size:36;index" json:"submissionId"`
	UserID       string    `gorm:"size:36;not null" json:"userId"`
	UserName     string    `gorm:"size:200" json:"userName"`
	Action       string    `gorm:"size:50;not null" json:"action"`
	Detail       string    `gorm:"type:text" json:"detail"`
	CreatedAt    time.Time `json:"createdAt"`
}
