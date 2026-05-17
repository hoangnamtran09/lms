package ai

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

// ChatStream sends a streaming chat request and calls onChunk for each text delta.
func (s *Service) ChatStream(messages []ChatMessage, onChunk func(text string), onDone func()) error {
	reqBody := chatRequest{
		Model:    s.model,
		Messages: messages,
		Stream:   true,
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

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("api call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(errBody))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			onDone()
			return nil
		}

		var chunk chatChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			onChunk(chunk.Choices[0].Delta.Content)
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].FinishReason == "stop" {
			onDone()
			return nil
		}
	}

	onDone()
	return scanner.Err()
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

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
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
