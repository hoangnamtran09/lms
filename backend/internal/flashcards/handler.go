package flashcards

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

type createDeckInput struct {
	LessonID string      `json:"lessonId"`
	Title    string      `json:"title"`
	Cards    []Flashcard `json:"cards"`
}

func (h *Handler) CreateDeck(w http.ResponseWriter, r *http.Request) {
	var req createDeckInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Title == "" || len(req.Cards) == 0 {
		jsonErr(w, "title và cards là bắt buộc", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	deck, err := h.service.CreateDeck(r.Context(), claims.UserID, req.LessonID, req.Title, req.Cards)
	if err != nil {
		jsonErr(w, "Lỗi tạo bộ thẻ: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, deck)
}

func (h *Handler) ListDecks(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	decks, err := h.service.ListDecks(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, "Lỗi lấy danh sách: "+err.Error(), http.StatusInternalServerError)
		return
	}

	type deckWithStats struct {
		FlashcardDeck
		DueCount   int64 `json:"dueCount"`
		TotalCards int64 `json:"totalCards"`
	}

	result := make([]deckWithStats, len(decks))
	for i, d := range decks {
		due, _ := h.service.CountDue(r.Context(), d.ID)
		total, _ := h.service.CountTotal(r.Context(), d.ID)
		result[i] = deckWithStats{
			FlashcardDeck: d,
			DueCount:      due,
			TotalCards:    total,
		}
	}

	jsonOk(w, result)
}

func (h *Handler) GetDeck(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	deckID := chi.URLParam(r, "id")
	deck, cards, err := h.service.GetDeck(r.Context(), deckID, claims.UserID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bộ thẻ", http.StatusNotFound)
		return
	}

	total, _ := h.service.CountTotal(r.Context(), deckID)

	jsonOk(w, map[string]interface{}{
		"deck":       deck,
		"cards":      cards,
		"totalCards": total,
	})
}

type reviewInput struct {
	CardID     string `json:"cardId"`
	Difficulty string `json:"difficulty"`
}

func (h *Handler) ReviewCard(w http.ResponseWriter, r *http.Request) {
	var req reviewInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	quality := 3
	switch req.Difficulty {
	case "easy":
		quality = 5
	case "medium":
		quality = 3
	case "hard":
		quality = 1
	default:
		jsonErr(w, "difficulty phải là easy, medium hoặc hard", http.StatusBadRequest)
		return
	}

	if err := h.service.ReviewCard(r.Context(), req.CardID, quality); err != nil {
		jsonErr(w, "Lỗi cập nhật thẻ: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"status": "ok"})
}

func (h *Handler) DeleteDeck(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	deckID := chi.URLParam(r, "id")
	if err := h.service.DeleteDeck(r.Context(), deckID, claims.UserID); err != nil {
		jsonErr(w, "Lỗi xoá bộ thẻ: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"status": "deleted"})
}

func jsonOk(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
