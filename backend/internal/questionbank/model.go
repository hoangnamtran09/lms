package questionbank

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type QuestionBank struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	Question       string    `gorm:"type:text;not null" json:"question"`
	Answer         string    `gorm:"type:text" json:"answer"`
	Topic          string    `gorm:"size:500" json:"topic"`
	SubjectID      string    `gorm:"size:36;index" json:"subjectId"`
	CognitiveLevel string    `gorm:"size:30;index" json:"cognitiveLevel"`
	QuestionType   string    `gorm:"size:30" json:"questionType"`
	Options        string    `gorm:"type:text" json:"options"`
	Explanation    string    `gorm:"type:text" json:"explanation"`
	Score          float64   `json:"score"`
	CreatedBy      string    `gorm:"size:36;not null;index" json:"createdBy"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (q *QuestionBank) BeforeCreate(tx *gorm.DB) error {
	if q.ID == "" {
		q.ID = uuid.New().String()
	}
	return nil
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

type ListFilter struct {
	SubjectID      string
	Topic          string
	CognitiveLevel string
	QuestionType   string
	Search         string
	CreatedBy      string
	Limit          int
	Offset         int
}

func (s *Service) List(ctx context.Context, filter ListFilter) ([]QuestionBank, int64, error) {
	var items []QuestionBank
	var total int64

	q := s.db.WithContext(ctx).Model(&QuestionBank{})
	if filter.SubjectID != "" {
		q = q.Where("subject_id = ?", filter.SubjectID)
	}
	if filter.Topic != "" {
		q = q.Where("topic = ?", filter.Topic)
	}
	if filter.CognitiveLevel != "" {
		q = q.Where("cognitive_level = ?", filter.CognitiveLevel)
	}
	if filter.QuestionType != "" {
		q = q.Where("question_type = ?", filter.QuestionType)
	}
	if filter.CreatedBy != "" {
		q = q.Where("created_by = ?", filter.CreatedBy)
	}
	if filter.Search != "" {
		search := "%" + filter.Search + "%"
		q = q.Where("question ILIKE ? OR topic ILIKE ?", search, search)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if filter.Limit > 0 {
		q = q.Limit(filter.Limit).Offset(filter.Offset)
	}

	err := q.Order("created_at DESC").Find(&items).Error
	if items == nil {
		items = []QuestionBank{}
	}
	return items, total, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*QuestionBank, error) {
	var m QuestionBank
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *Service) Create(ctx context.Context, m *QuestionBank) error {
	return s.db.WithContext(ctx).Create(m).Error
}

func (s *Service) BatchCreate(ctx context.Context, items []QuestionBank) error {
	if len(items) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Create(&items).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&QuestionBank{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&QuestionBank{}).Error
}

func (s *Service) GetTopics(ctx context.Context, subjectID string) ([]string, error) {
	var topics []string
	q := s.db.WithContext(ctx).Model(&QuestionBank{}).Distinct("topic").Order("topic")
	if subjectID != "" {
		q = q.Where("subject_id = ?", subjectID)
	}
	err := q.Pluck("topic", &topics).Error
	if topics == nil {
		topics = []string{}
	}
	return topics, err
}
