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
		q = q.Where("class_id = ? AND status IN ?", scope.ClassID, []string{StatusAssigned, StatusReturned})
	case "TEACHER":
		q = q.Where("creator_id = ?", scope.UserID)
	case "PARENT":
		q = q.Where("class_id = ?", scope.ClassID)
	}
	return list, q.Order("created_at DESC").Find(&list).Error
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
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&Assignment{}).Error
}

// --- Submissions ---

func (s *Service) Submit(ctx context.Context, sub *Submission) error {
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

func (s *Service) FindSubmission(ctx context.Context, id string) (*Submission, error) {
	var sub Submission
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&sub).Error
	return &sub, err
}

func (s *Service) GradeSubmission(ctx context.Context, submissionID string, score int, feedback, gradedBy string) error {
	now := time.Now()
	if err := s.db.WithContext(ctx).Model(&Submission{}).Where("id = ?", submissionID).Updates(map[string]interface{}{
		"score":    score,
		"feedback": feedback,
		"graded_by": gradedBy,
		"graded_at": &now,
		"status":   StatusGraded,
	}).Error; err != nil {
		return err
	}
	// Mark assignment status for this student
	var sub Submission
	if err := s.db.WithContext(ctx).Where("id = ?", submissionID).First(&sub).Error; err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(&Assignment{}).Where("id = ?", sub.AssignmentID).Update("status", StatusGraded).Error
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
