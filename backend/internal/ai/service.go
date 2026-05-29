package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

type Service struct {
	apiURL  string
	apiKey  string
	model   string
	client  *http.Client
}

func NewService(apiURL, apiKey, model string) *Service {
	return &Service{
		apiURL: strings.TrimSuffix(apiURL, "/"),
		apiKey: apiKey,
		model:  model,
		client: &http.Client{Timeout: 60 * time.Second},
	}
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type chatChoice struct {
	Delta struct {
		Content string `json:"content"`
	} `json:"delta"`
	FinishReason string `json:"finish_reason"`
}

type chatChunk struct {
	Choices []chatChoice `json:"choices"`
}

type GradingRequest struct {
	Question   string `json:"question"`
	StudentAnswer string `json:"studentAnswer"`
	Rubric     string `json:"rubric"`
	MaxScore   int    `json:"maxScore"`
}

type GradingResult struct {
	Score    int    `json:"score"`
	Feedback string `json:"feedback"`
	Correct  bool   `json:"correct"`
}

// tryExtractContent attempts to extract text content from a parsed SSE/json chunk
// by trying multiple common field paths across different AI provider formats.
func tryExtractContent(data json.RawMessage) string {
	var payload interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return ""
	}
	return extractTextValue(payload)
}

func extractTextValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case []interface{}:
		for _, item := range v {
			if text := extractTextValue(item); text != "" {
				return text
			}
		}
	case map[string]interface{}:
		for _, key := range []string{"content", "text", "output_text", "generated_text", "response", "parts", "message", "delta", "candidates", "choices", "data", "messages", "results"} {
			if text := extractTextValue(v[key]); text != "" {
				return text
			}
		}
	}
	return ""
}

// ChatStream sends a streaming chat request and calls onChunk for each text delta.
func (s *Service) ChatStream(messages []ChatMessage, onChunk func(text string), onDone func()) error {
	reqBody := chatRequest{
		Model:    s.model,
		Messages: messages,
		Stream:   false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.apiURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}

	log.Printf("[ChatStream] Calling %s model=%s messages=%d", s.apiURL, s.model, len(messages))

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("api call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		log.Printf("[ChatStream] API error %d: %s", resp.StatusCode, string(errBody))
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(errBody))
	}

	// Read full body so we can try multiple parsing strategies
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	log.Printf("[ChatStream] Response: status=%d content-type=%s bodyLen=%d", resp.StatusCode, contentType, len(raw))

	if len(raw) == 0 {
		return fmt.Errorf("AI provider returned empty response body (status=%d, content-type=%s)", resp.StatusCode, contentType)
	}

	isSSE := strings.Contains(contentType, "text/event-stream")

	// Strategy 1: Try SSE line-by-line parsing (with flexible "data:" prefix)
	if isSSE {
		hadContent := false
		for _, line := range strings.Split(string(raw), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			// Accept "data:" with or without the trailing space
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if payload == "[DONE]" {
				onDone()
				return nil
			}
			content := tryExtractContent(json.RawMessage(payload))
			if content != "" {
				hadContent = true
				onChunk(content)
			}
			// Also check finish_reason via map for early stop
			var m map[string]interface{}
			if json.Unmarshal([]byte(payload), &m) == nil {
				if choices, _ := m["choices"].([]interface{}); len(choices) > 0 {
					if c, _ := choices[0].(map[string]interface{}); c != nil {
						if fr, _ := c["finish_reason"].(string); fr == "stop" {
							onDone()
							return nil
						}
					}
				}
			}
		}
		// If we had SSE lines with content, we're done
		if hadContent {
			onDone()
			return nil
		}
		// SSE lines existed but no content extracted — fall through to JSON parse
	}

	// Strategy 2: Try JSON non-streaming parse (works regardless of Content-Type)
	content := tryExtractContent(json.RawMessage(raw))
	if content != "" {
		log.Printf("[ChatStream] Extracted %d chars via JSON parse", len(content))
		onChunk(content)
		onDone()
		return nil
	}

	// Strategy 3: Deep fallback — unwrap nested "candidates" or "choices" wrapper
	var wrapper map[string]interface{}
	if json.Unmarshal(raw, &wrapper) == nil {
		for _, key := range []string{"candidates", "choices", "data", "messages", "results"} {
			if arr, _ := wrapper[key].([]interface{}); len(arr) > 0 {
				if first, _ := arr[0].(map[string]interface{}); first != nil {
					// Try known text paths inside the first item
					for _, field := range []string{"text", "content"} {
						if direct, _ := first[field].(string); direct != "" {
							onChunk(direct)
							onDone()
							return nil
						}
					}
					if nested, _ := first["content"].(map[string]interface{}); nested != nil {
						if parts, _ := nested["parts"].([]interface{}); len(parts) > 0 {
							if p, _ := parts[0].(map[string]interface{}); p != nil {
								if text, _ := p["text"].(string); text != "" {
									onChunk(text)
									onDone()
									return nil
								}
							}
						}
					}
				}
			}
		}
	}

	// Nothing worked — log and return the raw body as an error for debugging
	snippet := string(raw)
	if len(snippet) > 500 {
		snippet = snippet[:500]
	}
	log.Printf("[ChatStream] Failed to extract content from response. Snippet: %s", snippet)
	return fmt.Errorf("could not extract content from AI response: %s", snippet)
}

// Chat sends a non-streaming chat request and returns the full response.
func (s *Service) Chat(messages []ChatMessage) (string, error) {
	reqBody := chatRequest{
		Model:    s.model,
		Messages: messages,
		Stream:   false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", s.apiURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+s.apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, string(errBody))
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	content := tryExtractContent(json.RawMessage(raw))
	if content != "" {
		return content, nil
	}
	return "", fmt.Errorf("empty response")
}

// GradeSubmission uses AI to grade a student's answer.
func (s *Service) GradeSubmission(req GradingRequest) (*GradingResult, error) {
	prompt := fmt.Sprintf(`Hãy chấm điểm câu trả lời sau. Cho điểm từ 0 đến %d.

Câu hỏi: %s

Tiêu chí chấm: %s

Câu trả lời của học sinh: %s

Trả về JSON với 3 trường: score (số nguyên), feedback (nhận xét tiếng Việt ngắn gọn), correct (boolean).`,
		req.MaxScore, req.Question, req.Rubric, req.StudentAnswer)

	response, err := s.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là người chấm bài. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		return nil, err
	}

	var result GradingResult
	cleaned := extractJSON(response)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, fmt.Errorf("parse grade result: %w (response: %s)", err, cleaned)
	}
	return &result, nil
}

// GenerateQuiz generates quiz questions from lesson content.
func (s *Service) GenerateQuiz(lessonTitle, lessonContent string, count int) (string, error) {
	prompt := fmt.Sprintf(`Tạo %d câu hỏi trắc nghiệm cho bài học "%s".

Nội dung bài học: %s

Định dạng JSON: [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctIndex": 0, "explanation": "..."}]
Chỉ trả về JSON, không giải thích thêm.`, count, lessonTitle, truncate(lessonContent, 3000))

	return s.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là người tạo đề thi. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
}

// GenerateAssignment generates assignment questions from lesson content.
func (s *Service) GenerateAssignment(lessonTitle, subjectName, lessonContent string, questionCount int, questionType string, gradeLevel int) (string, error) {
	prompt := BuildGenerateAssignmentPrompt(lessonTitle, subjectName, lessonContent, questionCount, questionType, gradeLevel)
	return s.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo đề. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
}

// GenerateMatrixAssignment generates assignment questions following a MOET test matrix.
func (s *Service) GenerateMatrixAssignment(lessonTitle, subjectName, lessonContent string, questionCount int, questionType string, gradeLevel int, matrix interface{}) (string, error) {
	prompt := BuildMatrixAssignmentPrompt(lessonTitle, subjectName, lessonContent, questionCount, questionType, gradeLevel, matrix)
	return s.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tạo đề theo ma trận chuẩn BGDĐT. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
}

// ExtractQuestions extracts individual questions from document text.
func (s *Service) ExtractQuestions(text string) (string, error) {
	prompt := BuildExtractQuestionsPrompt(text)
	return s.Chat([]ChatMessage{
		{Role: "system", Content: "Bạn là giáo viên tách câu hỏi. Chỉ trả về JSON, không giải thích thêm."},
		{Role: "user", Content: prompt},
	})
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
