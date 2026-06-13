package flashcards

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

type ankiCard struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type importApkgResponse struct {
	Cards     []ankiCard `json:"cards"`
	DeckTitle string     `json:"deckTitle,omitempty"`
}

// ImportApkg parses an uploaded Anki .apkg file and returns the cards.
func (h *Handler) ImportApkg(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(100 << 20); err != nil { // 100 MB max
		jsonErr(w, "File quá lớn", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonErr(w, "Không tìm thấy file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".apkg") {
		jsonErr(w, "Chỉ hỗ trợ file .apkg (Anki)", http.StatusBadRequest)
		return
	}

	// Read the entire file into memory
	zipData, err := io.ReadAll(file)
	if err != nil {
		jsonErr(w, "Không thể đọc file", http.StatusInternalServerError)
		return
	}

	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		jsonErr(w, "File .apkg không hợp lệ (không phải ZIP)", http.StatusBadRequest)
		return
	}

	// Find collection.anki2 in the zip
	var ankiDB []byte
	for _, f := range zipReader.File {
		if f.Name == "collection.anki2" || strings.HasSuffix(f.Name, "collection.anki2") {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			ankiDB, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				jsonErr(w, "Không thể đọc collection.anki2", http.StatusInternalServerError)
				return
			}
			break
		}
	}

	if ankiDB == nil {
		jsonErr(w, "File .apkg không chứa collection.anki2", http.StatusBadRequest)
		return
	}

	// Write to temp file for SQLite
	tmpFile, err := os.CreateTemp("", "anki-*.anki2")
	if err != nil {
		jsonErr(w, "Lỗi hệ thống", http.StatusInternalServerError)
		return
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(ankiDB); err != nil {
		tmpFile.Close()
		jsonErr(w, "Lỗi hệ thống", http.StatusInternalServerError)
		return
	}
	tmpFile.Close()

	// Open SQLite database
	db, err := sql.Open("sqlite", tmpPath+"?mode=ro")
	if err != nil {
		jsonErr(w, "Không thể mở database Anki", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Query cards from notes table
	// notes.flds contains all fields joined by \x1f (ASCII unit separator)
	// We take the first two fields as question and answer
	rows, err := db.Query("SELECT flds FROM notes")
	if err != nil {
		jsonErr(w, "Không thể đọc thẻ từ database Anki", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var cards []ankiCard
	for rows.Next() {
		var flds string
		if err := rows.Scan(&flds); err != nil {
			continue
		}
		fields := strings.Split(flds, "\x1f")
		q := ""
		a := ""
		if len(fields) >= 1 {
			q = stripHTML(fields[0])
		}
		if len(fields) >= 2 {
			a = stripHTML(fields[1])
		}
		if q != "" {
			cards = append(cards, ankiCard{Question: q, Answer: a})
		}
	}

	// Try to get deck name
	deckTitle := ""
	deckName := strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
	// Try to extract from the JSON models in col table
	var modelsJSON string
	if err := db.QueryRow("SELECT models FROM col LIMIT 1").Scan(&modelsJSON); err == nil {
		// models is a JSON map of model_id -> {name, ...}
		var models map[string]json.RawMessage
		if json.Unmarshal([]byte(modelsJSON), &models) == nil {
			for _, v := range models {
				var m struct{ Name string }
				if json.Unmarshal(v, &m) == nil && m.Name != "" {
					if deckTitle == "" {
						deckTitle = "Anki: " + m.Name
					}
				}
			}
		}
	}
	if deckTitle == "" {
		deckTitle = "Anki: " + deckName
	}

	jsonOk(w, importApkgResponse{Cards: cards, DeckTitle: deckTitle})
}

// stripHTML removes basic HTML tags from Anki card text.
func stripHTML(s string) string {
	// Remove HTML tags
	result := strings.Builder{}
	inTag := false
	for _, c := range s {
		if c == '<' {
			inTag = true
			continue
		}
		if c == '>' {
			inTag = false
			continue
		}
		if !inTag {
			result.WriteRune(c)
		}
	}
	// Replace common HTML entities
	out := result.String()
	out = strings.ReplaceAll(out, "&nbsp;", " ")
	out = strings.ReplaceAll(out, "&amp;", "&")
	out = strings.ReplaceAll(out, "&lt;", "<")
	out = strings.ReplaceAll(out, "&gt;", ">")
	out = strings.ReplaceAll(out, "&quot;", "\"")
	out = strings.ReplaceAll(out, "&apos;", "'")
	// Collapse whitespace
	out = strings.Join(strings.Fields(out), " ")
	return strings.TrimSpace(out)
}
