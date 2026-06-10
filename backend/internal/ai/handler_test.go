package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestHandler() *Handler {
	return &Handler{
		quizStore: NewQuizStore(),
	}
}

func TestGrade_InvalidBody(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest("POST", "/api/ai/grade", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.Grade(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["error"] == "" {
		t.Error("expected error message in response")
	}
}

func TestGrade_EmptyBody(t *testing.T) {
	t.Skip("Grade handler requires AI service mock — skipping integration test")
}

func TestJsonOk(t *testing.T) {
	rec := httptest.NewRecorder()
	jsonOk(rec, map[string]string{"status": "ok"})

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["status"] != "ok" {
		t.Errorf("expected status ok, got %s", resp["status"])
	}
}

func TestJsonErr(t *testing.T) {
	rec := httptest.NewRecorder()
	jsonErr(rec, "something went wrong", http.StatusInternalServerError)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", rec.Code)
	}

	var resp map[string]string
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["error"] != "something went wrong" {
		t.Errorf("expected error message, got %s", resp["error"])
	}
}

func TestExtractQuestions_InvalidBody(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest("POST", "/api/ai/extract-questions", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ExtractQuestions(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}

func TestValidateQuiz_InvalidBody(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest("POST", "/api/ai/validate-quiz", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.ValidateQuiz(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}

func TestCompletionQuiz_InvalidBody(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest("POST", "/api/ai/completion-quiz", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.CompletionQuiz(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}

func TestGenerateWeaknessQuiz_InvalidBody(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest("POST", "/api/ai/generate-weakness-quiz", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.GenerateWeaknessQuiz(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}

func TestSummarizeWeaknesses_InvalidBody(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest("POST", "/api/ai/summarize-weaknesses", strings.NewReader("bad"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.SummarizeWeaknesses(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}
