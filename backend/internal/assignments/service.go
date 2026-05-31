package assignments

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

// ScopeFilter limits queries by class or creator.
type ScopeFilter struct {
	UserID  string
	Role    string
	ClassID string
}

func (s *Service) List(ctx context.Context, scope ScopeFilter) ([]Assignment, error) {
	var list []Assignment
	q := s.db.WithContext(ctx)
	switch scope.Role {
	case "STUDENT":
		classID := scope.ClassID
		if classID == "" {
			// Look up classId from local users table by supabase_id
			var userClassID string
			s.db.WithContext(ctx).
				Table("users").
				Select("class_id").
				Where("supabase_id = ?", scope.UserID).
				Scan(&userClassID)
			classID = userClassID
		}
		// Show assignments where: (class-wide AND no student filter) OR (student is specifically selected)
		q = q.Where(
			"((class_id IN (?, '') AND (student_ids = '' OR student_ids IS NULL)) OR student_ids LIKE ?) AND status IN ?",
			classID, "%\""+scope.UserID+"\"%", []string{StatusAssigned, StatusReturned},
		)
	case "TEACHER":
		q = q.Where("creator_id = ?", scope.UserID)
	case "PARENT":
		q = q.Where("class_id = ?", scope.ClassID)
	}
	if err := q.Order("created_at DESC").Find(&list).Error; err != nil {
	return list, err
}
// Populate submission counts
if len(list) > 0 {
	ids := make([]string, len(list))
	for i, a := range list {
		ids[i] = a.ID
	}
	type countRow struct {
		AssignmentID string
		Count        int64
	}
	var counts []countRow
	s.db.WithContext(ctx).
		Table("submissions").
		Select("assignment_id, count(*) as count").
		Where("assignment_id IN ?", ids).
		Group("assignment_id").
		Scan(&counts)
	countMap := make(map[string]int64, len(counts))
	for _, c := range counts {
		countMap[c.AssignmentID] = c.Count
	}
	for i := range list {
		list[i].SubmissionCount = countMap[list[i].ID]
	}
}
return list, nil
}

func (s *Service) FindByID(ctx context.Context, id string) (*Assignment, error) {
	var a Assignment
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&a).Error
	return &a, err
}

func (s *Service) Create(ctx context.Context, a *Assignment) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&Assignment{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("assignment_id = ?", id).Delete(&AuditLog{}).Error; err != nil {
			return err
		}
		if err := tx.Where("assignment_id = ?", id).Delete(&Submission{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&Assignment{}).Error
	})
}

// --- Submissions ---

func (s *Service) Submit(ctx context.Context, sub *Submission) error {
	// Check for existing submission from this student for this assignment
	var count int64
	if err := s.db.WithContext(ctx).Model(&Submission{}).
		Where("assignment_id = ? AND student_id = ?", sub.AssignmentID, sub.StudentID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		// Check if assignment allows resubmission
		var assignment Assignment
		if err := s.db.WithContext(ctx).Where("id = ?", sub.AssignmentID).First(&assignment).Error; err != nil {
			return err
		}
		if !assignment.AllowResubmit {
			return fmt.Errorf("bạn đã nộp bài tập này rồi")
		}
	}
	sub.Status = StatusSubmitted
	sub.SubmittedAt = time.Now()
	return s.db.WithContext(ctx).Create(sub).Error
}

func (s *Service) ListSubmissionsByAssignment(ctx context.Context, assignmentID string) ([]Submission, error) {
	var subs []Submission
	err := s.db.WithContext(ctx).
		Where("assignment_id = ?", assignmentID).
		Order("submitted_at DESC").
		Find(&subs).Error
	return subs, err
}

func (s *Service) ListSubmissionsByStudent(ctx context.Context, studentID string) ([]Submission, error) {
	var subs []Submission
	err := s.db.WithContext(ctx).
		Where("student_id = ?", studentID).
		Order("submitted_at DESC").
		Find(&subs).Error
	return subs, err
}

type GradeRow struct {
	ID             string     `json:"id"`
	AssignmentID   string     `json:"assignmentId"`
	AssignmentTitle string    `json:"assignmentTitle"`
	MaxScore       int        `json:"maxScore"`
	Score          *int       `json:"score"`
	Status         string     `json:"status"`
	Feedback       string     `json:"feedback"`
	SubmittedAt    time.Time  `json:"submittedAt"`
	GradedAt       *time.Time `json:"gradedAt"`
}

func (s *Service) GetMyGrades(ctx context.Context, studentID string) ([]GradeRow, error) {
	var rows []GradeRow
	err := s.db.WithContext(ctx).
		Table("submissions").
		Select(`submissions.id, submissions.assignment_id,
			COALESCE(assignments.title, 'Đã xoá') as assignment_title,
			assignments.max_score, submissions.score,
			submissions.status, submissions.feedback,
			submissions.submitted_at, submissions.graded_at`).
		Joins("LEFT JOIN assignments ON assignments.id = submissions.assignment_id").
		Where("submissions.student_id = ?", studentID).
		Order("submissions.submitted_at DESC").
		Scan(&rows).Error
	return rows, err
}

func (s *Service) FindSubmission(ctx context.Context, id string) (*Submission, error) {
	var sub Submission
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&sub).Error
	return &sub, err
}

func (s *Service) GradeSubmission(ctx context.Context, submissionID string, score int, feedback, gradedBy string) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&Submission{}).Where("id = ?", submissionID).Updates(map[string]interface{}{
		"score":    score,
		"feedback": feedback,
		"graded_by": gradedBy,
		"graded_at": &now,
		"status":   StatusGraded,
	}).Error
}

func (s *Service) ReturnSubmission(ctx context.Context, submissionID string) error {
	return s.db.WithContext(ctx).Model(&Submission{}).Where("id = ?", submissionID).Update("status", StatusReturned).Error
}

// --- Audit ---

func (s *Service) LogAudit(ctx context.Context, log *AuditLog) error {
	return s.db.WithContext(ctx).Create(log).Error
}

func (s *Service) AuditTrail(ctx context.Context, assignmentID string) ([]AuditLog, error) {
	var logs []AuditLog
	err := s.db.WithContext(ctx).
		Where("assignment_id = ?", assignmentID).
		Order("created_at DESC").
		Find(&logs).Error
	return logs, err
}

// CanGrade checks if the teacher owns the assignment for this submission.
func (s *Service) CanGrade(ctx context.Context, submissionID, teacherID string) (bool, error) {
	var sub Submission
	if err := s.db.WithContext(ctx).Where("id = ?", submissionID).First(&sub).Error; err != nil {
		return false, err
	}
	var a Assignment
	if err := s.db.WithContext(ctx).Where("id = ? AND creator_id = ?", sub.AssignmentID, teacherID).First(&a).Error; err != nil {
		return false, fmt.Errorf("not authorized to grade this submission")
	}
	return true, nil
}
