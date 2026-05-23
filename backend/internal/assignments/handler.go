package assignments

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/ai"
	"github.com/lms/backend/internal/middleware"
)

type Handler struct {
	service   *Service
	aiService *ai.Service
}

func NewHandler(service *Service, aiSvc *ai.Service) *Handler {
	return &Handler{service: service, aiService: aiSvc}
}

// --- Assignments ---

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	scope := ScopeFilter{}
	if claims != nil {
		scope.UserID = claims.UserID
		scope.Role = claims.Role
		scope.ClassID = claims.ClassID
	}
	list, err := h.service.List(r.Context(), scope)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []Assignment{}
	}
	jsonOk(w, list)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	a, err := h.service.FindByID(r.Context(), extractID(r.URL.Path))
	if err != nil {
		jsonErr(w, "Không tìm thấy bài tập", http.StatusNotFound)
		return
	}

	// Strip answer keys from questions for students
	claims := middleware.GetClaims(r.Context())
	if claims != nil && claims.Role == "STUDENT" {
		stripAnswerKeys(a)
	}

	jsonOk(w, a)
}

// stripAnswerKeys removes expectedAnswer and options.isCorrect from questions
// to prevent students from seeing answer keys on the client.
func stripAnswerKeys(a *Assignment) {
	if a.Questions == "" {
		return
	}
	var questions []map[string]interface{}
	if err := json.Unmarshal([]byte(a.Questions), &questions); err != nil {
		return
	}
	for _, q := range questions {
		delete(q, "expectedAnswer")
		if opts, ok := q["options"].([]interface{}); ok {
			for _, opt := range opts {
				if m, ok := opt.(map[string]interface{}); ok {
					delete(m, "isCorrect")
				}
			}
		}
	}
	sanitized, _ := json.Marshal(questions)
	a.Questions = string(sanitized)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var a Assignment
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if a.Title == "" {
		jsonErr(w, "Tiêu đề không được để trống", http.StatusBadRequest)
		return
	}
	a.ID = uuid.New().String()
	a.CreatorID = claims.UserID
	a.CreatorName = claims.UserName
	a.Status = StatusAssigned
	if err := h.service.Create(r.Context(), &a); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	go h.service.LogAudit(r.Context(), &AuditLog{
		ID:           uuid.New().String(),
		AssignmentID: a.ID,
		UserID:       claims.UserID,
		UserName:     claims.UserName,
		Action:       "CREATE",
		Detail:       fmt.Sprintf("Tạo bài tập: %s", a.Title),
	})
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(a)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path)
	claims := middleware.GetClaims(r.Context())

	var u map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	if err := h.service.Update(r.Context(), id, u); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	title := ""
	if t, ok := u["title"]; ok {
		title = fmt.Sprintf(": %v", t)
	}
	go h.service.LogAudit(r.Context(), &AuditLog{
		ID:           uuid.New().String(),
		AssignmentID: id,
		UserID:       claims.UserID,
		UserName:     claims.UserName,
		Action:       "UPDATE",
		Detail:       fmt.Sprintf("Cập nhật bài tập%s", title),
	})
	jsonOk(w, map[string]string{"status": "ok"})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Delete(r.Context(), extractID(r.URL.Path)); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOk(w, map[string]string{"status": "deleted"})
}

// --- Submissions ---

// QuestionResult holds per-question grading details.
type QuestionResult struct {
	QuestionID    string `json:"questionId"`
	Question      string `json:"question"`
	Score         int    `json:"score"`
	MaxScore      int    `json:"maxScore"`
	Feedback      string `json:"feedback"`
	CorrectAnswer string `json:"correctAnswer,omitempty"`
}

func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	var sub Submission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}
	sub.ID = uuid.New().String()
	sub.StudentID = claims.UserID
	sub.StudentName = claims.UserName
	if sub.AssignmentID == "" {
		sub.AssignmentID = strings.Split(r.URL.Path, "/")[3]
	}

	// Get assignment for auto-grading
	assignment, err := h.service.FindByID(r.Context(), sub.AssignmentID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài tập", http.StatusNotFound)
		return
	}

	// Parse answers from submission content
	type answerItem struct {
		QuestionID string `json:"questionId"`
		Answer     string `json:"answer"`
	}
	type answerWrapper struct {
		Answers []answerItem `json:"answers"`
	}
	var aw answerWrapper
	hasAnswers := false
	if sub.Content != "" {
		if err := json.Unmarshal([]byte(sub.Content), &aw); err == nil && len(aw.Answers) > 0 {
			hasAnswers = true
		}
	}

	answerMap := make(map[string]string)
	if hasAnswers {
		for _, a := range aw.Answers {
			answerMap[a.QuestionID] = a.Answer
		}
	}

	// Parse assignment questions
	var questions []map[string]interface{}
	if assignment.Questions != "" {
		json.Unmarshal([]byte(assignment.Questions), &questions)
	}

	// Auto-grade MCQ questions
	var results []QuestionResult
	totalScore := 0
	totalMaxScore := 0
	for _, q := range questions {
		qID, _ := q["id"].(string)
		qText, _ := q["question"].(string)
		qScore := 10
		if s, ok := q["score"].(float64); ok {
			qScore = int(s)
		}
		qType, _ := q["type"].(string)
		hasOptions := false
		if opts, ok := q["options"].([]interface{}); ok && len(opts) > 0 {
			hasOptions = true
		}

		maxScore := qScore
		if maxScore <= 0 {
			maxScore = 10
		}
		totalMaxScore += maxScore

		isMcq := qType == "mcq" || hasOptions
		if !isMcq || !hasAnswers {
			results = append(results, QuestionResult{
				QuestionID: qID,
				Question:   qText,
				Score:      0,
				MaxScore:   maxScore,
				Feedback:   "",
			})
			continue
		}

		studentAns := strings.TrimSpace(answerMap[qID])
		expectedAns := ""
		if ea, ok := q["expectedAnswer"].(string); ok {
			expectedAns = strings.TrimSpace(ea)
		}

		correct := strings.EqualFold(studentAns, expectedAns)
		score := 0
		feedback := "Sai"
		if correct {
			score = maxScore
			feedback = "Đúng"
		}
		totalScore += score

		results = append(results, QuestionResult{
			QuestionID:    qID,
			Question:      qText,
			Score:         score,
			MaxScore:      maxScore,
			Feedback:      feedback,
			CorrectAnswer: expectedAns,
		})
	}

	// Cap total score
	if totalScore > assignment.MaxScore && assignment.MaxScore > 0 {
		totalScore = assignment.MaxScore
	}
	if totalScore > totalMaxScore {
		totalScore = totalMaxScore
	}

	// Save submission
	if err := h.service.Submit(r.Context(), &sub); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Store grading results in submission feedback
	if len(results) > 0 {
		summary := fmt.Sprintf("Tổng điểm: %d/%d", totalScore, totalMaxScore)
		detailJSON, _ := json.Marshal(results)
		feedback := summary + "\n" + string(detailJSON)
		totalScoreVal := totalScore
		h.service.GradeSubmission(r.Context(), sub.ID, totalScoreVal, feedback, "auto")
		sub.Score = &totalScoreVal
		sub.Feedback = feedback
		sub.Status = StatusGraded
	}

	go h.service.LogAudit(r.Context(), &AuditLog{
		ID:           uuid.New().String(),
		AssignmentID: sub.AssignmentID,
		SubmissionID: sub.ID,
		UserID:       claims.UserID,
		UserName:     claims.UserName,
		Action:       "SUBMIT",
		Detail:       fmt.Sprintf("Nộp bài tập (tự động chấm MCQ: %d/%d)", totalScore, totalMaxScore),
	})

	jsonOk(w, map[string]interface{}{
		"submission": sub,
		"results":    results,
	})
}

func (h *Handler) ListSubmissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	// Extract assignment ID from path: /api/assignments/{id}/submissions
	parts := strings.Split(strings.TrimSuffix(r.URL.Path, "/"), "/")
	var assignmentID string
	for i, p := range parts {
		if p == "assignments" && i+1 < len(parts) {
			assignmentID = parts[i+1]
			break
		}
	}
	subs, err := h.service.ListSubmissionsByAssignment(r.Context(), assignmentID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if subs == nil {
		subs = []Submission{}
	}
	// Students can only see their own
	if claims.Role == "STUDENT" {
		filtered := make([]Submission, 0)
		for _, s := range subs {
			if s.StudentID == claims.UserID {
				filtered = append(filtered, s)
			}
		}
		subs = filtered
	}
	jsonOk(w, subs)
}

func (h *Handler) MySubmissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	subs, err := h.service.ListSubmissionsByStudent(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if subs == nil {
		subs = []Submission{}
	}
	jsonOk(w, subs)
}

func (h *Handler) MyGrades(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	rows, err := h.service.GetMyGrades(r.Context(), claims.UserID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if rows == nil {
		rows = []GradeRow{}
	}
	jsonOk(w, rows)
}

func (h *Handler) GradeSubmission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	subID := extractSubmissionID(r.URL.Path)

	ok, err := h.service.CanGrade(r.Context(), subID, claims.UserID)
	if !ok || err != nil {
		jsonErr(w, "Không có quyền chấm bài này", http.StatusForbidden)
		return
	}

	var gradeReq struct {
		Score    int    `json:"score"`
		Feedback string `json:"feedback"`
	}
	if err := json.NewDecoder(r.Body).Decode(&gradeReq); err != nil {
		jsonErr(w, "Dữ liệu không hợp lệ", http.StatusBadRequest)
		return
	}

	if err := h.service.GradeSubmission(r.Context(), subID, gradeReq.Score, gradeReq.Feedback, claims.UserID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	go h.service.LogAudit(r.Context(), &AuditLog{
		ID:           uuid.New().String(),
		SubmissionID: subID,
		UserID:       claims.UserID,
		UserName:     claims.UserName,
		Action:       "GRADE",
		Detail:       fmt.Sprintf("Chấm điểm: %d", gradeReq.Score),
	})
	jsonOk(w, map[string]string{"status": "graded"})
}

func (h *Handler) AutoGrade(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	subID := extractSubmissionID(r.URL.Path)

	ok, err := h.service.CanGrade(r.Context(), subID, claims.UserID)
	if !ok || err != nil {
		jsonErr(w, "Không có quyền chấm bài này", http.StatusForbidden)
		return
	}

	sub, err := h.service.FindSubmission(r.Context(), subID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài nộp", http.StatusNotFound)
		return
	}

	assignment, err := h.service.FindByID(r.Context(), sub.AssignmentID)
	if err != nil {
		jsonErr(w, "Không tìm thấy bài tập", http.StatusNotFound)
		return
	}

	// Check if assignment has per-question structure
	type Question struct {
		ID             string `json:"id"`
		Question       string `json:"question"`
		ExpectedAnswer string `json:"expectedAnswer"`
		Score          int    `json:"score"`
	}
	var questions []Question
	hasQuestions := false
	if assignment.Questions != "" {
		if err := json.Unmarshal([]byte(assignment.Questions), &questions); err == nil && len(questions) > 0 {
			hasQuestions = true
		}
	}

	if hasQuestions {
		// Parse student answers from submission content
		type Answer struct {
			QuestionID string `json:"questionId"`
			Answer     string `json:"answer"`
		}
		type AnswerWrapper struct {
			Answers []Answer `json:"answers"`
		}
		var answerWrapper AnswerWrapper
		if err := json.Unmarshal([]byte(sub.Content), &answerWrapper); err != nil {
			jsonErr(w, "Không thể đọc câu trả lời của học sinh", http.StatusBadRequest)
			return
		}

		answerMap := make(map[string]string)
		for _, a := range answerWrapper.Answers {
			answerMap[a.QuestionID] = a.Answer
		}

		// Grade each question
		type QuestionResult struct {
			QuestionID string `json:"questionId"`
			Question   string `json:"question"`
			Score      int    `json:"score"`
			MaxScore   int    `json:"maxScore"`
			Feedback   string `json:"feedback"`
		}

		var detailResults []QuestionResult
		totalScore := 0
		totalMaxScore := 0

		for _, q := range questions {
			studentAns := answerMap[q.ID]
			qMaxScore := q.Score
			if qMaxScore <= 0 {
				qMaxScore = 10
			}
			totalMaxScore += qMaxScore

			expectedInfo := ""
			if q.ExpectedAnswer != "" {
				expectedInfo = fmt.Sprintf("\nĐáp án mong đợi: %s", q.ExpectedAnswer)
			}

			result, err := h.aiService.GradeSubmission(ai.GradingRequest{
				Question:      q.Question + expectedInfo,
				StudentAnswer: studentAns,
				Rubric:        assignment.Rubric,
				MaxScore:      qMaxScore,
			})
			if err != nil {
				detailResults = append(detailResults, QuestionResult{
					QuestionID: q.ID,
					Question:   q.Question,
					Score:      0,
					MaxScore:   qMaxScore,
					Feedback:   "Lỗi chấm: " + err.Error(),
				})
				continue
			}
			totalScore += result.Score
			detailResults = append(detailResults, QuestionResult{
				QuestionID: q.ID,
				Question:   q.Question,
				Score:      result.Score,
				MaxScore:   qMaxScore,
				Feedback:   result.Feedback,
			})
		}

		// Cap total score at assignment maxScore (or totalMaxScore)
		if totalScore > assignment.MaxScore && assignment.MaxScore > 0 {
			totalScore = assignment.MaxScore
		}
		if totalScore > totalMaxScore {
			totalScore = totalMaxScore
		}

		detailJSON, _ := json.Marshal(detailResults)
		summaryFeedback := fmt.Sprintf("Tổng điểm: %d/%d (AI chấm từng câu)", totalScore, totalMaxScore)

		if err := h.service.GradeSubmission(r.Context(), subID, totalScore, summaryFeedback+"\n"+string(detailJSON), "AI"); err != nil {
			jsonErr(w, err.Error(), http.StatusInternalServerError)
			return
		}

		go h.service.LogAudit(r.Context(), &AuditLog{
			ID:           uuid.New().String(),
			SubmissionID: subID,
			UserID:       claims.UserID,
			UserName:     claims.UserName,
			Action:       "AUTO_GRADE",
			Detail:       fmt.Sprintf("AI chấm từng câu: %d/%d", totalScore, totalMaxScore),
		})
		jsonOk(w, map[string]interface{}{
			"score":    totalScore,
			"feedback": summaryFeedback,
			"details":  detailResults,
			"status":   "graded",
		})
		return
	}

	// Fallback: single-question grading (original behaviour)
	result, err := h.aiService.GradeSubmission(ai.GradingRequest{
		Question:      assignment.Description,
		StudentAnswer: sub.Content,
		Rubric:        assignment.Rubric,
		MaxScore:      assignment.MaxScore,
	})
	if err != nil {
		jsonErr(w, "Lỗi AI chấm bài: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := h.service.GradeSubmission(r.Context(), subID, result.Score, result.Feedback, "AI"); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}

	go h.service.LogAudit(r.Context(), &AuditLog{
		ID:           uuid.New().String(),
		SubmissionID: subID,
		UserID:       claims.UserID,
		UserName:     claims.UserName,
		Action:       "AUTO_GRADE",
		Detail:       fmt.Sprintf("AI chấm điểm: %d - %s", result.Score, result.Feedback),
	})
	jsonOk(w, map[string]interface{}{
		"score":    result.Score,
		"feedback": result.Feedback,
		"status":   "graded",
	})
}

func (h *Handler) ReturnSubmission(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	subID := extractSubmissionID(r.URL.Path)

	if err := h.service.ReturnSubmission(r.Context(), subID); err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	go h.service.LogAudit(r.Context(), &AuditLog{
		ID:           uuid.New().String(),
		SubmissionID: subID,
		UserID:       claims.UserID,
		UserName:     claims.UserName,
		Action:       "RETURN",
		Detail:       "Trả bài để sửa lại",
	})
	jsonOk(w, map[string]string{"status": "returned"})
}

func (h *Handler) AuditTrail(w http.ResponseWriter, r *http.Request) {
	assignmentID := strings.Split(r.URL.Path, "/")[3]
	logs, err := h.service.AuditTrail(r.Context(), assignmentID)
	if err != nil {
		jsonErr(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if logs == nil {
		logs = []AuditLog{}
	}
	jsonOk(w, logs)
}

// --- Helpers ---

func extractID(path string) string {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	return parts[len(parts)-1]
}

// extractSubmissionID extracts the submission ID from paths like /api/submissions/{id}/grade
func extractSubmissionID(path string) string {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	for i, p := range parts {
		if p == "submissions" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
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
