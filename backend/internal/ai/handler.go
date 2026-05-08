package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/lms/backend/internal/gamification"
	"github.com/lms/backend/internal/lessons"
	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/weaknesses"
)

type Handler struct {
	aiService       *Service
	lessonService   *lessons.Service
	weaknessService *weaknesses.Service
	diamondService  *gamification.DiamondService
}

func NewHandler(aiSvc *Service, lessonSvc *lessons.Service, weaknessSvc *weaknesses.Service, diamondSvc *gamification.DiamondService) *Handler {
	return &Handler{aiService: aiSvc, lessonService: lessonSvc, weaknessService: weaknessSvc, diamondService: diamondSvc}
}

type chatInput struct {
	Message   string `json:"message"`
	LessonID  string `json:"lessonId"`
	SessionID string `json:"sessionId"`
}

func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	var req chatInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Message == "" {
		jsonErr(w, "message is required", http.StatusBadRequest)
		return
	}

	// Build system prompt with lesson context and weaknesses
	var subjectName, lessonTitle, lessonContent string
	var gradeLevel int
	if req.LessonID != "" {
		if ctx, err := h.lessonService.GetContext(r.Context(), req.LessonID); err == nil {
			subjectName = ctx.SubjectName
			lessonTitle = ctx.LessonTitle
			lessonContent = ctx.Description
			gradeLevel = ctx.GradeLevel
		}
	}

	claims := middleware.GetClaims(r.Context())
	var weakList []string
	if claims != nil {
		profiles, err := h.weaknessService.ListByUser(r.Context(), claims.UserID)
		if err == nil {
			for _, p := range profiles {
				weakList = append(weakList, fmt.Sprintf("%s (lỗi %d lần)", p.Topic, p.ErrorCount))
			}
		}
	}

	systemPrompt := BuildSystemPrompt(subjectName, lessonTitle, lessonContent, gradeLevel, weakList)

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonErr(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	err := h.aiService.ChatStream([]ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: req.Message},
	}, func(text string) {
		data, _ := json.Marshal(map[string]string{"delta": text})
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}, func() {
		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	})

	if err != nil {
		fmt.Fprintf(w, "data: {\"error\":\"%s\"}\n\n", err.Error())
		flusher.Flush()
	}
}

// ---- Quiz Answer ----

type quizAnswerInput struct {
	LessonID string `json:"lessonId"`
	Correct  bool   `json:"correct"`
	Topic    string `json:"topic"`
}

func (h *Handler) QuizAnswer(w http.ResponseWriter, r *http.Request) {
	var req quizAnswerInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	result := map[string]interface{}{}

	if req.Correct {
		// Award +2 diamonds
		if err := h.diamondService.Add(r.Context(), claims.UserID, 2, "Trả lời đúng quiz", req.LessonID); err == nil {
			result["diamondsEarned"] = 2
		}
		// Mark improvement on matching weakness
		if req.Topic != "" {
			if w, err := h.weaknessService.FindByUserAndTopic(r.Context(), claims.UserID, req.Topic); err == nil {
				h.weaknessService.MarkImproved(r.Context(), w.ID)
			}
		}
	} else {
		// Record weakness signal
		topic := req.Topic
		if topic == "" {
			if ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID); err == nil {
				topic = ctx_.LessonTitle
			}
		}
		if topic != "" {
			h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic)
		}
		result["weaknessRecorded"] = topic
	}

	jsonOk(w, result)
}

// ---- Generate Exercise ----

type generateExerciseInput struct {
	LessonID string `json:"lessonId"`
}

func (h *Handler) GenerateExercise(w http.ResponseWriter, r *http.Request) {
	var req generateExerciseInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
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

	prompt := BuildExercisePrompt(subjectName, lessonTitle, lessonContent, gradeLevel)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo bài tập. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var exercise map[string]interface{}
	if err := json.Unmarshal([]byte(extractJSON(response)), &exercise); err != nil {
		jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, exercise)
}

// ---- Grade Exercise ----

type gradeExerciseInput struct {
	Question   string `json:"question"`
	UserAnswer string `json:"userAnswer"`
	LessonID   string `json:"lessonId"`
}

func (h *Handler) GradeExercise(w http.ResponseWriter, r *http.Request) {
	var req gradeExerciseInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	prompt := BuildExerciseGraderPrompt(req.Question, req.UserAnswer)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên chấm bài. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var result struct {
		Score          int    `json:"score"`
		Feedback       string `json:"feedback"`
		IsPassed       bool   `json:"isPassed"`
		DiamondsEarned int    `json:"diamondsEarned"`
	}
	if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {
		jsonErr(w, "Lỗi parse kết quả: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Award diamonds if passed
	if result.IsPassed && result.DiamondsEarned > 0 {
		h.diamondService.Add(r.Context(), claims.UserID, result.DiamondsEarned, "Hoàn thành bài tập", req.LessonID)
	}

	// Record weakness if score < 50
	if result.Score < 50 {
		topic := ""
		if ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID); err == nil {
			topic = ctx_.LessonTitle
		}
		if topic != "" {
			h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic)
		}
	}

	jsonOk(w, result)
}

// ---- Completion Quiz ----

type completionQuizInput struct {
	LessonID      string `json:"lessonId"`
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

	var result struct {
		Questions []map[string]interface{} `json:"questions"`
	}
	if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {
		jsonErr(w, "Lỗi parse kết quả: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, result)
	}

	// ---- Learning Coach ----

type coachInput struct {
	StreakDays        int     `json:"streakDays"`
	CompletedLessons  int     `json:"completedLessons"`
	TotalLessons      int     `json:"totalLessons"`
	AvgQuizScore      float64 `json:"avgQuizScore"`
}

func (h *Handler) Coach(w http.ResponseWriter, r *http.Request) {
	var req coachInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
	weakTopics := ""
	for _, p := range profiles {
		if p.ErrorCount > 0 {
			weakTopics += fmt.Sprintf("%s (%d lỗi), ", p.Topic, p.ErrorCount)
		}
	}
	if weakTopics == "" {
		weakTopics = "Chưa có chủ đề yếu"
	}

	prompt := BuildCoachPrompt(req.StreakDays, req.CompletedLessons, req.TotalLessons, req.AvgQuizScore, weakTopics)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là huấn luyện viên học tập. Trả lời bằng tiếng Việt, giọng tích cực, xưng 'mình' gọi 'bạn'."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"coachMessage": response})
}

// ---- Lesson Summary ----

type lessonSummaryInput struct {
	LessonID string `json:"lessonId"`
}

func (h *Handler) LessonSummary(w http.ResponseWriter, r *http.Request) {
	var req lessonSummaryInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.LessonID == "" {
		jsonErr(w, "lessonId is required", http.StatusBadRequest)
		return
	}

	ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài học", http.StatusNotFound)
		return
	}

	prompt := BuildLessonSummaryPrompt(ctx_.SubjectName, ctx_.LessonTitle, ctx_.Description, ctx_.GradeLevel)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý tóm tắt bài học. Trả lời ngắn gọn bằng tiếng Việt, không dùng markdown."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{
		"summary":    response,
		"lessonTitle": ctx_.LessonTitle,
		"subjectName": ctx_.SubjectName,
	})
}

// ---- Existing: Grade submission ----

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

// ---- Existing: Generate Quiz (classic) ----

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

// ---- Existing: Roadmap ----

type roadmapRequest struct {
	SubjectID string `json:"subjectId"`
}

func (h *Handler) Roadmap(w http.ResponseWriter, r *http.Request) {
	var req roadmapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
	weaknessText := ""
	for _, p := range profiles {
		weaknessText += fmt.Sprintf("- %s (sai %d lần)\n", p.Topic, p.ErrorCount)
	}

	prompt := fmt.Sprintf(`Dựa trên các điểm yếu sau đây của học sinh, hãy tạo một lộ trình học tập cá nhân hoá:

%s

Tạo lộ trình gồm 3-5 bước. Với mỗi bước:
- Tiêu đề bước
- Mô tả ngắn gọn cần làm gì
- Thời gian ước tính

Trả về JSON: [{"step": 1, "title": "...", "description": "...", "estimatedMinutes": 30}]`, weaknessText)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là cố vấn học tập. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Roadmap generation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var roadmap []map[string]interface{}
	if err := json.Unmarshal([]byte(extractJSON(response)), &roadmap); err != nil {
		jsonErr(w, "Failed to parse roadmap: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, roadmap)
}

// ---- Existing: Generate Remediation ----

type remediationRequest struct {
	WeaknessID string `json:"weaknessId"`
}

func (h *Handler) GenerateRemediation(w http.ResponseWriter, r *http.Request) {
	var req remediationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	profile, err := h.weaknessService.FindByID(r.Context(), req.WeaknessID)
	if err != nil {
		jsonErr(w, "Không tìm thấy điểm yếu", http.StatusNotFound)
		return
	}

	prompt := fmt.Sprintf(`Học sinh đang gặp khó khăn với chủ đề: "%s"
	Số lần mắc lỗi: %d

	Tạo 3-4 bài tập GIÚP HỌC SINH CẢI THIỆN. Kết hợp cả trắc nghiệm và câu trả lời ngắn:

	- Nếu là trắc nghiệm (phù hợp kiểm tra kiến thức):
	  {"type": "mcq", "question": "...", "options": [{"text": "Đáp án A", "isCorrect": false}, {"text": "Đáp án B", "isCorrect": true}, {"text": "Đáp án C", "isCorrect": false}, {"text": "Đáp án D", "isCorrect": false}], "explanation": "Giải thích ngắn gọn"}

	- Nếu là câu trả lời ngắn (phù hợp câu hỏi suy luận):
	  {"type": "short_answer", "question": "...", "expectedAnswer": "Đáp án mong đợi (ý chính)", "explanation": "Giải thích chi tiết"}

	Yêu cầu:
	- ÍT NHẤT 1 câu trắc nghiệm VÀ 1 câu trả lời ngắn
	- Câu hỏi bằng tiếng Việt, NGẮN GỌN
	- Đáp án trắc nghiệm: ĐÚNG 1 đáp án đúng
	- expectedAnswer: ghi ý chính, không cần quá dài
	- explanation: giải thích NGẮN, dễ hiểu
	- Dùng $...$ cho công thức toán trong câu hỏi, đáp án và giải thích (VD: $u_1 = 3$, $x^2$).

	Trả về MẢNG JSON, không kèm text gì khác.`, profile.Topic, profile.ErrorCount)

		response, err := h.aiService.Chat([]ChatMessage{
			{Role: "system", Content: "Bạn là trợ lý tạo bài tập. Chỉ trả về MẢNG JSON thuần, không có markdown."},
			{Role: "user", Content: prompt},
		})
		if err != nil {
			jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
			return
		}

		var exercises []map[string]interface{}
		if err := json.Unmarshal([]byte(extractJSON(response)), &exercises); err != nil {
			jsonErr(w, "Lỗi parse kết quả AI", http.StatusInternalServerError)
			return
		}

		exercisesJSON, _ := json.Marshal(exercises)
		h.weaknessService.AddRemediation(r.Context(), req.WeaknessID, string(exercisesJSON))

		jsonOk(w, map[string]interface{}{
			"weaknessId": req.WeaknessID,
			"exercises":  exercises,
		})
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

// extractJSON strips markdown code fences from an AI response.
func extractJSON(raw string) string {
	s := strings.TrimSpace(raw)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimPrefix(s, "```")
		if idx := strings.LastIndex(s, "```"); idx >= 0 {
			s = s[:idx]
		}
		s = strings.TrimSpace(s)
	}
	return s
}
