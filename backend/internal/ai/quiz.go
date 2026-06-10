package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
)

type extractQuestionsInput struct {
	Text string `json:"text"`
}

func (h *Handler) ExtractQuestions(w http.ResponseWriter, r *http.Request) {
	var req extractQuestionsInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		jsonErr(w, "text is required", http.StatusBadRequest)
		return
	}

	response, err := h.aiService.ExtractQuestions(req.Text)
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

	jsonOk(w, map[string]interface{}{"questions": questions})
}

type validateQuizInput struct {
	LessonID      string `json:"lessonId"`
	SubjectID     string `json:"subjectId"`
	SessionID     string `json:"sessionId"`
	Question      string `json:"question"`
	SelectedIndex int    `json:"selectedIndex"`
}

func (h *Handler) ValidateQuiz(w http.ResponseWriter, r *http.Request) {
	var req validateQuizInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	stored, ok := h.quizStore.Get(req.Question)
	if !ok {
		jsonErr(w, "Quiz not found or expired", http.StatusNotFound)
		return
	}

	if req.SelectedIndex < 0 || req.SelectedIndex >= len(stored.Options) {
		jsonErr(w, "Invalid selectedIndex", http.StatusBadRequest)
		return
	}

	isCorrect := stored.Options[req.SelectedIndex].IsCorrect
	result := map[string]interface{}{
		"isCorrect":   isCorrect,
		"explanation": stored.Explanation,
	}

	if isCorrect {
		if err := h.diamondService.Add(r.Context(), claims.UserID, 2, "Trả lời đúng quiz", req.LessonID); err == nil {
			result["diamondsEarned"] = 2
		}
		topic := stored.Question
		if len(topic) > 100 {
			topic = topic[:100]
		}
		if w, err := h.weaknessService.FindByUserAndTopic(r.Context(), claims.UserID, topic); err == nil {
			h.weaknessService.MarkImproved(r.Context(), w.ID)
		}
	} else {
		topic := stored.Question
		if len(topic) > 100 {
			topic = topic[:100]
		}
		h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic, "quiz", 1.0)
		result["weaknessRecorded"] = topic
	}

	jsonOk(w, result)
}

type completionQuizInput struct {
	LessonID      string `json:"lessonId"`
	SubjectID     string `json:"subjectId"`
	SessionID     string `json:"sessionId"`
	QuestionCount int    `json:"questionCount"`
}

func (h *Handler) CompletionQuiz(w http.ResponseWriter, r *http.Request) {
	var req completionQuizInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.QuestionCount <= 0 {
		req.QuestionCount = 5
	}
	if req.QuestionCount > 20 {
		req.QuestionCount = 20
	}

	var subjectName, lessonTitle, lessonContent string
	var gradeLevel int
	if req.LessonID != "" {
		if ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID); err == nil {
			subjectName = ctx_.SubjectName
			lessonTitle = ctx_.LessonTitle
			lessonContent = ctx_.Description
			gradeLevel = ctx_.GradeLevel
		}
	}

	prompt := BuildCompletionQuizPrompt(lessonTitle, subjectName, lessonContent, gradeLevel, req.QuestionCount)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là người tạo đề kiểm tra. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var quizResult struct {
		Questions []map[string]interface{} `json:"questions"`
	}
	if err := json.Unmarshal([]byte(extractJSON(response)), &quizResult); err != nil {
		jsonErr(w, "Lỗi parse kết quả: "+err.Error(), http.StatusInternalServerError)
		return
	}

	for _, q := range quizResult.Questions {
		question, _ := q["question"].(string)
		if question == "" {
			continue
		}
		explanation, _ := q["explanation"].(string)

		var options []QuizOption
		if opts, ok := q["options"].([]interface{}); ok {
			for _, opt := range opts {
				if m, ok2 := opt.(map[string]interface{}); ok2 {
					text, _ := m["text"].(string)
					isCorrect, _ := m["isCorrect"].(bool)
					options = append(options, QuizOption{Text: text, IsCorrect: isCorrect})
				}
			}
		}

		if len(options) > 0 {
			h.quizStore.Store(question, options, explanation)

			if opts, ok := q["options"].([]interface{}); ok {
				for _, opt := range opts {
					if m, ok2 := opt.(map[string]interface{}); ok2 {
						delete(m, "isCorrect")
					}
				}
			}
		}
	}

	jsonOk(w, quizResult)
}

type generateQuizRequest struct {
	LessonID string `json:"lessonId"`
	Count    int    `json:"count"`
}

func (h *Handler) GenerateQuiz(w http.ResponseWriter, r *http.Request) {
	var req generateQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Count <= 0 {
		req.Count = 5
	}
	if req.Count > 20 {
		req.Count = 20
	}

	lessonTitle := ""
	lessonContent := ""
	if req.LessonID != "" {
		if ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID); err == nil {
			lessonTitle = ctx_.LessonTitle
			lessonContent = ctx_.Description
		}
	}

	result, err := h.aiService.GenerateQuiz(lessonTitle, lessonContent, req.Count)
	if err != nil {
		jsonErr(w, "Quiz generation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var quiz []map[string]interface{}
	if err := json.Unmarshal([]byte(extractJSON(result)), &quiz); err != nil {
		jsonErr(w, "Failed to parse quiz: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, quiz)
}

type generateWeaknessQuizInput struct {
	Weaknesses  []weaknessRef `json:"weaknesses"`
	SubjectName string        `json:"subjectName"`
	LessonTitle string        `json:"lessonTitle"`
}

func (h *Handler) GenerateWeaknessQuiz(w http.ResponseWriter, r *http.Request) {
	var req generateWeaknessQuizInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Weaknesses) == 0 {
		jsonErr(w, "weaknesses is required", http.StatusBadRequest)
		return
	}
	if len(req.Weaknesses) > 10 {
		jsonErr(w, "Tối đa 10 điểm yếu mỗi lần", http.StatusBadRequest)
		return
	}

	// Build prompt: one question per weakness topic
	var topicList strings.Builder
	for i, w := range req.Weaknesses {
		topicList.WriteString(fmt.Sprintf("%d. %s\n", i+1, w.Topic))
	}

	prompt := fmt.Sprintf(`Tạo bài tập khắc phục cho học sinh. Có %d điểm yếu cần khắc phục:

%s
Mỗi điểm yếu cần ĐÚNG 1 câu hỏi trắc nghiệm (4 đáp án, 1 đúng). Trả về MẢNG JSON:

[
  {
    "question": "Câu hỏi về chủ đề?",
    "options": [
      {"text": "A. ...", "isCorrect": false},
      {"text": "B. ...", "isCorrect": true},
      {"text": "C. ...", "isCorrect": false},
      {"text": "D. ...", "isCorrect": false}
    ],
    "explanation": "Giải thích ngắn gọn tại sao đáp án đúng."
  },
  ...
]

Yêu cầu:
- Mảng JSON có ĐÚNG %d phần tử, tương ứng %d điểm yếu theo đúng thứ tự
- Mỗi câu hỏi tập trung vào chủ đề tương ứng
- Dùng $...$ cho công thức toán. Trong JSON escape: \\frac, \\sqrt, \\alpha
- Tiếng Việt, ngắn gọn, súc tích
- Chỉ trả về MẢNG JSON, không thêm text hay markdown.`,
		len(req.Weaknesses), topicList.String(), len(req.Weaknesses), len(req.Weaknesses))

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo đề. Chỉ trả về MẢNG JSON thuần, không markdown, không text ngoài JSON."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	cleaned := extractJSON(response)
	var questions []map[string]interface{}
	if err := json.Unmarshal([]byte(cleaned), &questions); err != nil {
		// Try wrapping in case AI added extra wrapping
		var wrapper map[string]interface{}
		if err2 := json.Unmarshal([]byte(cleaned), &wrapper); err2 == nil {
			for _, v := range wrapper {
				if arr, ok := v.([]interface{}); ok {
					for _, item := range arr {
						if m, ok := item.(map[string]interface{}); ok {
							questions = append(questions, m)
						}
					}
					break
				}
			}
		}
	}

	if len(questions) == 0 {
		jsonErr(w, "AI không tạo được câu hỏi. Vui lòng thử lại.", http.StatusInternalServerError)
		return
	}

	result := make([]map[string]interface{}, 0)
	for i, q := range questions {
		q["id"] = uuid.New().String()
		if i < len(req.Weaknesses) {
			q["weaknessId"] = req.Weaknesses[i].ID
			q["weaknessTopic"] = req.Weaknesses[i].Topic
		}
		result = append(result, q)
	}

	jsonOk(w, map[string]interface{}{"questions": result})
}
