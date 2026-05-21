package attendance

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

type Record struct {
	StudentID string `json:"studentId"`
	Status    string `json:"status"`
	Note      string `json:"note"`
}

func (s *Service) Mark(ctx context.Context, classID, date string, records []Record) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, r := range records {
			if r.Status == "" {
				r.Status = StatusPresent
			}
			var existingID string
			tx.Table("attendances").
				Where("class_id = ? AND date = ? AND student_id = ?", classID, date, r.StudentID).
				Select("id").Scan(&existingID)

			if existingID != "" {
				if err := tx.Model(&Attendance{}).
					Where("id = ?", existingID).
					Updates(map[string]interface{}{
						"status":     r.Status,
						"note":       r.Note,
						"updated_at": time.Now(),
					}).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Create(&Attendance{
					ID:        uuid.New().String(),
					ClassID:   classID,
					Date:      date,
					StudentID: r.StudentID,
					Status:    r.Status,
					Note:      r.Note,
				}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (s *Service) GetByClassAndDate(ctx context.Context, classID, date string) ([]Attendance, error) {
	var list []Attendance
	err := s.db.WithContext(ctx).
		Where("class_id = ? AND date = ?", classID, date).
		Find(&list).Error
	return list, err
}

func (s *Service) GetByStudent(ctx context.Context, studentID string) ([]Attendance, error) {
	var list []Attendance
	err := s.db.WithContext(ctx).
		Where("student_id = ?", studentID).
		Order("date DESC").
		Find(&list).Error
	return list, err
}
