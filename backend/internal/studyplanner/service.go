package studyplanner

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

func (s *Service) GetByDate(ctx context.Context, userID, date string) (*StudyPlan, error) {
	var plan StudyPlan
	err := s.db.WithContext(ctx).Where("user_id = ? AND date = ?", userID, date).First(&plan).Error
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (s *Service) Upsert(ctx context.Context, userID, date, planJSON string) (*StudyPlan, error) {
	var plan StudyPlan
	err := s.db.WithContext(ctx).Where("user_id = ? AND date = ?", userID, date).First(&plan).Error
	if err != nil {
		plan = StudyPlan{
			ID:     uuid.New().String(),
			UserID: userID,
			Date:   date,
			PlanJSON: planJSON,
		}
		if err := s.db.WithContext(ctx).Create(&plan).Error; err != nil {
			return nil, err
		}
		return &plan, nil
	}
	plan.PlanJSON = planJSON
	if err := s.db.WithContext(ctx).Model(&plan).Updates(map[string]interface{}{
		"plan_json": planJSON,
	}).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func (s *Service) UpdateCompletion(ctx context.Context, planID, taskID string, completed bool) (*StudyPlan, error) {
	var plan StudyPlan
	if err := s.db.WithContext(ctx).Where("id = ?", planID).First(&plan).Error; err != nil {
		return nil, err
	}

	completions := make(map[string]bool)
	if plan.CompletionJSON != "" {
		json.Unmarshal([]byte(plan.CompletionJSON), &completions)
	}
	completions[taskID] = completed
	data, _ := json.Marshal(completions)

	if err := s.db.WithContext(ctx).Model(&plan).Update("completion_json", string(data)).Error; err != nil {
		return nil, err
	}
	plan.CompletionJSON = string(data)
	return &plan, nil
}

func (s *Service) Reorder(ctx context.Context, planID, planJSON string) (*StudyPlan, error) {
	var plan StudyPlan
	if err := s.db.WithContext(ctx).Where("id = ?", planID).First(&plan).Error; err != nil {
		return nil, err
	}
	plan.PlanJSON = planJSON
	if err := s.db.WithContext(ctx).Model(&plan).Updates(map[string]interface{}{
		"plan_json":  planJSON,
		"updated_at": time.Now(),
	}).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func (s *Service) History(ctx context.Context, userID string, limit int) ([]StudyPlan, error) {
	if limit <= 0 {
		limit = 14
	}
	var plans []StudyPlan
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("date DESC").Limit(limit).Find(&plans).Error
	if plans == nil {
		plans = []StudyPlan{}
	}
	return plans, err
}
