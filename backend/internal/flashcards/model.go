package flashcards

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FlashcardDeck struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	UserID    string    `gorm:"size:36;not null;index" json:"userId"`
	LessonID  string    `gorm:"size:36;index" json:"lessonId"`
	Title     string    `gorm:"size:500;not null" json:"title"`
	CreatedAt time.Time `json:"createdAt"`
}

func (d *FlashcardDeck) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}

type Flashcard struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	DeckID         string    `gorm:"size:36;not null;index" json:"deckId"`
	Question       string    `gorm:"type:text;not null" json:"question"`
	Answer         string    `gorm:"type:text;not null" json:"answer"`
	EaseFactor     float64   `gorm:"default:2.5" json:"easeFactor"`
	Interval       int       `gorm:"default:0" json:"interval"`
	Repetitions    int       `gorm:"default:0" json:"repetitions"`
	NextReviewDate time.Time `json:"nextReviewDate"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (c *Flashcard) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}
