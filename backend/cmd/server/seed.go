package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/achievements"
	"github.com/lms/backend/internal/assignments"
	"github.com/lms/backend/internal/config"
	"github.com/lms/backend/internal/users"
	"time"
	"gorm.io/gorm"
)

func seed(db *gorm.DB, cfg *config.Config) error {
	// Seed achievements — always run when table is empty (idempotent)
	var achCount int64
	db.Model(&achievements.Achievement{}).Count(&achCount)
	if achCount == 0 {
		defaultAchievements := []achievements.Achievement{
			{ID: uuid.New().String(), Title: "Người mới bắt đầu", Description: "Hoàn thành bài học đầu tiên", Icon: "Star", RuleType: "lessons_completed", Threshold: 1, DiamondReward: 10, IsActive: true},
			{ID: uuid.New().String(), Title: "Chăm chỉ", Description: "Đạt streak 3 ngày liên tiếp", Icon: "Flame", RuleType: "study_streak", Threshold: 3, DiamondReward: 20, IsActive: true},
			{ID: uuid.New().String(), Title: "Siêng năng", Description: "Đạt streak 7 ngày liên tiếp", Icon: "Flame", RuleType: "study_streak", Threshold: 7, DiamondReward: 50, IsActive: true},
			{ID: uuid.New().String(), Title: "Nhà thông thái", Description: "Học tổng cộng 10 bài học", Icon: "BookOpen", RuleType: "lessons_completed", Threshold: 10, DiamondReward: 100, IsActive: true},
			{ID: uuid.New().String(), Title: "Vua trắc nghiệm", Description: "Vượt qua 5 bài kiểm tra", Icon: "Target", RuleType: "quizzes_passed", Threshold: 5, DiamondReward: 50, IsActive: true},
			{ID: uuid.New().String(), Title: "Kim cương đầu tiên", Description: "Tích luỹ 50 kim cương", Icon: "Gem", RuleType: "diamonds_earned", Threshold: 50, DiamondReward: 20, IsActive: true},
			{ID: uuid.New().String(), Title: "Chăm làm bài tập", Description: "Hoàn thành 5 bài tập", Icon: "Medal", RuleType: "assignments_done", Threshold: 5, DiamondReward: 30, IsActive: true},
			{ID: uuid.New().String(), Title: "Cao thủ kim cương", Description: "Tích luỹ 200 kim cương", Icon: "Crown", RuleType: "diamonds_earned", Threshold: 200, DiamondReward: 50, IsActive: true},
		}
		for i := range defaultAchievements {
			if err := db.Create(&defaultAchievements[i]).Error; err != nil {
				return fmt.Errorf("seed achievement: %w", err)
			}
		}
		log.Printf("Seeded %d default achievements", len(defaultAchievements))
	}

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

	teacherAuthID, err := createSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole, "teacher01@lms.edu.vn", "Teacher@123", "Trần Thị Dạy", "teacher01", "TEACHER")
	if err != nil {
		return fmt.Errorf("create supabase teacher: %w", err)
	}

	// Optionally use an existing user specified by SEED_TARGET_USERNAME
	targetUsername := os.Getenv("SEED_TARGET_USERNAME")
	var student *users.User
	if targetUsername == "" {
		// create student auth and local record
		studentAuthID, err := createSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole, "student01@lms.edu.vn", "Student@123", "Nguyễn Văn Học", "student01", "STUDENT")
		if err != nil {
			return fmt.Errorf("create supabase student: %w", err)
		}
		student = &users.User{
			ID:         uuid.New().String(),
			SupabaseID: studentAuthID,
			Username:   "student01",
			FullName:   "Nguyễn Văn Học",
			Email:      "student01@lms.edu.vn",
			Role:       "STUDENT",
			ClassID:    "class_10a1",
		}
	} else {
		// find existing local user by username
		student = &users.User{}
		if err := db.Where("username = ?", targetUsername).First(student).Error; err != nil {
			return fmt.Errorf("target user '%s' not found: %w", targetUsername, err)
		}
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

	if targetUsername == "" {
		if err := db.Create(student).Error; err != nil {
			return fmt.Errorf("create student: %w", err)
		}
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

	// Ensure student has a ClassID if using existing user
	if student.ClassID == "" {
		student.ClassID = "class_10a1"
		if err := db.Model(student).Update("class_id", "class_10a1").Error; err != nil {
			return fmt.Errorf("update student classid: %w", err)
		}
	}

	// Format StudentIDs as JSON array using SupabaseID (for matching JWT claims.UserID)
	studentIDsJSON, _ := json.Marshal([]string{student.SupabaseID})

	// Create sample assignments
	assignment1 := &assignments.Assignment{
		ID:          uuid.New().String(),
		CreatorID:   teacher.ID,
		CreatorName: teacher.FullName,
		Title:       "Bài tập Toán: Phương trình bậc hai",
		Description: "Giải các phương trình bậc hai sau và nộp đáp án dạng file PDF.",
		SubjectID:   "subject_math",
		GradeLevel:  11,
		ClassID:     student.ClassID,
		StudentIDs:  string(studentIDsJSON),
		MaxScore:    100,
		DueDate:     time.Now().Add(7 * 24 * time.Hour),
		Questions:   "[{\"q\":\"Giải: x^2 - 5x + 6 = 0\"}]",
		Status:      assignments.StatusAssigned,
	}
	if err := db.Create(assignment1).Error; err != nil {
		return fmt.Errorf("create assignment1: %w", err)
	}

	assignment2 := &assignments.Assignment{
		ID:          uuid.New().String(),
		CreatorID:   teacher.ID,
		CreatorName: teacher.FullName,
		Title:       "Bài tập Văn: Viết đoạn văn nghị luận",
		Description: "Viết một đoạn văn 200-300 từ về chủ đề học tập.",
		SubjectID:   "subject_vietnamese",
		GradeLevel:  10,
		ClassID:     student.ClassID,
		StudentIDs:  string(studentIDsJSON),
		MaxScore:    100,
		DueDate:     time.Now().Add(14 * 24 * time.Hour),
		Questions:   "[{\"q\":\"Viết đoạn văn: Tầm quan trọng của việc học\"}]",
		Status:      assignments.StatusAssigned,
	}
	if err := db.Create(assignment2).Error; err != nil {
		return fmt.Errorf("create assignment2: %w", err)
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
