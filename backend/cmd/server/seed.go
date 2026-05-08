package main

import (
	"fmt"

	"github.com/lms/backend/internal/auth"
	"github.com/lms/backend/internal/users"
	"gorm.io/gorm"
)

func seed(db *gorm.DB) error {
	// Check if SUPER_ADMIN exists
	var count int64
	db.Model(&users.User{}).Where("username = ?", "admin").Count(&count)
	if count > 0 {
		return nil
	}

	authSvc := auth.NewService("dev-jwt-secret-change-in-production")
	hash, err := authSvc.HashPassword("admin123")
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	superAdmin := &users.User{
		ID:           "u_admin_001",
		Username:     "admin",
		PasswordHash: hash,
		FullName:     "Quản trị viên",
		Role:         "SUPER_ADMIN",
	}
	if err := db.Create(superAdmin).Error; err != nil {
		return fmt.Errorf("create super_admin: %w", err)
	}

	// Create sample student
	studentHash, _ := authSvc.HashPassword("student123")
	student := &users.User{
		ID:           "u_student_001",
		Username:     "student01",
		PasswordHash: studentHash,
		FullName:     "Nguyễn Văn Học",
		Role:         "STUDENT",
		ClassID:      "class_10a1",
	}
	if err := db.Create(student).Error; err != nil {
		return fmt.Errorf("create student: %w", err)
	}

	// Create sample teacher
	teacherHash, _ := authSvc.HashPassword("teacher123")
	teacher := &users.User{
		ID:           "u_teacher_001",
		Username:     "teacher01",
		PasswordHash: teacherHash,
		FullName:     "Trần Thị Dạy",
		Role:         "TEACHER",
	}
	if err := db.Create(teacher).Error; err != nil {
		return fmt.Errorf("create teacher: %w", err)
	}

	fmt.Println("Seed data created: admin/admin123, student01/student123, teacher01/teacher123")
	return nil
}
