package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/config"
	"github.com/lms/backend/internal/users"
	"gorm.io/gorm"
)

func seed(db *gorm.DB, cfg *config.Config) error {
	var count int64
	db.Model(&users.User{}).Where("username = ?", "admin").Count(&count)
	if count > 0 {
		return nil
	}

	// Create Supabase Auth users first
	adminAuthID, err := createSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole, "admin@lms.edu.vn", "Admin@123", "Quản trị viên", "admin", "SUPER_ADMIN")
	if err != nil {
		return fmt.Errorf("create supabase admin: %w", err)
	}

	studentAuthID, err := createSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole, "student01@lms.edu.vn", "Student@123", "Nguyễn Văn Học", "student01", "STUDENT")
	if err != nil {
		return fmt.Errorf("create supabase student: %w", err)
	}

	teacherAuthID, err := createSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole, "teacher01@lms.edu.vn", "Teacher@123", "Trần Thị Dạy", "teacher01", "TEACHER")
	if err != nil {
		return fmt.Errorf("create supabase teacher: %w", err)
	}

	// Create local user records linked to Supabase Auth IDs
	superAdmin := &users.User{
		ID:         uuid.New().String(),
		SupabaseID: adminAuthID,
		Username:   "admin",
		FullName:   "Quản trị viên",
		Email:      "admin@lms.edu.vn",
		Role:       "SUPER_ADMIN",
	}
	if err := db.Create(superAdmin).Error; err != nil {
		return fmt.Errorf("create super_admin: %w", err)
	}

	student := &users.User{
		ID:         uuid.New().String(),
		SupabaseID: studentAuthID,
		Username:   "student01",
		FullName:   "Nguyễn Văn Học",
		Email:      "student01@lms.edu.vn",
		Role:       "STUDENT",
		ClassID:    "class_10a1",
	}
	if err := db.Create(student).Error; err != nil {
		return fmt.Errorf("create student: %w", err)
	}

	teacher := &users.User{
		ID:         uuid.New().String(),
		SupabaseID: teacherAuthID,
		Username:   "teacher01",
		FullName:   "Trần Thị Dạy",
		Email:      "teacher01@lms.edu.vn",
		Role:       "TEACHER",
	}
	if err := db.Create(teacher).Error; err != nil {
		return fmt.Errorf("create teacher: %w", err)
	}

	fmt.Println("Seed data created (Supabase Auth + local records)")
	return nil
}

func createSupabaseUser(supabaseURL, serviceRoleKey, email, password, fullName, username, role string) (string, error) {
	if supabaseURL == "" || serviceRoleKey == "" {
		return "", fmt.Errorf("supabase not configured")
	}

	body := map[string]interface{}{
		"email":         email,
		"password":      password,
		"email_confirm": true,
		"user_metadata": map[string]string{
			"fullName": fullName,
			"username": username,
		},
		"app_metadata": map[string]string{
			"role": role,
		},
	}
	bodyJSON, _ := json.Marshal(body)

	url := strings.TrimRight(supabaseURL, "/") + "/auth/v1/admin/users"
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyJSON))
	if err != nil {
		return "", err
	}
	req.Header.Set("apikey", serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("supabase error: %s", string(respBody))
	}

	var result struct {
		ID    string `json:"id"`
		Error string `json:"error_description"`
	}
	json.Unmarshal(respBody, &result)
	if result.Error != "" {
		return "", fmt.Errorf(result.Error)
	}
	return result.ID, nil
}
