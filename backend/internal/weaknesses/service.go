package weaknesses

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WeaknessProfile struct {
	ID                   string     `gorm:"primaryKey;size:36" json:"id"`
	UserID               string     `gorm:"size:36;not null;index" json:"userId"`
	LessonID             string     `gorm:"size:36" json:"lessonId"`
	Topic                string     `gorm:"size:500;not null" json:"topic"`
	Source               string     `gorm:"size:20;default:quiz" json:"source"`
	Weight               float64    `gorm:"default:1" json:"weight"`
	ErrorCount           int        `gorm:"default:0" json:"errorCount"`
	QuizAttempts         int        `gorm:"default:0" json:"quizAttempts"`
	QuizCorrect          int        `gorm:"default:0" json:"quizCorrect"`
	LastErrorAt          *time.Time `json:"lastErrorAt"`
	RemediationExercises string     `gorm:"type:text" json:"remediationExercises"`
	ImprovementScore     int        `gorm:"default:0" json:"improvementScore"`
	Resolved             bool       `gorm:"default:false" json:"resolved"`
	ResolvedAt           *time.Time `json:"resolvedAt"`
	CoachNotes           string     `gorm:"type:text" json:"coachNotes"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) ListByUser(ctx context.Context, userID string) ([]WeaknessProfile, error) {
	var profiles []WeaknessProfile
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("updated_at DESC").Find(&profiles).Error
	if profiles == nil {
		profiles = []WeaknessProfile{}
	}
	return profiles, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*WeaknessProfile, error) {
	var profile WeaknessProfile
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&profile).Error
	return &profile, err
}

func (s *Service) RecordError(ctx context.Context, userID, lessonID, topic, source string, weight float64) error {
	now := time.Now()
	var existing WeaknessProfile
	err := s.db.WithContext(ctx).Where("user_id = ? AND topic = ?", userID, topic).First(&existing).Error
	if err != nil {
		w := &WeaknessProfile{
			ID:          uuid.New().String(),
			UserID:      userID,
			LessonID:    lessonID,
			Topic:       topic,
			Source:      source,
			Weight:      weight,
			ErrorCount:  1,
			LastErrorAt: &now,
		}
		if source == "quiz" {
			w.QuizAttempts = 1
		}
		return s.db.WithContext(ctx).Create(w).Error
	}
	existing.ErrorCount++
	existing.Weight += weight
	existing.LastErrorAt = &now
	// Update source if new weight tier is higher than current source
	if sourceWeightPriority(source) > sourceWeightPriority(existing.Source) {
		existing.Source = source
	}
	if source == "quiz" {
		existing.QuizAttempts++
	}
	return s.db.WithContext(ctx).Save(&existing).Error
}

func sourceWeightPriority(source string) int {
	switch source {
	case "profile":
		return 3
	case "quiz":
		return 2
	case "exercise":
		return 1
	case "chat":
		return 1
	case "progress":
		return 0
	}
	return -1
}

// UpdateQuizStats increments quiz tracking counters for the weakness (correct or wrong).
// Creates the weakness profile lazily if it doesn't exist yet.
func (s *Service) UpdateQuizStats(ctx context.Context, userID, lessonID, topic string, correct bool) (*WeaknessProfile, error) {
	now := time.Now()
	var existing WeaknessProfile
	err := s.db.WithContext(ctx).Where("user_id = ? AND topic = ?", userID, topic).First(&existing).Error
	if err != nil {
		w := &WeaknessProfile{
			ID:           uuid.New().String(),
			UserID:       userID,
			LessonID:     lessonID,
			Topic:        topic,
			Source:       "quiz",
			QuizAttempts: 1,
		}
		if correct {
			w.QuizCorrect = 1
		}
		w.LastErrorAt = &now
		if err2 := s.db.WithContext(ctx).Create(w).Error; err2 != nil {
			return nil, err2
		}
		return w, nil
	}
	existing.QuizAttempts++
	if correct {
		existing.QuizCorrect++
	}
	if !correct {
		existing.LastErrorAt = &now
	}
	if err2 := s.db.WithContext(ctx).Save(&existing).Error; err2 != nil {
		return nil, err2
	}
	return &existing, nil
}

func (s *Service) AddRemediation(ctx context.Context, id, exercises string) error {
	return s.db.WithContext(ctx).Model(&WeaknessProfile{}).Where("id = ?", id).Updates(map[string]interface{}{
		"remediation_exercises": exercises,
	}).Error
}

func (s *Service) UpdateCoachNotes(ctx context.Context, id, notes string) error {
	return s.db.WithContext(ctx).Model(&WeaknessProfile{}).Where("id = ?", id).Update("coach_notes", notes).Error
}

func (s *Service) MarkImproved(ctx context.Context, id string) error {
	// Increment improvement_score, then check if threshold reached (>=3) → auto-resolve
	if err := s.db.WithContext(ctx).Model(&WeaknessProfile{}).Where("id = ?", id).
		Update("improvement_score", gorm.Expr("improvement_score + 1")).Error; err != nil {
		return err
	}
	// Auto-resolve when improvement reaches threshold
	now := time.Now()
	return s.db.WithContext(ctx).Model(&WeaknessProfile{}).
		Where("id = ? AND improvement_score >= 3 AND resolved = false", id).
		Updates(map[string]interface{}{"resolved": true, "resolved_at": &now}).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&WeaknessProfile{}).Error
}

// ClassTopicSummary represents aggregated weakness data for a topic within a class.
type ClassTopicSummary struct {
	Topic        string   `json:"topic"`
	TotalErrors  int      `json:"totalErrors"`
	StudentCount int      `json:"studentCount"`
	StudentIDs   []string `json:"studentIds"`
}

// ClassSummary returns unresolved weakness topics aggregated across a class, sorted by severity.
func (s *Service) ClassSummary(ctx context.Context, classID string) ([]ClassTopicSummary, error) {
	type row struct {
		Topic        string
		TotalErrors  int
		StudentCount int
		StudentIDs   string
	}

	var rows []row
	err := s.db.WithContext(ctx).
		Table("weakness_profiles w").
		Select("w.topic, SUM(w.error_count) as total_errors, COUNT(DISTINCT w.user_id) as student_count, STRING_AGG(DISTINCT w.user_id, ',') as student_ids").
		Joins("JOIN users u ON u.supabase_id = w.user_id AND u.class_id = ?", classID).
		Where("w.resolved = false").
		Group("w.topic").
		Order("total_errors DESC").
		Limit(10).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]ClassTopicSummary, 0, len(rows))
	for _, r := range rows {
		studentIDs := strings.Split(r.StudentIDs, ",")
		if len(studentIDs) == 1 && studentIDs[0] == "" {
			studentIDs = nil
		}
		result = append(result, ClassTopicSummary{
			Topic:        r.Topic,
			TotalErrors:  r.TotalErrors,
			StudentCount: int(r.StudentCount),
			StudentIDs:   studentIDs,
		})
	}
	return result, nil
}

// FindStudentIDsByClassAndTopic returns supabase IDs of students in a class who have an unresolved weakness for the given topic.
func (s *Service) FindStudentIDsByClassAndTopic(ctx context.Context, classID, topic string) ([]string, error) {
	var ids []string
	err := s.db.WithContext(ctx).
		Table("weakness_profiles w").
		Select("DISTINCT w.user_id").
		Joins("JOIN users u ON u.supabase_id = w.user_id AND u.class_id = ?", classID).
		Where("w.topic = ? AND w.resolved = false", topic).
		Pluck("w.user_id", &ids).Error
	if err != nil {
		return nil, err
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}

// FindByUserAndTopic returns the first weakness matching userID + topic (fuzzy match on topic prefix).
func (s *Service) FindByUserAndTopic(ctx context.Context, userID, topic string) (*WeaknessProfile, error) {
	var profile WeaknessProfile
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND topic = ?", userID, topic).
		First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}
