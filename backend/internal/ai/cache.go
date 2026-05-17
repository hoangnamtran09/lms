package ai

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// AICache stores pre-generated AI content to save tokens.
// Key format: "mindmap:{lessonID}", "kg:{subjectID}", "flashcards:{lessonID}:{count}"
type AICache struct {
	Key       string    `gorm:"primaryKey;size:200" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	CreatedAt time.Time `json:"createdAt"`
}

type CacheService struct {
	db *gorm.DB
}

func NewCacheService(db *gorm.DB) *CacheService {
	return &CacheService{db: db}
}

func (s *CacheService) Get(ctx context.Context, key string) (string, bool) {
	var c AICache
	err := s.db.WithContext(ctx).Where("key = ?", key).First(&c).Error
	if err != nil {
		return "", false
	}
	return c.Value, true
}

func (s *CacheService) Set(ctx context.Context, key, value string) {
	c := AICache{Key: key, Value: value, CreatedAt: time.Now()}
	s.db.WithContext(ctx).Save(&c)
}

func mindmapCacheKey(lessonID string) string   { return "mindmap:" + lessonID }
func kgCacheKey(subjectID string) string       { return "kg:" + subjectID }
func flashcardsCacheKey(lessonID string, count int) string {
	return "flashcards:" + lessonID + ":" + itoa(count)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
