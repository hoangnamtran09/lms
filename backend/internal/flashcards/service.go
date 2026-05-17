package flashcards

import (
	"context"
	"math"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func applySM2(card *Flashcard, quality int) {
	if quality >= 3 {
		card.Repetitions++
		switch card.Repetitions {
		case 1:
			card.Interval = 1
		case 2:
			card.Interval = 6
		default:
			card.Interval = int(math.Ceil(float64(card.Interval) * card.EaseFactor))
		}
		card.EaseFactor = card.EaseFactor + (0.1 - float64(5-quality)*(0.08+float64(5-quality)*0.02))
		if card.EaseFactor < 1.3 {
			card.EaseFactor = 1.3
		}
	} else {
		card.Repetitions = 0
		card.Interval = 1
	}
	card.NextReviewDate = time.Now().AddDate(0, 0, card.Interval)
}

func (s *Service) CreateDeck(ctx context.Context, userID, lessonID, title string, cards []Flashcard) (*FlashcardDeck, error) {
	deck := &FlashcardDeck{
		UserID:   userID,
		LessonID: lessonID,
		Title:    title,
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(deck).Error; err != nil {
			return err
		}
		now := time.Now()
		for i := range cards {
			cards[i].ID = ""
			cards[i].DeckID = deck.ID
			cards[i].EaseFactor = 2.5
			cards[i].Interval = 0
			cards[i].Repetitions = 0
			cards[i].NextReviewDate = now
		}
		return tx.Create(&cards).Error
	})
	if err != nil {
		return nil, err
	}
	return deck, nil
}

func (s *Service) ListDecks(ctx context.Context, userID string) ([]FlashcardDeck, error) {
	var decks []FlashcardDeck
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Find(&decks).Error
	if decks == nil {
		decks = []FlashcardDeck{}
	}
	return decks, err
}

func (s *Service) GetDeck(ctx context.Context, deckID, userID string) (*FlashcardDeck, []Flashcard, error) {
	var deck FlashcardDeck
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", deckID, userID).First(&deck).Error; err != nil {
		return nil, nil, err
	}
	now := time.Now()
	var cards []Flashcard
	if err := s.db.WithContext(ctx).Where("deck_id = ? AND next_review_date <= ?", deckID, now).Order("next_review_date ASC").Find(&cards).Error; err != nil {
		return nil, nil, err
	}
	if cards == nil {
		cards = []Flashcard{}
	}
	return &deck, cards, nil
}

func (s *Service) DeleteDeck(ctx context.Context, deckID, userID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("deck_id = ?", deckID).Delete(&Flashcard{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND user_id = ?", deckID, userID).Delete(&FlashcardDeck{}).Error
	})
}

func (s *Service) ReviewCard(ctx context.Context, cardID string, quality int) error {
	var card Flashcard
	if err := s.db.WithContext(ctx).Where("id = ?", cardID).First(&card).Error; err != nil {
		return err
	}
	applySM2(&card, quality)
	return s.db.WithContext(ctx).Save(&card).Error
}

func (s *Service) CountDue(ctx context.Context, deckID string) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&Flashcard{}).
		Where("deck_id = ? AND next_review_date <= ?", deckID, time.Now()).
		Count(&count).Error
	return count, err
}

func (s *Service) CountTotal(ctx context.Context, deckID string) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&Flashcard{}).Where("deck_id = ?", deckID).Count(&count).Error
	return count, err
}
