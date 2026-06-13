package ai

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/lms/backend/internal/middleware"
)

type chatInput struct {
	Message   string        `json:"message"`
	LessonID  string        `json:"lessonId"`
	SubjectID string        `json:"subjectId"`
	SessionID string        `json:"sessionId"`
	History   []ChatMessage `json:"history"`
}


// isBalanceError checks if the AI response is actually an API balance/error message.
func isBalanceError(text string) bool {
	lower := strings.ToLower(text)
	errorPatterns := []string{
		"số dư tài khoản api không đủ",
		"số dư không đủ",
		"insufficient balance",
		"insufficient quota",
		"nạp thêm",
		"platform.beeknoee.com/billing",
		"api key không hợp lệ",
		"invalid api key",
		"rate limit",
	}
	for _, p := range errorPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
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

	if req.SessionID != "" && h.progressService != nil {
		hasHistory := false
		if claims := middleware.GetClaims(r.Context()); claims != nil {
			var count int64
			h.db.WithContext(r.Context()).Model(&ChatMessageRecord{}).
				Where("user_id = ? AND lesson_id = ?", claims.UserID, req.LessonID).
				Count(&count)
			hasHistory = count > 0
		}
		if !hasHistory {
			status, err := h.progressService.GetStatus(r.Context(), req.SessionID)
			if err != nil || !status.ChatUnlocked {
				jsonErr(w, "Bạn cần đọc bài đủ thời gian để mở khoá chat", http.StatusForbidden)
				return
			}
		}
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
		responseText := fullResponse.String()

		if claims != nil {
			weaknessRe := regexp.MustCompile(`:::weakness topic="([^"]+)"`)
			matches := weaknessRe.FindAllStringSubmatch(responseText, -1)
			for _, match := range matches {
				topic := match[1]
				h.weaknessService.RecordError(r.Context(), claims.UserID, req.LessonID, topic, "chat", 0.8)
			}
		}

		quizStripRe := regexp.MustCompile(`:::quiz\s*\{[\s\S]*?\}\s*:::`)
		cleanText := quizStripRe.ReplaceAllString(responseText, "")

		// Only generate quiz every ~3 user messages to keep conversation natural
		shouldQuiz := false
		if req.LessonID != "" && lessonTitle != "" {
			if claims != nil {
				var userMsgCount int64
				h.db.WithContext(r.Context()).Model(&ChatMessageRecord{}).
					Where("user_id = ? AND lesson_id = ? AND role = ?", claims.UserID, req.LessonID, "user").
					Count(&userMsgCount)
				// Generate quiz on 3rd, 6th, 9th... user message
				shouldQuiz = (userMsgCount+1)%3 == 0
			}
		}

		if shouldQuiz {
				quizPrompt := BuildChatQuizPrompt(lessonTitle, subjectName, lessonContent, gradeLevel, responseText)
				quizResp, quizErr := h.aiService.Chat([]ChatMessage{
					{Role: "system", Content: "Bạn là người tạo câu hỏi trắc nghiệm. Chỉ trả về JSON, không giải thích thêm."},
					{Role: "user", Content: quizPrompt},
				})
				if quizErr == nil {
					var quizData struct {
						Question    string       `json:"question"`
						Options     []QuizOption `json:"options"`
						Explanation string       `json:"explanation"`
					}
					cleaned := extractJSON(quizResp)
					if err := json.Unmarshal([]byte(cleaned), &quizData); err == nil {
						if quizData.Question != "" && len(quizData.Options) > 0 {
	
							h.quizStore.Store(quizData.Question, quizData.Options, quizData.Explanation)
	
							safeOpts := make([]map[string]string, len(quizData.Options))
							for i, o := range quizData.Options {
								safeOpts[i] = map[string]string{"text": o.Text}
							}
							quizEvent, _ := json.Marshal(map[string]interface{}{
								"quiz": map[string]interface{}{
									"question":    quizData.Question,
									"options":     safeOpts,
									"explanation": quizData.Explanation,
								},
							})
							fmt.Fprintf(w, "data: %s\n\n", quizEvent)
							flusher.Flush()
						}
					} else {
						slog.Warn("[Chat] Failed to parse generated quiz", "error", err, "response", cleaned)
					}
				} else {
					slog.Warn("[Chat] Quiz generation failed", "error", quizErr)
				}
		}

		if claims != nil && req.LessonID != "" && !isBalanceError(cleanText) {
			now := time.Now()
			records := []ChatMessageRecord{
				{UserID: claims.UserID, LessonID: req.LessonID, Role: "user", Content: req.Message, CreatedAt: now},
				{UserID: claims.UserID, LessonID: req.LessonID, Role: "assistant", Content: cleanText, CreatedAt: now},
			}
			if err := h.db.WithContext(r.Context()).Create(&records).Error; err != nil {
				slog.Error("Failed to save chat history", "error", err)
			}
		}

		fmt.Fprintf(w, "data: [DONE]\n\n")
		flusher.Flush()
	})

	if err != nil {
		errData, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(w, "data: %s\n\n", errData)
		flusher.Flush()
	}
}
