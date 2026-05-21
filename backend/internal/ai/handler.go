package ai

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/courses"
	"github.com/lms/backend/internal/gamification"
	"github.com/lms/backend/internal/lessons"
	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/weaknesses"
	"gorm.io/gorm"
)

type Handler struct {
	aiService       *Service
	lessonService   *lessons.Service
	weaknessService *weaknesses.Service
	diamondService  *gamification.DiamondService
	courseService   *courses.Service
	cacheService    *CacheService
	db              *gorm.DB
}

func NewHandler(aiSvc *Service, lessonSvc *lessons.Service, weaknessSvc *weaknesses.Service, diamondSvc *gamification.DiamondService, courseSvc *courses.Service, cacheSvc *CacheService, db *gorm.DB) *Handler {
	return &Handler{aiService: aiSvc, lessonService: lessonSvc, weaknessService: weaknessSvc, diamondService: diamondSvc, courseService: courseSvc, cacheService: cacheSvc, db: db}
}

type chatInput struct {
	Message   string        `json:"message"`
	LessonID  string        `json:"lessonId"`
	SessionID string        `json:"sessionId"`
	History   []ChatMessage `json:"history"`
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

	messages := []ChatMessage{{Role: "system", Content: systemPrompt}}
	messages = append(messages, req.History...)
	messages = append(messages, ChatMessage{Role: "user", Content: req.Message})

	var fullResponse strings.Builder
	err := h.aiService.ChatStream(messages, func(text string) {
		fullResponse.WriteString(text)
		data, _ := json.Marshal(map[string]string{"delta": text})
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}, func() {
		// Parse :::weakness markers and record weakness signals
		if claims != nil {
			weaknessRe := regexp.MustCompile(`:::weakness topic="([^"]+)"`)
			matches := weaknessRe.FindAllStringSubmatch(fullResponse.String(), -1)
			for _, match := range matches {
				topic := match[1]
				h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic, "chat", 0.8)
			}
		}

		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	})

	if err != nil {
		fmt.Fprintf(w, "data: {\"error\":\"%s\"}\n\n", err.Error())
		flusher.Flush()
	}
}

// ---- Extract Questions from Document ----

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

	// Add IDs to each question
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
			h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic, "quiz", 1.0)
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
			h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic, "exercise", 1.0)
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

	// Return cached summary if available (saves AI call)
	lesson, err := h.lessonService.FindByID(r.Context(), req.LessonID)
	if err == nil && lesson.Summary != "" {
		var objectives []string
		if lesson.Objectives != "" {
			json.Unmarshal([]byte(lesson.Objectives), &objectives)
		}
		jsonOk(w, map[string]interface{}{
			"summary":     lesson.Summary,
			"objectives":  objectives,
			"lessonTitle": lesson.Title,
			"subjectName": ctx_.SubjectName,
			"description": ctx_.Description,
			"gradeLevel":  ctx_.GradeLevel,
		})
		return
	}

	prompt := BuildLessonSummaryPrompt(ctx_.SubjectName, ctx_.LessonTitle, ctx_.Description, ctx_.GradeLevel)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý tóm tắt bài học. Chỉ trả về JSON, không thêm text khác."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var result struct {
		Summary    string   `json:"summary"`
		Objectives []string `json:"objectives"`
	}
	if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {
		// Fallback: save raw response as summary
		if lesson != nil {
			objectivesJSON, _ := json.Marshal([]string{})
			h.lessonService.Update(r.Context(), lesson.ID, map[string]interface{}{
				"summary":    response,
				"objectives": string(objectivesJSON),
			})
		}
		jsonOk(w, map[string]interface{}{
			"summary":     response,
			"objectives":  []string{},
			"lessonTitle": ctx_.LessonTitle,
			"subjectName": ctx_.SubjectName,
			"description": ctx_.Description,
			"gradeLevel":  ctx_.GradeLevel,
		})
		return
	}

	// Cache the generated result
	if lesson != nil {
		objectivesJSON, _ := json.Marshal(result.Objectives)
		h.lessonService.Update(r.Context(), lesson.ID, map[string]interface{}{
			"summary":    result.Summary,
			"objectives": string(objectivesJSON),
		})
	}

	jsonOk(w, map[string]interface{}{
		"summary":     result.Summary,
		"objectives":  result.Objectives,
		"lessonTitle": ctx_.LessonTitle,
		"subjectName": ctx_.SubjectName,
		"description": ctx_.Description,
		"gradeLevel":  ctx_.GradeLevel,
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

// ---- Generate Assignment from Lesson ----

type generateAssignmentInput struct {
	LessonID      string `json:"lessonId"`
	QuestionCount int    `json:"questionCount"`
	QuestionType  string `json:"questionType"` // "mcq", "open_ended", or "mixed"
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

	response, err := h.aiService.GenerateAssignment(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description, req.QuestionCount, typeLabel, ctx_.GradeLevel)
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
		fmt.Printf("DEBUG: roadmap decode error: %v\n", err)
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		fmt.Printf("DEBUG: roadmap claims nil\n")
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Printf("DEBUG: roadmap for user %s\n", claims.UserID)
	profiles, err := h.weaknessService.ListByUser(r.Context(), claims.UserID)
	if err != nil {
		fmt.Printf("DEBUG: ListByUser error: %v\n", err)
	}
	fmt.Printf("DEBUG: found %d weakness profiles\n", len(profiles))
	
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

	fmt.Printf("DEBUG: calling AI service\n")
	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là cố vấn học tập. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		fmt.Printf("DEBUG: AI Chat error: %v\n", err)
		jsonErr(w, "Roadmap generation failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Printf("DEBUG: AI response length: %d\n", len(response))
	var roadmap []map[string]interface{}
	extracted := extractJSON(response)
	fmt.Printf("DEBUG: extracted JSON length: %d\n", len(extracted))
	if err := json.Unmarshal([]byte(extracted), &roadmap); err != nil {
		// Log the problematic response for debugging
		fmt.Printf("DEBUG roadmap parse error: %v\nExtracted: %q\nRaw response: %q\n", err, extracted, response)
		jsonErr(w, "Failed to parse roadmap: "+err.Error(), http.StatusInternalServerError)
		return
	}

	fmt.Printf("DEBUG: roadmap parsed successfully, %d steps\n", len(roadmap))
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

	// Look up lesson → course → subject for metadata
	var subjectID string
	var gradeLevel int
	if profile.LessonID != "" {
		lesson, err := h.lessonService.FindByID(r.Context(), profile.LessonID)
		if err == nil {
			course, err := h.courseService.FindByID(r.Context(), lesson.CourseID)
			if err == nil {
				subjectID = course.SubjectID
				gradeLevel = course.GradeLevel
			}
		}
	}

	prompt := fmt.Sprintf(`Học sinh đang gặp khó khăn với chủ đề: "%s"
	Số lần mắc lỗi: %d

	Tạo 3-4 bài tập GIÚP HỌC SINH CẢI THIỆN. Kết hợp cả trắc nghiệm và câu trả lời ngắn:

	- Nếu là trắc nghiệm:
	  {"type": "mcq", "question": "...", "options": [{"text": "Đáp án A", "isCorrect": false}, {"text": "Đáp án B", "isCorrect": true}, {"text": "Đáp án C", "isCorrect": false}, {"text": "Đáp án D", "isCorrect": false}], "explanation": "Giải thích ngắn gọn"}

	- Nếu là câu trả lời ngắn (dành cho câu hỏi có đáp án CỤ THỂ, NGẮN GỌN như số, công thức, định nghĩa):
	  {"type": "short_answer", "question": "...", "expectedAnswer": "Đáp án chính xác (TỐI ĐA 5 TỪ)", "explanation": "Giải thích ngắn gọn"}

	Yêu cầu QUAN TRỌNG:
	- ÍT NHẤT 1 câu trắc nghiệm VÀ 1 câu trả lời ngắn
	- Câu hỏi bằng tiếng Việt, NGẮN GỌN
	- Đáp án trắc nghiệm: ĐÚNG 1 đáp án đúng
	- expectedAnswer: PHẢI là đáp án NGẮN (tối đa 5 từ), cụ thể, dùng để so khớp chính xác. Ví dụ: "3", "đường trung trực", "lực hấp dẫn", "phản xạ có điều kiện".
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
		cleaned := extractJSON(response)
		if err := json.Unmarshal([]byte(cleaned), &exercises); err != nil {
			// Fallback: try parsing as a wrapper object with an array field
			var wrapper map[string]interface{}
			if err2 := json.Unmarshal([]byte(cleaned), &wrapper); err2 == nil {
				for _, v := range wrapper {
					if arr, ok := v.([]interface{}); ok {
						for _, item := range arr {
							if m, ok := item.(map[string]interface{}); ok {
								exercises = append(exercises, m)
							}
						}
						break
					}
				}
			}
			if len(exercises) == 0 {
				// Log debug info: the cleaned string and the parse error
				errMsg := fmt.Sprintf("Lỗi parse kết quả AI (unmarshal: %s). Cleaned: %s. Raw: %s", err.Error(), cleaned, response)
				jsonErr(w, errMsg, http.StatusInternalServerError)
				return
			}
		}

		exercisesJSON, _ := json.Marshal(exercises)
		h.weaknessService.AddRemediation(r.Context(), req.WeaknessID, string(exercisesJSON))

		jsonOk(w, map[string]interface{}{
			"weaknessId": req.WeaknessID,
			"exercises":  exercises,
			"topic":      profile.Topic,
			"subjectId":  subjectID,
			"gradeLevel": gradeLevel,
		})
	}

// ---- Generate Remediation Assignment ----

type generateRemediationAssignmentInput struct {
	ClassID string `json:"classId"`
	Topic   string `json:"topic"`
	Title   string `json:"title"`
}

func (h *Handler) GenerateRemediationAssignment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var req generateRemediationAssignmentInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.ClassID == "" || req.Topic == "" {
		jsonErr(w, "classId và topic là bắt buộc", http.StatusBadRequest)
		return
	}

	studentIDs, err := h.weaknessService.FindStudentIDsByClassAndTopic(r.Context(), req.ClassID, req.Topic)
	if err != nil {
		jsonErr(w, "Lỗi truy vấn học sinh: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if len(studentIDs) == 0 {
		jsonErr(w, "Không có học sinh nào trong lớp có điểm yếu về chủ đề này", http.StatusNotFound)
		return
	}

	title := req.Title
	if title == "" {
		title = "Bài tập khắc phục: " + req.Topic
	}

	prompt := fmt.Sprintf(`Học sinh đang gặp khó khăn với chủ đề: "%s".

Tạo 4-5 bài tập khắc phục, kết hợp trắc nghiệm và câu trả lời ngắn:

- Trắc nghiệm:
  {"type": "mcq", "question": "...", "options": [{"text": "Đáp án A", "isCorrect": false}, {"text": "Đáp án B", "isCorrect": true}, {"text": "Đáp án C", "isCorrect": false}, {"text": "Đáp án D", "isCorrect": false}], "expectedAnswer": "B", "explanation": "Giải thích ngắn gọn", "score": <điểm từ 1-3>}

- Câu trả lời ngắn:
  {"type": "short_answer", "question": "...", "expectedAnswer": "Đáp án chính xác (TỐI ĐA 5 TỪ)", "explanation": "Giải thích ngắn gọn", "score": <điểm từ 1-3>}

Yêu cầu:
- ÍT NHẤT 1 trắc nghiệm VÀ 1 câu trả lời ngắn
- TỔNG điểm tất cả câu hỏi = 10
- Câu hỏi bằng tiếng Việt, NGẮN GỌN, bám sát chủ đề
- expectedAnswer: đáp án NGẮN, cụ thể (tối đa 5 từ)
- Dùng $...$ cho công thức toán
- Trả về MẢNG JSON, không kèm text khác.`, req.Topic)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo bài tập khắc phục. Chỉ trả về MẢNG JSON thuần, không có markdown."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var questions []map[string]interface{}
	cleaned := extractJSON(response)
	if err := json.Unmarshal([]byte(cleaned), &questions); err != nil {
		// Fallback: try wrapper
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
		if len(questions) == 0 {
			jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// Add IDs and defaults, normalize scores to total=10
	for i := range questions {
		questions[i]["id"] = uuid.New().String()
		if _, ok := questions[i]["score"]; !ok {
			questions[i]["score"] = 10
		}
	}
	normalizeScores(questions)
	maxScore := 0
	for _, q := range questions {
		if s, ok := q["score"].(float64); ok {
			maxScore += int(s)
		}
	}
	if maxScore == 0 {
		maxScore = 100
	}

	questionsJSON, _ := json.Marshal(questions)
	studentIDsJSON, _ := json.Marshal(studentIDs)

	assignmentID := uuid.New().String()
	now := time.Now()
	assignment := map[string]interface{}{
		"id":          assignmentID,
		"creator_id":  claims.UserID,
		"creator_name": claims.UserName,
		"title":       title,
		"class_id":    req.ClassID,
		"student_ids": string(studentIDsJSON),
		"max_score":   maxScore,
		"questions":   string(questionsJSON),
		"status":      "ASSIGNED",
		"source":      "ai_remediation",
		"created_at":  now,
		"updated_at":  now,
	}

	if err := h.db.WithContext(r.Context()).Table("assignments").Create(assignment).Error; err != nil {
		jsonErr(w, "Lỗi tạo bài tập: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]interface{}{
		"assignmentId":         assignmentID,
		"title":                title,
		"questions":            questions,
		"assignedStudentCount": len(studentIDs),
	})
}

// ---- Graph types for Mind Map & Knowledge Graph ----

type GraphNode struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Type        string `json:"type"`
	Mastery     string `json:"mastery"`
	Description string `json:"description"`
}

type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

type GraphResult struct {
	CentralTopic string      `json:"centralTopic"`
	Nodes        []GraphNode `json:"nodes"`
	Edges        []GraphEdge `json:"edges"`
}

// ---- Mind Map ----

type mindmapInput struct {
	LessonID string `json:"lessonId"`
}

func (h *Handler) MindMap(w http.ResponseWriter, r *http.Request) {
	var req mindmapInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.LessonID == "" {
		jsonErr(w, "lessonId là bắt buộc", http.StatusBadRequest)
		return
	}

	// Check cache first — massive token savings
	cacheKey := mindmapCacheKey(req.LessonID)
	if cached, ok := h.cacheService.Get(r.Context(), cacheKey); ok {
		var result GraphResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			claims := middleware.GetClaims(r.Context())
			if claims != nil {
				profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
				mergeMastery(result.Nodes, profiles)
			}
			jsonOk(w, result)
			return
		}
	}

	ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài học", http.StatusNotFound)
		return
	}

	prompt := BuildMindMapPrompt(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description, ctx_.GradeLevel)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý tạo sơ đồ tư duy. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var result GraphResult
	if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {
		jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Inject central node if not already present
	hasCentral := false
	for i := range result.Nodes {
		if result.Nodes[i].ID == "central" {
			hasCentral = true
			result.Nodes[i].Label = result.CentralTopic
			result.Nodes[i].Type = "concept"
			result.Nodes[i].Mastery = "mastered"
			break
		}
	}
	if !hasCentral {
		result.Nodes = append([]GraphNode{{ID: "central", Label: result.CentralTopic, Type: "concept", Mastery: "mastered"}}, result.Nodes...)
	}

	// Cache the result (before personalizing with weakness)
	cachedJSON, _ := json.Marshal(result)
	h.cacheService.Set(r.Context(), cacheKey, string(cachedJSON))

	// Merge weakness data for color coding
	claims := middleware.GetClaims(r.Context())
	if claims != nil {
		profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
		mergeMastery(result.Nodes, profiles)
	}

	jsonOk(w, result)
}

// ---- Knowledge Graph ----

type knowledgeGraphInput struct {
	SubjectID string `json:"subjectId"`
}

func (h *Handler) KnowledgeGraph(w http.ResponseWriter, r *http.Request) {
	var req knowledgeGraphInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.SubjectID == "" {
		jsonErr(w, "subjectId là bắt buộc", http.StatusBadRequest)
		return
	}

	// Check cache first
	cacheKey := kgCacheKey(req.SubjectID)
	if cached, ok := h.cacheService.Get(r.Context(), cacheKey); ok {
		var result GraphResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			claims := middleware.GetClaims(r.Context())
			if claims != nil {
				profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
				mergeMastery(result.Nodes, profiles)
			}
			jsonOk(w, result)
			return
		}
	}

	// Get subject
	var subject struct {
		ID         string `gorm:"primaryKey;size:36"`
		Name       string
		GradeLevel int
	}
	if err := h.db.WithContext(r.Context()).Table("subjects").Where("id = ?", req.SubjectID).First(&subject).Error; err != nil {
		jsonErr(w, "Không tìm thấy môn học", http.StatusNotFound)
		return
	}

	// Get all courses for this subject
	var courses []struct {
		ID string
	}
	h.db.WithContext(r.Context()).Table("courses").Where("subject_id = ?", req.SubjectID).Find(&courses)
	courseIDs := make([]string, len(courses))
	for i, c := range courses {
		courseIDs[i] = c.ID
	}

	// Get all lessons for these courses
	var summaries strings.Builder
	if len(courseIDs) > 0 {
		var lessons []struct {
			Title       string
			Description string
		}
		h.db.WithContext(r.Context()).Table("lessons").Where("course_id IN ?", courseIDs).Find(&lessons)
		for _, l := range lessons {
			summaries.WriteString(fmt.Sprintf("Tiêu đề: %s\nMô tả: %s\n\n", l.Title, l.Description))
		}
	}
	summaryStr := summaries.String()
	if summaryStr == "" {
		summaryStr = "Chưa có bài học nào trong môn học này"
	}

	prompt := BuildKnowledgeGraphPrompt(subject.Name, subject.GradeLevel, summaryStr)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý tạo đồ thị tri thức. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var result GraphResult
	if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {
		jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Cache the result
	cachedJSON, _ := json.Marshal(result)
	h.cacheService.Set(r.Context(), cacheKey, string(cachedJSON))

	// Merge weakness data
	claims := middleware.GetClaims(r.Context())
	if claims != nil {
		profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
		mergeMastery(result.Nodes, profiles)
	}

	jsonOk(w, result)
}

// mergeMastery sets mastery field on nodes based on user's weakness data.
func mergeMastery(nodes []GraphNode, profiles []weaknesses.WeaknessProfile) {
	for i := range nodes {
		nodes[i].Mastery = "mastered"
		for _, p := range profiles {
			if p.Resolved {
				continue
			}
			match := strings.Contains(strings.ToLower(nodes[i].Label), strings.ToLower(p.Topic)) ||
				strings.Contains(strings.ToLower(p.Topic), strings.ToLower(nodes[i].Label))
			if match {
				if p.ErrorCount > 2 {
					nodes[i].Mastery = "weak"
				} else if p.ImprovementScore > 0 {
					nodes[i].Mastery = "learning"
				} else {
					nodes[i].Mastery = "weak"
				}
				break
			}
		}
		if nodes[i].Mastery == "mastered" {
			// Check if any related weakness was resolved (partial mastery)
			for _, p := range profiles {
				if p.Resolved {
					match := strings.Contains(strings.ToLower(nodes[i].Label), strings.ToLower(p.Topic)) ||
						strings.Contains(strings.ToLower(p.Topic), strings.ToLower(nodes[i].Label))
					if match {
						nodes[i].Mastery = "learning"
						break
					}
				}
			}
		}
	}
}

// ---- Generate Flashcards ----

type generateFlashcardsInput struct {
	LessonID string `json:"lessonId"`
	Count    int    `json:"count"`
}

func (h *Handler) GenerateFlashcards(w http.ResponseWriter, r *http.Request) {
	var req generateFlashcardsInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.LessonID == "" {
		jsonErr(w, "lessonId là bắt buộc", http.StatusBadRequest)
		return
	}
	if req.Count <= 0 {
		req.Count = 10
	}
	if req.Count > 20 {
		req.Count = 20
	}

	ctx_, err := h.lessonService.GetContext(r.Context(), req.LessonID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài học", http.StatusNotFound)
		return
	}

	// Check cache first — same cards for all users, personalization comes from SM-2
	cacheKey := flashcardsCacheKey(req.LessonID, req.Count)
	if cached, ok := h.cacheService.Get(r.Context(), cacheKey); ok {
		var cards []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &cards); err == nil {
			for i := range cards {
				cards[i]["id"] = uuid.New().String()
			}
			jsonOk(w, map[string]interface{}{
				"cards":       cards,
				"lessonTitle": ctx_.LessonTitle,
				"subjectName": ctx_.SubjectName,
			})
			return
		}
	}

	prompt := BuildFlashcardPrompt(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description, req.Count, ctx_.GradeLevel)

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo thẻ học tập. Chỉ trả về MẢNG JSON, không thêm markdown."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var cards []map[string]interface{}
	cleaned := extractJSON(response)
	if err := json.Unmarshal([]byte(cleaned), &cards); err != nil {
		jsonErr(w, "Lỗi parse kết quả AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Cache cards (without per-user IDs)
	cachedJSON, _ := json.Marshal(cards)
	h.cacheService.Set(r.Context(), cacheKey, string(cachedJSON))

	// Add IDs to each card
	for i := range cards {
		cards[i]["id"] = uuid.New().String()
	}

	jsonOk(w, map[string]interface{}{
		"cards":       cards,
		"lessonTitle": ctx_.LessonTitle,
		"subjectName": ctx_.SubjectName,
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

// extractJSON strips markdown code fences from an AI response and extracts valid JSON.
func extractJSON(raw string) string {
	s := strings.TrimSpace(raw)

	// Strip markdown code fences
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		// Strip optional language tag (e.g., "json", "JSON")
		if idx := strings.Index(s, "\n"); idx >= 0 && idx < 20 {
			tag := strings.TrimSpace(s[:idx])
			if len(tag) < 15 && !strings.Contains(tag, " ") {
				s = s[idx+1:]
			}
		}
		if idx := strings.LastIndex(s, "```"); idx >= 0 {
			s = s[:idx]
		}
		s = strings.TrimSpace(s)
	}

	// Find first [ or { that starts valid JSON
	var startIdx int
	openBracketIdx := strings.Index(s, "[")
	openBraceIdx := strings.Index(s, "{")
	
	if openBracketIdx >= 0 && (openBraceIdx < 0 || openBracketIdx < openBraceIdx) {
		startIdx = openBracketIdx
	} else if openBraceIdx >= 0 {
		startIdx = openBraceIdx
	} else {
		return ""
	}

	// Extract from first valid JSON char onward
	s = s[startIdx:]
	
	// Find matching closing bracket
	if strings.HasPrefix(s, "[") {
		if idx := strings.LastIndex(s, "]"); idx > 0 {
			s = s[:idx+1]
		}
	} else if strings.HasPrefix(s, "{") {
		if idx := strings.LastIndex(s, "}"); idx > 0 {
			s = s[:idx+1]
		}
	}

	// Sanitize control characters that are invalid in JSON strings.
	s = sanitizeJSONString(s)

	return s
}

// sanitizeJSONString replaces raw control characters that are invalid inside JSON strings.
func sanitizeJSONString(s string) string {
	// Replace raw tabs, carriage returns, and other control chars (except \n)
	// within JSON string values. We keep \n as it may appear escaped.
	var b strings.Builder
	b.Grow(len(s))
	inString := false
	escaped := false
	for _, r := range s {
		if escaped {
			escaped = false
			b.WriteRune(r)
			continue
		}
		if r == '\\' && inString {
			escaped = true
			b.WriteRune(r)
			continue
		}
		if r == '"' {
			inString = !inString
			b.WriteRune(r)
			continue
		}
		// Inside a JSON string, control chars (except \n which is common in AI output) are invalid
		if inString {
			switch r {
			case '\t':
				b.WriteString("\\t")
			case '\r':
				b.WriteString("\\r")
			case '\n':
				b.WriteString("\\n")
			default:
				if r < 0x20 {
					b.WriteString(fmt.Sprintf("\\u%04x", r))
				} else {
					b.WriteRune(r)
				}
			}
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
