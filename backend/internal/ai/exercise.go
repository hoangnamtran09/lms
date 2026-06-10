package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
)

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

	if result.IsPassed && result.DiamondsEarned > 0 {
		h.diamondService.Add(r.Context(), claims.UserID, result.DiamondsEarned, "Hoàn thành bài tập", req.LessonID)
	}

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

type generateRemediationAssignmentInput struct {
	ClassID string `json:"classId"`
	Topic   string `json:"topic"`
	Title   string `json:"title"`
}

// generateSimpleRemediationQuestions creates basic questions from a topic without AI.
func generateSimpleRemediationQuestions(topic string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":             uuid.New().String(),
			"type":           "mcq",
			"question":       fmt.Sprintf("Kiến thức nào sau đây đúng về %s?", topic),
			"options":        []map[string]interface{}{{"text": "Đáp án A", "isCorrect": true}, {"text": "Đáp án B", "isCorrect": false}, {"text": "Đáp án C", "isCorrect": false}, {"text": "Đáp án D", "isCorrect": false}},
			"expectedAnswer": "A",
			"explanation":    fmt.Sprintf("Đây là kiến thức cơ bản về %s. Học sinh cần nắm vững khái niệm này.", topic),
			"score":          3,
		},
		{
			"id":             uuid.New().String(),
			"type":           "short_answer",
			"question":       fmt.Sprintf("Hãy nêu khái niệm về %s.", topic),
			"expectedAnswer": fmt.Sprintf("Khái niệm %s", topic),
			"explanation":    fmt.Sprintf("Học sinh cần hiểu rõ định nghĩa và bản chất của %s.", topic),
			"score":          3,
		},
		{
			"id":             uuid.New().String(),
			"type":           "mcq",
			"question":       fmt.Sprintf("Đặc điểm nào KHÔNG đúng về %s?", topic),
			"options":        []map[string]interface{}{{"text": "Đặc điểm 1", "isCorrect": false}, {"text": "Đặc điểm 2", "isCorrect": true}, {"text": "Đặc điểm 3", "isCorrect": false}, {"text": "Đặc điểm 4", "isCorrect": false}},
			"expectedAnswer": "B",
			"explanation":    fmt.Sprintf("Học sinh cần phân biệt được các đặc điểm của %s.", topic),
			"score":          2,
		},
		{
			"id":             uuid.New().String(),
			"type":           "short_answer",
			"question":       fmt.Sprintf("Cho ví dụ thực tế về %s.", topic),
			"expectedAnswer": fmt.Sprintf("Ví dụ %s", topic),
			"explanation":    fmt.Sprintf("Vận dụng kiến thức %s vào thực tiễn giúp học sinh ghi nhớ tốt hơn.", topic),
			"score":          2,
		},
	}
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

	var questions []map[string]interface{}

	response, aiErr := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo bài tập khắc phục. Chỉ trả về MẢNG JSON thuần, không có markdown."},
		{Role: "user", Content: prompt},
	})
	if aiErr == nil {
		cleaned := extractJSON(response)
		if err := json.Unmarshal([]byte(cleaned), &questions); err != nil {
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
	}

	if len(questions) == 0 {
		questions = generateSimpleRemediationQuestions(req.Topic)
	}

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
		"id":           assignmentID,
		"creator_id":   claims.UserID,
		"creator_name": claims.UserName,
		"title":        title,
		"class_id":     req.ClassID,
		"student_ids":  string(studentIDsJSON),
		"max_score":    maxScore,
		"questions":    string(questionsJSON),
		"status":       "ASSIGNED",
		"source":       "ai_remediation",
		"created_at":   now,
		"updated_at":   now,
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
