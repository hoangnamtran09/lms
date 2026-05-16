package main

import (
	"github.com/lms/backend/internal/achievements"
	"github.com/lms/backend/internal/ai"
	"github.com/lms/backend/internal/assignments"
	"github.com/lms/backend/internal/courses"
	"github.com/lms/backend/internal/gamification"
	"github.com/lms/backend/internal/gradelevels"
	"github.com/lms/backend/internal/lessons"
	"github.com/lms/backend/internal/parent"
	"github.com/lms/backend/internal/progress"
	"github.com/lms/backend/internal/quizzes"
	"github.com/lms/backend/internal/subjects"
	"github.com/lms/backend/internal/users"
	"github.com/lms/backend/internal/weaknesses"
	"gorm.io/gorm"
)

func migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&users.User{},
		&subjects.Subject{},
		&courses.Course{},
		&lessons.Lesson{},
		&quizzes.Quiz{},
		&assignments.Assignment{},
		&assignments.Submission{},
		&assignments.AuditLog{},
		&achievements.UserAchievement{},
		&parent.ChildLink{},
		&weaknesses.WeaknessProfile{},
		&achievements.Achievement{},
		&gamification.DiamondTransaction{},
		&gamification.Streak{},
		&progress.StudySession{},
		&ai.ChatMessageRecord{},
		&gradelevels.GradeLevel{},
	)
}
