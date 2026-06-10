package ai

import (
	"encoding/json"
	"math"
	"net/http"

	"github.com/google/uuid"
)

func (h *Handler) Grade(w http.ResponseWriter, r *http.Request) {
	var req GradingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.aiService.GradeSubmission(req)
	if err != nil {
		jsonErr(w, "Grading failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, result)
}

// normalizeScores scales question scores so their total equals exactly 10.
func normalizeScores(questions []map[string]interface{}) {
	var total float64
	for _, q := range questions {
		if s, ok := q["score"].(float64); ok {
			total += s
		}
	}
	if total > 0 && math.Abs(total-10) > 0.01 {
		scale := 10 / total
		var roundedTotal float64
		for i := range questions {
			if s, ok := questions[i]["score"].(float64); ok {
				questions[i]["score"] = math.Round(s * scale)
				roundedTotal += questions[i]["score"].(float64)
			}
		}
		if d := 10 - roundedTotal; d != 0 {
			for i := range questions {
				if s, ok := questions[i]["score"].(float64); ok && s+d >= 0 {
					questions[i]["score"] = s + d
					break
				}
			}
		}
	}
}

// TestMatrix represents the MOET standard test matrix (ma trận đề).
type TestMatrix struct {
	Topics         []string                         `json:"topics"`
	Levels         []string                         `json:"levels"`
	Cells          map[string]map[string]MatrixCell `json:"cells"`
	TotalQuestions int                              `json:"totalQuestions"`
	TotalScore     int                              `json:"totalScore"`
	Purpose        string                           `json:"purpose"`
	Format         string                           `json:"format"`
}

// MatrixCell represents a cell in the test matrix.
type MatrixCell struct {
	QuestionCount int     `json:"questionCount"`
	Score         float64 `json:"score"`
}

type generateAssignmentInput struct {
	LessonID      string      `json:"lessonId"`
	QuestionCount int         `json:"questionCount"`
	QuestionType  string      `json:"questionType"` // "mcq", "open_ended", or "mixed"
	Matrix        *TestMatrix `json:"matrix,omitempty"`
}

func (h *Handler) GenerateAssignment(w http.ResponseWriter, r *http.Request) {
	var req generateAssignmentInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.LessonID == "" {
		jsonErr(w, "lessonId is required", http.StatusBadRequest)
		return
	}
	if req.QuestionCount <= 0 {
		req.QuestionCount = 5
	}
	if req.QuestionCount > 20 {
		req.QuestionCount = 20
	}
	if req.QuestionType == "" {
		req.QuestionType = "mixed"
	}

	var typeLabel string
	switch req.QuestionType {
	case "mcq":
		typeLabel = "trắc nghiệm (câu hỏi + 4 đáp án A/B/C/D)"
	case "open_ended":
		typeLabel = "tự luận (câu hỏi mở, yêu cầu suy luận)"
	default:
		typeLabel = "hỗn hợp trắc nghiệm và tự luận"
	}

	ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài học", http.StatusNotFound)
		return
	}

	var response string
	if req.Matrix != nil {
		response, err = h.aiService.GenerateMatrixAssignment(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description, req.QuestionCount, typeLabel, ctx_.GradeLevel, req.Matrix)
	} else {
		response, err = h.aiService.GenerateAssignment(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description, req.QuestionCount, typeLabel, ctx_.GradeLevel)
	}
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var questions []map[string]interface{}
	cleaned := extractJSON(response)
	if err := json.Unmarshal([]byte(cleaned), &questions); err != nil {
		jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	for i := range questions {
		questions[i]["id"] = uuid.New().String()
		if _, ok := questions[i]["expectedAnswer"]; !ok {
			questions[i]["expectedAnswer"] = ""
		}
		if _, ok := questions[i]["score"]; !ok {
			questions[i]["score"] = 10
		}
	}
	normalizeScores(questions)

	jsonOk(w, map[string]interface{}{
		"questions":    questions,
		"lessonTitle":  ctx_.LessonTitle,
		"subjectName":  ctx_.SubjectName,
		"questionType": req.QuestionType,
	})
}
