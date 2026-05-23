package ai

import (
	"sync"
	"time"
)

type QuizOption struct {
	Text      string `json:"text"`
	IsCorrect bool   `json:"isCorrect"`
}

type StoredQuiz struct {
	Question    string       `json:"question"`
	Options     []QuizOption `json:"options"`
	Explanation string       `json:"explanation"`
}

type quizEntry struct {
	data    StoredQuiz
	expires time.Time
}

type QuizStore struct {
	mu    sync.RWMutex
	items map[string]*quizEntry
	ttl   time.Duration
}

func NewQuizStore() *QuizStore {
	qs := &QuizStore{
		items: make(map[string]*quizEntry),
		ttl:   30 * time.Minute,
	}
	go qs.cleanup(5 * time.Minute)
	return qs
}

func (qs *QuizStore) Store(question string, options []QuizOption, explanation string) string {
	qs.mu.Lock()
	qs.items[question] = &quizEntry{
		data: StoredQuiz{
			Question:    question,
			Options:     options,
			Explanation: explanation,
		},
		expires: time.Now().Add(qs.ttl),
	}
	qs.mu.Unlock()
	return question
}

func (qs *QuizStore) Get(key string) (StoredQuiz, bool) {
	qs.mu.RLock()
	entry, ok := qs.items[key]
	qs.mu.RUnlock()
	if !ok {
		return StoredQuiz{}, false
	}
	if time.Now().After(entry.expires) {
		qs.mu.Lock()
		delete(qs.items, key)
		qs.mu.Unlock()
		return StoredQuiz{}, false
	}
	return entry.data, true
}

func (qs *QuizStore) cleanup(interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		now := time.Now()
		qs.mu.Lock()
		for k, v := range qs.items {
			if now.After(v.expires) {
				delete(qs.items, k)
			}
		}
		qs.mu.Unlock()
	}
}
