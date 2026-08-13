package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/lms/backend/internal/courses"
	"github.com/lms/backend/internal/gamification"
	"github.com/lms/backend/internal/lessons"
	"github.com/lms/backend/internal/progress"
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
	progressService *progress.Service
	quizStore       *QuizStore
	db              *gorm.DB
}

func NewHandler(aiSvc *Service, lessonSvc *lessons.Service, weaknessSvc *weaknesses.Service, diamondSvc *gamification.DiamondService, courseSvc *courses.Service, cacheSvc *CacheService, progressSvc *progress.Service, db *gorm.DB) *Handler {
	return &Handler{aiService: aiSvc, lessonService: lessonSvc, weaknessService: weaknessSvc, diamondService: diamondSvc, courseService: courseSvc, cacheService: cacheSvc, progressService: progressSvc, quizStore: NewQuizStore(), db: db}
}

type remediationRequest struct {
	WeaknessID string `json:"weaknessId"`
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

	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")

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

	s = s[startIdx:]

	if strings.HasPrefix(s, "[") {
		if idx := strings.LastIndex(s, "]"); idx > 0 {
			s = s[:idx+1]
		}
	} else if strings.HasPrefix(s, "{") {
		if idx := strings.LastIndex(s, "}"); idx > 0 {
			s = s[:idx+1]
		}
	}

	s = sanitizeJSONString(s)

	return s
}

// sanitizeJSONString makes an AI-generated JSON string safe to parse with
// encoding/json. LLMs often emit LaTeX backslashes (\frac, \cos, \alpha, …)
// and raw control characters inside JSON string values, which are invalid JSON
// escapes. This rewrites only the invalid escapes (turning "\c" into "\\c")
// while leaving valid JSON escapes untouched.
func sanitizeJSONString(s string) string {
	runes := []rune(s)
	var b strings.Builder
	b.Grow(len(s))

	inString := false
	for i := 0; i < len(runes); i++ {
		r := runes[i]

		if !inString {
			if r == '"' {
				inString = true
			}
			b.WriteRune(r)
			continue
		}

		switch r {
		case '\\':
			if i+1 < len(runes) && isValidJSONEscape(runes[i+1:]) {
				// Valid escape (\n, \", \\, A, …): keep as-is.
				b.WriteRune(r)
				b.WriteRune(runes[i+1])
				i++
			} else {
				// Invalid escape (LaTeX \c, \s, \a, …): escape the backslash
				// so it becomes a literal "\".
				b.WriteString("\\\\")
			}
		case '"':
			inString = false
			b.WriteRune(r)
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
	}
	return b.String()
}

func isHexDigit(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

// isValidJSONEscape reports whether the runes immediately following a backslash
// form a valid JSON escape sequence.
func isValidJSONEscape(rest []rune) bool {
	if len(rest) == 0 {
		return false
	}
	switch rest[0] {
	case '"', '\\', '/':
		return true
	case 'u':
		if len(rest) < 5 {
			return false
		}
		for _, h := range rest[1:5] {
			if !isHexDigit(h) {
				return false
			}
		}
		return true
	default:
		return false
	}
}

// POST /api/ai/generate-weakness-quiz
type weaknessRef struct {
	ID    string `json:"id"`
	Topic string `json:"topic"`
}
