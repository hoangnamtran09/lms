package ai

import (
	"testing"
)

func TestMin(t *testing.T) {
	tests := []struct {
		a, b, want int
	}{
		{1, 2, 1},
		{5, 3, 3},
		{0, 0, 0},
		{-1, 5, -1},
		{100, 200, 100},
	}
	for _, tt := range tests {
		if got := min(tt.a, tt.b); got != tt.want {
			t.Errorf("min(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		s      string
		maxLen int
		want   string
	}{
		{"hello", 10, "hello"},
		{"hello world", 5, "hello..."},
		{"abc", 3, "abc"},
		{"", 5, ""},
		{"test", 0, "..."},
	}
	for _, tt := range tests {
		if got := truncate(tt.s, tt.maxLen); got != tt.want {
			t.Errorf("truncate(%q, %d) = %q, want %q", tt.s, tt.maxLen, got, tt.want)
		}
	}
}

func TestExtractJSON(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "plain JSON object",
			raw:  `{"key": "value"}`,
			want: `{"key": "value"}`,
		},
		{
			name: "JSON with text before",
			raw:  "Some text ```json\n{\"key\": \"value\"}\n```",
			want: `{"key": "value"}`,
		},
		{
			name: "JSON array",
			raw:  `[1, 2, 3]`,
			want: `[1, 2, 3]`,
		},
		{
			name: "JSON with embedded object",
			raw:  `{"outer": {"inner": "val"}}`,
			want: `{"outer": {"inner": "val"}}`,
		},
		{
			name: "no braces — returns empty string",
			raw:  "   no json here   ",
			want: "",
		},
		{
			name: "only opening brace",
			raw:  `{"incomplete"`,
			want: `{"incomplete"`,
		},
		{
			name: "markdown code block with language",
			raw:  "```json\n{\"a\":1}\n```",
			want: `{"a":1}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractJSON(tt.raw)
			if got != tt.want {
				t.Errorf("extractJSON(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestSanitizeJSONString(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "clean string unchanged",
			in:   `{"key": "value"}`,
			want: `{"key": "value"}`,
		},
		{
			name: "tab inside JSON string gets escaped",
			in:   "{\"key\": \"val\tue\"}",
			want: "{\"key\": \"val\\tue\"}",
		},
		{
			name: "carriage return gets escaped",
			in:   "{\"key\": \"val\rue\"}",
			want: "{\"key\": \"val\\rue\"}",
		},
		{
			name: "escaped backslash preserved",
			in:   `{"key": "path\\to\\file"}`,
			want: `{"key": "path\\to\\file"}`,
		},
		{
			name: "latex invalid escape gets escaped",
			in:   `{"question": "Tính \cos 30^\circ"}`,
			want: `{"question": "Tính \\cos 30^\\circ"}`,
		},
		{
			name: "latex frac gets escaped",
			in:   `{"question": "Tính $\frac{1}{2}$"}`,
			want: `{"question": "Tính $\\frac{1}{2}$"}`,
		},
		{
			name: "latex tan and times get escaped",
			in:   `{"q": "$\tan x$ và $\times$"}`,
			want: `{"q": "$\\tan x$ và $\\times$"}`,
		},
		{
			name: "latex beta and neq get escaped",
			in:   `{"q": "$\beta$ và $a \neq b$"}`,
			want: `{"q": "$\\beta$ và $a \\neq b$"}`,
		},
		{
			name: "latex rightarrow gets escaped",
			in:   `{"q": "$x \rightarrow y$"}`,
			want: `{"q": "$x \\rightarrow y$"}`,
		},
		{
			name: "valid unicode escape preserved",
			in:   "{\"key\": \"\\u0041\"}",
			want: "{\"key\": \"\\u0041\"}",
		},
		{
			name: "escaped quote preserved",
			in:   `{"key": "say \"hi\""}`,
			want: `{"key": "say \"hi\""}`,
		},
		{
			name: "plain text outside strings unchanged",
			in:   `no quotes`,
			want: `no quotes`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeJSONString(tt.in)
			if got != tt.want {
				t.Errorf("sanitizeJSONString(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestMindmapCacheKey(t *testing.T) {
	if got := mindmapCacheKey("lesson-1"); got != "mindmap:lesson-1" {
		t.Errorf("mindmapCacheKey = %q, want %q", got, "mindmap:lesson-1")
	}
}

func TestKgCacheKey(t *testing.T) {
	if got := kgCacheKey("subject-1"); got != "kg:subject-1" {
		t.Errorf("kgCacheKey = %q, want %q", got, "kg:subject-1")
	}
}

func TestFlashcardsCacheKey(t *testing.T) {
	if got := flashcardsCacheKey("lesson-1", 10); got != "flashcards:lesson-1:10" {
		t.Errorf("flashcardsCacheKey = %q, want %q", got, "flashcards:lesson-1:10")
	}
}
