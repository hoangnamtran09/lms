package ai

import (
	"testing"

	"github.com/lms/backend/internal/weaknesses"
)

func TestGenerateSimpleRemediationQuestions(t *testing.T) {
	questions := generateSimpleRemediationQuestions("Phân số")
	if len(questions) < 2 {
		t.Fatalf("expected at least 2 questions, got %d", len(questions))
	}

	// First question should be MCQ
	q1 := questions[0]
	if q1["type"] != "mcq" {
		t.Errorf("first question type = %v, want mcq", q1["type"])
	}
	if q1["id"] == nil || q1["id"] == "" {
		t.Error("question should have an id")
	}
	if q1["question"] == "" {
		t.Error("question should have content")
	}
	if opts, ok := q1["options"].([]map[string]interface{}); !ok || len(opts) < 2 {
		t.Error("MCQ should have options")
	}
	if score, ok := q1["score"].(int); !ok || score <= 0 {
		t.Error("question should have positive score")
	}

	// Topic should appear in question text
	if q, ok := q1["question"].(string); ok {
		if len(q) == 0 {
			t.Error("question text should not be empty")
		}
	}
}

func TestExtractTextValue(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  string
	}{
		{"plain string", "hello", "hello"},
		{"string with spaces", "  hello  ", "hello"},
		{"content key", map[string]interface{}{"content": "found"}, "found"},
		{"text key", map[string]interface{}{"text": "found"}, "found"},
		{"delta key", map[string]interface{}{"delta": "found"}, "found"},
		{"nested content", map[string]interface{}{
			"candidates": []interface{}{
				map[string]interface{}{"content": "nested"},
			},
		}, "nested"},
		{"empty map", map[string]interface{}{}, ""},
		{"nil", nil, ""},
		{"number ignored", 42, ""},
		{"array of strings", []interface{}{"first"}, "first"},
		{"deep nesting", map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{
						"content": "deep",
					},
				},
			},
		}, "deep"},
		{"parts array", map[string]interface{}{
			"content": map[string]interface{}{
				"parts": []interface{}{
					map[string]interface{}{"text": "part_text"},
				},
			},
		}, "part_text"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractTextValue(tt.input)
			if got != tt.want {
				t.Errorf("extractTextValue(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestTryExtractContent(t *testing.T) {
	// Valid JSON with content field
	result := tryExtractContent([]byte(`{"content": "hello world"}`))
	if result != "hello world" {
		t.Errorf("got %q, want %q", result, "hello world")
	}

	// Valid JSON nested
	result = tryExtractContent([]byte(`{"choices":[{"message":{"content":"nested"}}]}`))
	if result != "nested" {
		t.Errorf("got %q, want %q", result, "nested")
	}

	// Invalid JSON
	result = tryExtractContent([]byte(`not json`))
	if result != "" {
		t.Errorf("expected empty for invalid JSON, got %q", result)
	}

	// Empty input
	result = tryExtractContent([]byte(``))
	if result != "" {
		t.Errorf("expected empty for empty input, got %q", result)
	}

	// No recognized keys
	result = tryExtractContent([]byte(`{"unknown": "value"}`))
	if result != "" {
		t.Errorf("expected empty for unrecognized structure, got %q", result)
	}
}

func TestMergeMastery(t *testing.T) {
	nodes := []GraphNode{
		{ID: "1", Label: "Phân số", Mastery: "50%"},
		{ID: "2", Label: "Hình học", Mastery: "80%"},
	}
	profiles := []weaknesses.WeaknessProfile{
		{Topic: "Phân số", ErrorCount: 3},
	}

	mergeMastery(nodes, profiles)

	// Weak topic should have updated mastery (not "50%")
	foundWeak := false
	for _, n := range nodes {
		if n.Label == "Phân số" {
			foundWeak = true
			if n.Mastery == "50%" {
				t.Errorf("weak topic mastery should be updated, got %s", n.Mastery)
			}
		}
	}
	if !foundWeak {
		t.Error("expected to find Phân số node")
	}
}

func TestGenerateSimpleMindMap(t *testing.T) {
	result := generateSimpleMindMap("Phân số", "Toán", "Khái niệm cơ bản về phân số.\nCách rút gọn phân số.")
	if len(result.Nodes) == 0 {
		t.Error("expected at least one node")
	}

	// Central topic should match
	if result.CentralTopic != "Phân số" {
		t.Errorf("central topic = %q, want %q", result.CentralTopic, "Phân số")
	}

	// Edges should reference valid nodes
	nodeIDs := make(map[string]bool)
	for _, n := range result.Nodes {
		nodeIDs[n.ID] = true
	}
	for _, e := range result.Edges {
		if !nodeIDs[e.Source] {
			t.Errorf("edge source %q not found in nodes", e.Source)
		}
		if !nodeIDs[e.Target] {
			t.Errorf("edge target %q not found in nodes", e.Target)
		}
	}
}
