package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"gorm.io/gorm"

	"github.com/lms/backend/internal/achievements"
	"github.com/lms/backend/internal/ai"
	"github.com/lms/backend/internal/analytics"
	"github.com/lms/backend/internal/assignments"
	"github.com/lms/backend/internal/auth"
	"github.com/lms/backend/internal/config"
	"github.com/lms/backend/internal/courses"
	"github.com/lms/backend/internal/gamification"
	"github.com/lms/backend/internal/lessons"
	"github.com/lms/backend/internal/media"
	"github.com/lms/backend/internal/middleware"
	"github.com/lms/backend/internal/parent"
	"github.com/lms/backend/internal/permissions"
	"github.com/lms/backend/internal/progress"
	"github.com/lms/backend/internal/quizzes"
	"github.com/lms/backend/internal/subjects"
	"github.com/lms/backend/internal/teacher"
	"github.com/lms/backend/internal/users"
	"github.com/lms/backend/internal/weaknesses"
)

type Handlers struct {
	Auth         *auth.Handler
	Users        *users.Handler
	Subjects     *subjects.Handler
	Courses      *courses.Handler
	Lessons      *lessons.Handler
	AI           *ai.Handler
	ChatHistory  *ai.ChatHistoryHandler
	Assignments  *assignments.Handler
	Media        *media.Handler
	Parent       *parent.Handler
	Progress     *progress.Handler
	Gamification *gamification.Handler
	Achievements *achievements.Handler
	Weaknesses   *weaknesses.Handler
	Teacher      *teacher.Handler
	Analytics    *analytics.Handler
}

func New(
	db *gorm.DB,
	cfg *config.Config,
) chi.Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logging)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.CORSOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Services
	usersSvc := users.NewService(db)
	authSvc := auth.NewService(cfg.JWTSecret)
	subjectsSvc := subjects.NewService(db)
	coursesSvc := courses.NewService(db)
	lessonsSvc := lessons.NewService(db)
	quizzesSvc := quizzes.NewService(db)
	assignmentsSvc := assignments.NewService(db)
	achievementsSvc := achievements.NewService(db)
	diamondSvc := gamification.NewDiamondService(db)
	streakSvc := gamification.NewStreakService(db)
	weaknessSvc := weaknesses.NewService(db)
	aiSvc := ai.NewService(cfg.AIAPIURL, cfg.AIAPIKey, cfg.AIModel)
	progressSvc := progress.NewService(db)

	// Handlers
	authH := auth.NewHandler(authSvc, usersSvc)
	usersH := users.NewHandler(usersSvc)
	subjectsH := subjects.NewHandler(subjectsSvc, db)
	coursesH := courses.NewHandler(coursesSvc)
	lessonsH := lessons.NewHandler(lessonsSvc)
	aiH := ai.NewHandler(aiSvc, lessonsSvc, weaknessSvc, diamondSvc)
	assignmentsH := assignments.NewHandler(assignmentsSvc, aiSvc)
	mediaH := media.NewHandler(cfg.R2BaseURL, []string{cfg.R2BaseURL}, cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2BucketName, cfg.R2PublicURL)

	// Wire R2 delete callbacks
	lessonsH.SetR2Delete(mediaH.DeleteByURL)
	subjectsH.SetR2Delete(mediaH.DeleteByURL)
	parentSvc := parent.NewService(db)
	parentH := parent.NewHandler(parentSvc)
	progressH := progress.NewHandler(progressSvc)
	gamificationH := gamification.NewHandler(diamondSvc, streakSvc)
	achievementsH := achievements.NewHandler(achievementsSvc, db)
	weaknessH := weaknesses.NewHandler(weaknessSvc)
	teacherH := teacher.NewHandler(db)
	analyticsH := analytics.NewHandler(db)
	chatHistorySvc := ai.NewChatHistoryService(db)
	chatHistoryH := ai.NewChatHistoryHandler(chatHistorySvc)

	// Mount
	h := &Handlers{
		Auth:         authH,
		Users:        usersH,
		Subjects:     subjectsH,
		Courses:      coursesH,
		Lessons:      lessonsH,
		AI:           aiH,
		ChatHistory:  chatHistoryH,
		Assignments:  assignmentsH,
		Media:        mediaH,
		Parent:       parentH,
		Progress:     progressH,
		Gamification: gamificationH,
		Achievements: achievementsH,
		Weaknesses:   weaknessH,
		Teacher:      teacherH,
		Analytics:    analyticsH,
	}

	_ = quizzesSvc

	mountRoutes(r, h, cfg.JWTSecret)
	return r
}

func mountRoutes(r chi.Router, h *Handlers, jwtSecret string) {
	// Public routes
	r.Post("/api/auth/login", h.Auth.Login)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(jwtSecret))

		// Auth
		r.Get("/api/auth/me", h.Auth.Me)

		// Subjects
		r.Get("/api/subjects", h.Subjects.List)
		r.Get("/api/subjects/{id}", h.Subjects.Get)
		r.With(middleware.RequirePermission(permissions.ResSubjects, permissions.ActManage)).
			Post("/api/subjects", h.Subjects.Create)
		r.With(middleware.RequirePermission(permissions.ResSubjects, permissions.ActManage)).
			Patch("/api/subjects/{id}", h.Subjects.Update)
		r.With(middleware.RequirePermission(permissions.ResSubjects, permissions.ActManage)).
			Delete("/api/subjects/{id}", h.Subjects.Delete)

		// Courses
		r.Get("/api/courses", h.Courses.List)
		r.Get("/api/courses/{id}", h.Courses.Get)
		r.With(middleware.RequirePermission(permissions.ResCourses, permissions.ActManage)).
			Post("/api/courses", h.Courses.Create)
		r.With(middleware.RequirePermission(permissions.ResCourses, permissions.ActManage)).
			Patch("/api/courses/{id}", h.Courses.Update)
		r.With(middleware.RequirePermission(permissions.ResCourses, permissions.ActManage)).
			Delete("/api/courses/{id}", h.Courses.Delete)

		// Lessons
		r.Get("/api/lessons", h.Lessons.List)
		r.Get("/api/lessons/{id}", h.Lessons.Get)
		r.Get("/api/lessons/{id}/context", h.Lessons.Context)
		r.With(middleware.RequirePermission(permissions.ResLessons, permissions.ActManage)).
			Post("/api/lessons", h.Lessons.Create)
		r.With(middleware.RequirePermission(permissions.ResLessons, permissions.ActManage)).
			Patch("/api/lessons/{id}", h.Lessons.Update)
		r.With(middleware.RequirePermission(permissions.ResLessons, permissions.ActManage)).
			Delete("/api/lessons/{id}", h.Lessons.Delete)

		// Users
		r.Get("/api/users", h.Users.List)
		r.Get("/api/users/{id}", h.Users.Get)
		r.With(middleware.RequirePermission(permissions.ResUsers, permissions.ActWrite)).
			Post("/api/users", h.Users.Create)
		r.With(middleware.RequirePermission(permissions.ResUsers, permissions.ActWrite)).
			Patch("/api/users/{id}", h.Users.Update)
		r.With(middleware.RequirePermission(permissions.ResUsers, permissions.ActManage)).
			Delete("/api/users/{id}", h.Users.Delete)

		// Assignments
		r.Get("/api/assignments", h.Assignments.List)
		r.Get("/api/assignments/{id}", h.Assignments.Get)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActWrite)).
			Post("/api/assignments", h.Assignments.Create)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActWrite)).
			Patch("/api/assignments/{id}", h.Assignments.Update)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActManage)).
			Delete("/api/assignments/{id}", h.Assignments.Delete)

		// Submissions
		r.Post("/api/assignments/{id}/submit", h.Assignments.Submit)
		r.Get("/api/assignments/{id}/submissions", h.Assignments.ListSubmissions)
		r.Get("/api/submissions/my", h.Assignments.MySubmissions)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActGrade)).
			Patch("/api/submissions/{id}/grade", h.Assignments.GradeSubmission)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActGrade)).
			Post("/api/submissions/{id}/auto-grade", h.Assignments.AutoGrade)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActGrade)).
			Post("/api/submissions/{id}/return", h.Assignments.ReturnSubmission)

		// Audit
		r.Get("/api/assignments/{id}/audit", h.Assignments.AuditTrail)

		// AI — rate limited per user (30 req/min for chat, 10 req/min for generation)
		aiRateLimitKey := func(r *http.Request) string {
			if claims := middleware.GetClaims(r.Context()); claims != nil {
				return claims.UserID
			}
			return r.RemoteAddr
		}
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(0.5, 30, aiRateLimitKey)).
			Post("/api/ai/chat", h.AI.Chat)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/grade", h.AI.Grade)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/quiz/generate", h.AI.GenerateQuiz)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/roadmap", h.AI.Roadmap)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/remediation", h.AI.GenerateRemediation)

		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			Post("/api/ai/quiz-answer", h.AI.QuizAnswer)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/generate-exercise", h.AI.GenerateExercise)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/grade-exercise", h.AI.GradeExercise)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/completion-quiz", h.AI.CompletionQuiz)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/coach", h.AI.Coach)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			With(middleware.Limit(1.0/6.0, 10, aiRateLimitKey)).
			Post("/api/ai/lesson-summary", h.AI.LessonSummary)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			Get("/api/ai/chat-history", h.ChatHistory.Load)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			Post("/api/ai/chat-history", h.ChatHistory.Save)
		r.With(middleware.RequirePermission(permissions.ResAI, permissions.ActRead)).
			Post("/api/ai/chat-history/clear", h.ChatHistory.Clear)
		// Media
		r.Get("/api/media/pdf", h.Media.PDF)
			r.With(middleware.RequirePermission(permissions.ResLessons, permissions.ActManage)).
				Post("/api/media/upload", h.Media.Upload)
			r.With(middleware.RequirePermission(permissions.ResLessons, permissions.ActManage)).
				Post("/api/media/upload-bulk", h.Media.BulkUpload)

		// Progress — study sessions
		r.Post("/api/study-sessions/start", h.Progress.StartSession)
		r.Post("/api/study-sessions/{id}/end", h.Progress.EndSession)
		r.Get("/api/study-sessions/leaderboard", h.Progress.Leaderboard)
		r.Get("/api/study-sessions/stats", h.Progress.UserStats)
		r.Get("/api/study-sessions/weekly-chart", h.Progress.WeeklyChart)

		// Gamification — diamonds
		r.Get("/api/diamonds/balance", h.Gamification.DiamondBalance)
		r.Get("/api/diamonds/history", h.Gamification.DiamondHistory)
		r.Post("/api/diamonds/earn", h.Gamification.EarnOnStudyComplete)
		r.With(middleware.RequirePermission(permissions.ResSettings, permissions.ActManage)).
			Post("/api/diamonds/award", h.Gamification.AwardDiamonds)

		// Gamification — streaks
		r.Get("/api/streaks", h.Gamification.StreakInfo)

		// Achievements
		r.Get("/api/achievements", h.Achievements.List)
		r.With(middleware.RequirePermission(permissions.ResAchievements, permissions.ActManage)).
			Post("/api/achievements", h.Achievements.Create)
		r.With(middleware.RequirePermission(permissions.ResAchievements, permissions.ActManage)).
			Patch("/api/achievements/{id}", h.Achievements.Update)
		r.With(middleware.RequirePermission(permissions.ResAchievements, permissions.ActManage)).
			Delete("/api/achievements/{id}", h.Achievements.Delete)
		r.Get("/api/achievements/my", h.Achievements.MyAchievements)
		r.With(middleware.RequirePermission(permissions.ResAchievements, permissions.ActManage)).
			Post("/api/achievements/award", h.Achievements.AwardAchievement)

		// Weaknesses — diagnosis
		r.Get("/api/weaknesses", h.Weaknesses.List)
		r.Get("/api/weaknesses/{id}", h.Weaknesses.Get)
		r.Post("/api/weaknesses/record", h.Weaknesses.RecordError)
		r.With(middleware.RequirePermission(permissions.ResAssignments, permissions.ActGrade)).
			Patch("/api/weaknesses/{id}/notes", h.Weaknesses.UpdateCoachNotes)

			// Analytics
			r.Get("/api/analytics/overview", h.Analytics.Overview)
			r.Get("/api/analytics/study-time", h.Analytics.StudyTime)
			r.With(middleware.RequirePermission(permissions.ResAnalytics, permissions.ActExport)).
				Get("/api/analytics/export/users", h.Analytics.ExportUsers)
			r.With(middleware.RequirePermission(permissions.ResAnalytics, permissions.ActExport)).
				Get("/api/analytics/export/assignments", h.Analytics.ExportAssignments)

		// Teacher dashboard
		r.Get("/api/teacher/dashboard", h.Teacher.Dashboard)

		// Parent
		r.Get("/api/parents/children", h.Parent.Children)
		r.Get("/api/parents/children/{id}", h.Parent.ChildDetail)
		r.Post("/api/parents/link", h.Parent.LinkChild)
	})

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
}
