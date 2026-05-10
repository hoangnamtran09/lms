package users

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	SupabaseID   string    `gorm:"size:36;uniqueIndex" json:"supabaseId"`
	Username     string    `gorm:"uniqueIndex;size:100" json:"username"`
	PasswordHash string    `gorm:"size:255" json:"-"`
	FullName     string    `gorm:"size:255;not null" json:"fullName"`
	Email        string    `gorm:"size:255" json:"email"`
	Role         string    `gorm:"size:20;not null;default:STUDENT" json:"role"`
	ClassID      string    `gorm:"size:36" json:"classId"`
	AvatarURL    string    `gorm:"size:500" json:"avatarUrl"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) FindByUsername(ctx context.Context, username string) (*User, error) {
	var user User
	err := s.db.WithContext(ctx).Where("username = ?", username).First(&user).Error
	return &user, err
}

func (s *Service) FindByID(ctx context.Context, id string) (*User, error) {
	var user User
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	return &user, err
}

func (s *Service) FindBySupabaseID(ctx context.Context, supabaseID string) (*User, error) {
	var user User
	err := s.db.WithContext(ctx).Where("supabase_id = ?", supabaseID).First(&user).Error
	return &user, err
}

func (s *Service) List(ctx context.Context, role string, classID string) ([]User, error) {
	var users []User
	q := s.db.WithContext(ctx)
	if role != "" {
		q = q.Where("role = ?", role)
	}
	if classID != "" {
		q = q.Where("class_id = ?", classID)
	}
	err := q.Find(&users).Error
	return users, err
}

func (s *Service) Create(ctx context.Context, user *User) error {
	return s.db.WithContext(ctx).Create(user).Error
}

func (s *Service) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&User{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&User{}).Error
}
