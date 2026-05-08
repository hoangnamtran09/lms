package media

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Handler struct {
	r2BaseURL      string
	allowedOrigins []string
	s3Client       *s3.Client
	bucketName     string
	publicURL      string
}

func NewHandler(r2BaseURL string, allowedOrigins []string, accountID, accessKey, secretKey, bucketName, publicURL string) *Handler {
	h := &Handler{
		r2BaseURL:      r2BaseURL,
		allowedOrigins: allowedOrigins,
		bucketName:     bucketName,
		publicURL:      publicURL,
	}

	if accountID != "" && accessKey != "" && secretKey != "" {
		endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)
		cfg, err := config.LoadDefaultConfig(context.Background(),
			config.WithRegion("auto"),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
			config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
				func(service, region string, options ...interface{}) (aws.Endpoint, error) {
					return aws.Endpoint{URL: endpoint}, nil
				},
			)),
		)
		if err == nil {
			h.s3Client = s3.NewFromConfig(cfg)
		}
	}

	return h
}

func (h *Handler) PDF(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, `{"error":"url required"}`, http.StatusBadRequest)
		return
	}

	allowed := false
	for _, origin := range h.allowedOrigins {
		if strings.HasPrefix(url, origin) {
			allowed = true
			break
		}
	}
	if !allowed {
		http.Error(w, `{"error":"Forbidden"}`, http.StatusForbidden)
		return
	}

	resp, err := http.Get(url)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch PDF"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	io.Copy(w, resp.Body)
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	if h.s3Client == nil {
		jsonErr(w, "R2 not configured", http.StatusInternalServerError)
		return
	}

	r.ParseMultipartForm(32 << 20) // 32MB max
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonErr(w, "file required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	key, fileURL, err := h.uploadToR2(r, file, header.Filename)
	if err != nil {
		jsonErr(w, "Upload failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": fileURL, "key": key})
}

type bulkResult struct {
	Filename string `json:"filename"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Key      string `json:"key"`
	Error    string `json:"error,omitempty"`
}

func (h *Handler) BulkUpload(w http.ResponseWriter, r *http.Request) {
	if h.s3Client == nil {
		jsonErr(w, "R2 not configured", http.StatusInternalServerError)
		return
	}

	r.ParseMultipartForm(256 << 20) // 256MB max for bulk
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		jsonErr(w, "files[] required", http.StatusBadRequest)
		return
	}

	results := make([]bulkResult, len(files))
	type idxResult struct {
		idx  int
		res  bulkResult
	}

	ch := make(chan idxResult, len(files))
	for i, fh := range files {
		go func(idx int, header *multipart.FileHeader) {
			file, err := header.Open()
			if err != nil {
				ch <- idxResult{idx, bulkResult{Filename: header.Filename, Title: titleFromFilename(header.Filename), Error: err.Error()}}
				return
			}
			defer file.Close()

			key, fileURL, err := h.uploadToR2(r, file, header.Filename)
			r := bulkResult{Filename: header.Filename, Title: titleFromFilename(header.Filename), URL: fileURL, Key: key}
			if err != nil {
				r.Error = err.Error()
			}
			ch <- idxResult{idx, r}
		}(i, fh)
	}

	for range files {
		r := <-ch
		results[r.idx] = r.res
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"results": results})
}

func (h *Handler) uploadToR2(r *http.Request, file io.Reader, filename string) (key string, url string, err error) {
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, file); err != nil {
		return "", "", err
	}

	ext := filepath.Ext(filename)
	key = fmt.Sprintf("uploads/%d_%s%s", time.Now().UnixNano(), randomString(8), ext)

	_, err = h.s3Client.PutObject(r.Context(), &s3.PutObjectInput{
		Bucket:      aws.String(h.bucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String("application/pdf"),
	})
	if err != nil {
		return "", "", err
	}

	return key, h.publicURL + "/" + key, nil
}

func (h *Handler) DeleteObject(ctx context.Context, key string) error {
	if h.s3Client == nil {
		return fmt.Errorf("R2 not configured")
	}
	_, err := h.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(h.bucketName),
		Key:    aws.String(key),
	})
	return err
}

func (h *Handler) KeyFromURL(rawURL string) string {
	prefix := h.publicURL + "/"
	if !strings.HasPrefix(rawURL, prefix) {
		return ""
	}
	return strings.TrimPrefix(rawURL, prefix)
}

func (h *Handler) DeleteByURL(ctx context.Context, rawURL string) error {
	key := h.KeyFromURL(rawURL)
	if key == "" {
		return nil // Not our URL, skip
	}
	return h.DeleteObject(ctx, key)
}

func titleFromFilename(filename string) string {
	base := strings.TrimSuffix(filename, filepath.Ext(filename))
	return strings.TrimSpace(base)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
