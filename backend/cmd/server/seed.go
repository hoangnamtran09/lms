package main

import (
	"fmt"

	"github.com/lms/backend/internal/users"
	"gorm.io/gorm"
)

func seed(db *gorm.DB) error {
	var count int64
	db.Model(&users.User{}).Where("username = ?", "admin").Count(&count)
	if count > 0 {
		return nil
	}

	// Local user records (auth is handled by Supabase)
	superAdmin := &users.User{
		ID:       "u_admin_001",
		Username: "admin",
		FullName: "Quản trị viên",
		Email:    "admin@lms.internal",
		Role:     "SUPER_ADMIN",
	}
	if err := db.Create(superAdmin).Error; err != nil {
		return fmt.Errorf("create super_admin: %w", err)
	}

	student := &users.User{
		ID:       "u_student_001",
		Username: "student01",
		FullName: "Nguyễn Văn Học",
		Email:    "student01@lms.internal",
		Role:     "STUDENT",
		ClassID:  "class_10a1",
	}
	if err := db.Create(student).Error; err != nil {
		return fmt.Errorf("create student: %w", err)
	}

	teacher := &users.User{
		ID:       "u_teacher_001",
		Username: "teacher01",
		FullName: "Trần Thị Dạy",
		Email:    "teacher01@lms.internal",
		Role:     "TEACHER",
	}
	if err := db.Create(teacher).Error; err != nil {
		return fmt.Errorf("create teacher: %w", err)
	}

	fmt.Println("Seed data created: local user records (use Supabase Auth for login)")
	return nil
}
