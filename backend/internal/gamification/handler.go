package gamification

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	diamonds *DiamondService
	streaks  *StreakService
}

func NewHandler(diamonds *DiamondService, streaks *StreakService) *Handler {
	return &Handler{diamonds: diamonds, streaks: streaks}
}

// --- Diamonds ---

func (h *Handler) DiamondBalance(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	balance, err := h.diamonds.Balance(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]int{"balance": balance})
}

func (h *Handler) DiamondHistory(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	txs, err := h.diamonds.History(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if txs == nil {
		txs = []DiamondTransaction{}
	}
	jsonOk(w, txs)
}

func (h *Handler) EarnOnStudyComplete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var req struct {
		DurationSeconds int    `json:"durationSeconds"`
		LessonID        string `json:"lessonId"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Earn 1 diamond per 5 minutes of study, minimum 1
	diamonds := req.DurationSeconds / 300
	if diamonds < 1 {
		diamonds = 1
	}
	if diamonds > 10 {
		diamonds = 10
	}

	if err := h.diamonds.Add(r.Context(), claims.UserID, diamonds, "study", req.LessonID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Update streak
	if err := h.streaks.RecordStudy(r.Context(), claims.UserID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	streak, _ := h.streaks.Get(r.Context(), claims.UserID)
	balance, _ := h.diamonds.Balance(r.Context(), claims.UserID)

	jsonOk(w, map[string]interface{}{
		"diamondsEarned": diamonds,
		"balance":        balance,
		"currentStreak":  streak.CurrentStreak,
		"longestStreak":  streak.LongestStreak,
	})
}

// --- Streaks ---

func (h *Handler) StreakInfo(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	streak, err := h.streaks.Get(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, streak)
}

// --- Admin: Award diamonds ---

func (h *Handler) AwardDiamonds(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID string `json:"userId"`
		Amount int    `json:"amount"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if err := h.diamonds.Add(r.Context(), req.UserID, req.Amount, req.Reason, uuid.New().String()); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "ok"})
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
