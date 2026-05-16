package assignments

import "time"

// Status workflow: ASSIGNED → SUBMITTED → GRADED → RETURNED → ACCEPTED
const (
	StatusAssigned  = "ASSIGNED"
	StatusSubmitted = "SUBMITTED"
	StatusGraded    = "GRADED"
	StatusReturned  = "RETURNED"
	StatusAccepted  = "ACCEPTED"
)

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
	Status           string    `gorm:"size:20;default:ASSIGNED" json:"status"`
	Source           string    `gorm:"size:20;default:teacher" json:"source"`
	AllowResubmit    bool      `gorm:"default:false" json:"allowResubmit"`
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
	Score        *int       `json:"score"`
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
