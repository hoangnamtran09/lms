package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/weaknesses"
)

type coachInput struct {
	StreakDays       int     `json:"streakDays"`
	CompletedLessons int     `json:"completedLessons"`
	TotalLessons     int     `json:"totalLessons"`
	AvgQuizScore     float64 `json:"avgQuizScore"`
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

type lessonSummaryInput struct {
	LessonID  string `json:"lessonId"`
	SubjectID string `json:"subjectId"`
	SessionID string `json:"sessionId"`
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

// generateSimpleMindMap builds a basic mindmap from lesson content without AI.
func generateSimpleMindMap(lessonTitle, subjectName, description string) GraphResult {

	lines := strings.Split(strings.TrimSpace(description), "\n")
	var sentences []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.Split(line, ".")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if len(p) > 5 {
				sentences = append(sentences, p)
			}
		}
	}

	result := GraphResult{
		CentralTopic: lessonTitle,
		Nodes: []GraphNode{
			{
				ID:          "central",
				Label:       lessonTitle,
				Type:        "concept",
				Mastery:     "mastered",
				Description: "Chủ đề chính của bài học",
			},
		},
		Edges: []GraphEdge{},
	}

	branchCount := min(len(sentences), 6)
	if branchCount == 0 {

		branches := []struct{ label, desc string }{
			{"Khái niệm cơ bản", "Các định nghĩa và khái niệm nền tảng của " + lessonTitle},
			{"Kiến thức trọng tâm", "Những nội dung quan trọng nhất cần nắm vững trong " + lessonTitle},
			{"Ứng dụng thực tế", "Cách áp dụng kiến thức " + lessonTitle + " vào thực tiễn và bài tập"},
			{"Bài tập vận dụng", "Các dạng bài tập thường gặp và phương pháp giải cho " + lessonTitle},
			{"Tổng kết", "Tóm tắt và liên hệ các kiến thức đã học trong " + lessonTitle},
		}
		for i, b := range branches {
			id := fmt.Sprintf("branch%d", i)
			result.Nodes = append(result.Nodes, GraphNode{
				ID: id, Label: b.label, Type: "concept",
				Mastery: "learning", Description: b.desc,
			})
			result.Edges = append(result.Edges, GraphEdge{Source: "central", Target: id, Label: "bao gồm"})
		}
		return result
	}

	for i := 0; i < branchCount; i++ {
		branchID := fmt.Sprintf("b%d", i)
		label := sentences[i]
		if len([]rune(label)) > 50 {
			label = string([]rune(label)[:50]) + "..."
		}
		desc := sentences[i]
		if len(desc) < 30 {
			desc = "Nội dung về " + strings.ToLower(label) + " — đây là một trong những kiến thức quan trọng của bài học " + lessonTitle
		}
		result.Nodes = append(result.Nodes, GraphNode{
			ID:          branchID,
			Label:       label,
			Type:        "concept",
			Mastery:     "learning",
			Description: desc,
		})
		result.Edges = append(result.Edges, GraphEdge{
			Source: "central",
			Target: branchID,
			Label:  "bao gồm",
		})
	}

	detailIdx := 0
	for i := branchCount; i < len(sentences) && detailIdx < 12; i++ {
		parentBranch := i % branchCount
		parentLabel := ""
		for _, n := range result.Nodes {
			if n.ID == fmt.Sprintf("b%d", parentBranch) {
				parentLabel = n.Label
				break
			}
		}
		detailID := fmt.Sprintf("d%d", detailIdx)
		label := sentences[i]
		if len([]rune(label)) > 45 {
			label = string([]rune(label)[:45]) + "..."
		}
		desc := sentences[i]
		if len(desc) < 25 && parentLabel != "" {
			desc = fmt.Sprintf("Chi tiết về %s — thuộc nhóm %s trong bài học %s", strings.ToLower(label), strings.ToLower(parentLabel), lessonTitle)
		}
		result.Nodes = append(result.Nodes, GraphNode{
			ID:          detailID,
			Label:       label,
			Type:        "subtopic",
			Mastery:     "learning",
			Description: desc,
		})
		result.Edges = append(result.Edges, GraphEdge{
			Source: fmt.Sprintf("b%d", parentBranch),
			Target: detailID,
			Label:  "chi tiết",
		})
		detailIdx++
	}

	return result
}

type mindmapInput struct {
	LessonID string `json:"lessonId"`
		Refresh  bool   `json:"refresh"`
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

	cacheKey := mindmapCacheKey(req.LessonID)
	if req.Refresh {
		h.cacheService.Delete(r.Context(), cacheKey)
	}
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

	var result GraphResult

	prompt := BuildMindMapPrompt(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description, ctx_.GradeLevel)
	response, aiErr := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý tạo sơ đồ tư duy. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if aiErr == nil {
		if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {

			result = generateSimpleMindMap(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description)
		}
	} else {

		result = generateSimpleMindMap(ctx_.LessonTitle, ctx_.SubjectName, ctx_.Description)
	}

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

	cachedJSON, _ := json.Marshal(result)
	h.cacheService.Set(r.Context(), cacheKey, string(cachedJSON))

	claims := middleware.GetClaims(r.Context())
	if claims != nil {
		profiles, _ := h.weaknessService.ListByUser(r.Context(), claims.UserID)
		mergeMastery(result.Nodes, profiles)
	}

	jsonOk(w, result)
}

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

	cachedJSON, _ := json.Marshal(result)
	h.cacheService.Set(r.Context(), cacheKey, string(cachedJSON))

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

	cachedJSON, _ := json.Marshal(cards)
	h.cacheService.Set(r.Context(), cacheKey, string(cachedJSON))

	for i := range cards {
		cards[i]["id"] = uuid.New().String()
	}

	jsonOk(w, map[string]interface{}{
		"cards":       cards,
		"lessonTitle": ctx_.LessonTitle,
		"subjectName": ctx_.SubjectName,
	})
}

// POST /api/ai/summarize-weaknesses
func (h *Handler) SummarizeWeaknesses(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Topics      []string `json:"topics"`
		SubjectName string   `json:"subjectName"`
		LessonTitle string   `json:"lessonTitle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Topics) == 0 {
		jsonOk(w, map[string]string{"summary": "Không có điểm yếu nào."})
		return
	}

	prompt := fmt.Sprintf(`Học sinh có các điểm yếu sau trong bài học:
- Môn: %s
- Bài: %s
- Các điểm yếu: %s

Hãy viết 1-2 câu tiếng Việt ngắn gọn phân tích tổng quan: học sinh đang gặp vấn đề gì, các điểm yếu này có liên quan với nhau không, và gợi ý nên tập trung ôn gì trước.
Chỉ trả về đoạn văn bản, không thêm tiêu đề hay định dạng.`,
		req.SubjectName, req.LessonTitle, strings.Join(req.Topics, ", "))

	response, err := h.aiService.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là trợ lý giáo dục phân tích điểm yếu học sinh. Chỉ trả về 1-2 câu tiếng Việt ngắn gọn, súc tích."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		jsonErr(w, "Lỗi AI: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOk(w, map[string]string{"summary": strings.TrimSpace(response)})
}
