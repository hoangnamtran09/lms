package weaknesses

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WeaknessProfile struct {
	ID                   string     `gorm:"primaryKey;size:36" json:"id"`
	UserID               string     `gorm:"size:36;not null;index" json:"userId"`
	LessonID             string     `gorm:"size:36" json:"lessonId"`
	Topic                string     `gorm:"size:500;not null" json:"topic"`
	ErrorCount           int        `gorm:"default:0" json:"errorCount"`
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

func (s *Service) RecordError(ctx context.Context, userID, lessonID, topic string) error {
	var existing WeaknessProfile
	err := s.db.WithContext(ctx).Where("user_id = ? AND topic = ?", userID, topic).First(&existing).Error
	if err != nil {
		now := time.Now()
		return s.db.WithContext(ctx).Create(&WeaknessProfile{
			ID:          uuid.New().String(),
			UserID:      userID,
			LessonID:    lessonID,
			Topic:       topic,
			ErrorCount:  1,
			LastErrorAt: &now,
		}).Error
	}
	now := time.Now()
	existing.ErrorCount++
	existing.LastErrorAt = &now
	return s.db.WithContext(ctx).Save(&existing).Error
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

func (s *Service) Resolve(ctx context.Context, id string) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&WeaknessProfile{}).Where("id = ?", id).
		Updates(map[string]interface{}{"resolved": true, "resolved_at": &now}).Error
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
