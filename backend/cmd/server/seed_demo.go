package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lms/backend/internal/achievements"
	"github.com/lms/backend/internal/assignments"
	"github.com/lms/backend/internal/attendance"
	"github.com/lms/backend/internal/classes"
	"github.com/lms/backend/internal/config"
	"github.com/lms/backend/internal/courses"
	"github.com/lms/backend/internal/flashcards"
	"github.com/lms/backend/internal/gamification"
	"github.com/lms/backend/internal/gradelevels"
	"github.com/lms/backend/internal/lessons"
	"github.com/lms/backend/internal/notifications"
	"github.com/lms/backend/internal/parent"
	"github.com/lms/backend/internal/progress"
	"github.com/lms/backend/internal/quizzes"
	"github.com/lms/backend/internal/reports"
	"github.com/lms/backend/internal/subjects"
	"github.com/lms/backend/internal/users"
	"github.com/lms/backend/internal/weaknesses"

	"gorm.io/gorm"
)

func seedDemo(db *gorm.DB, cfg *config.Config) error {
	// Idempotent check: if demo student already has study sessions, skip
	var demoStudentID string
	db.Table("users").Where("username = ?", "demo_student").Select("id").Scan(&demoStudentID)
	if demoStudentID != "" {
		var sessionCount int64
		db.Table("study_sessions").Where("user_id = ?", demoStudentID).Count(&sessionCount)
		if sessionCount > 0 {
			fmt.Println("Demo seed: data already exists, skipping")
			return nil
		}
	}
	fmt.Println("Demo seed: creating demo accounts and sample data...")

	// ── Step 1: Grade Levels ──────────────────────────────────────────
	var glCount int64
	db.Model(&gradelevels.GradeLevel{}).Count(&glCount)
	gradeLevelMap := make(map[int]string) // level -> ID
	if glCount == 0 {
		for i := 6; i <= 12; i++ {
			gl := &gradelevels.GradeLevel{Name: fmt.Sprintf("Lớp %d", i), Level: i}
			if err := db.Create(gl).Error; err != nil {
				return fmt.Errorf("create grade level %d: %w", i, err)
			}
			gradeLevelMap[i] = gl.ID
		}
		fmt.Println("  Created 7 grade levels")
	} else {
		var all []gradelevels.GradeLevel
		db.Find(&all)
		for _, gl := range all {
			gradeLevelMap[gl.Level] = gl.ID
		}
	}
	grade10ID := gradeLevelMap[10]

	// ── Step 2: Supabase Auth Users ────────────────────────────────────
	studentAuthID, err := getOrCreateSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole,
		"demo_student@lms.edu.vn", "Demo@123", "Nguyễn Minh Anh", "demo_student", "STUDENT")
	if err != nil {
		return fmt.Errorf("create supabase student: %w", err)
	}
	teacherAuthID, err := getOrCreateSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole,
		"demo_teacher@lms.edu.vn", "Demo@123", "Phạm Văn Hùng", "demo_teacher", "TEACHER")
	if err != nil {
		return fmt.Errorf("create supabase teacher: %w", err)
	}
	parentAuthID, err := getOrCreateSupabaseUser(cfg.SupabaseURL, cfg.SupabaseServiceRole,
		"demo_parent@lms.edu.vn", "Demo@123", "Nguyễn Thị Hương", "demo_parent", "PARENT")
	if err != nil {
		return fmt.Errorf("create supabase parent: %w", err)
	}
	fmt.Println("  Created 3 Supabase Auth users")

	// ── Step 3: Class ──────────────────────────────────────────────────
	demoClassID := uuid.New().String()
	demoClass := &classes.Class{
		ID:           demoClassID,
		Name:         "10A1",
		GradeLevelID: grade10ID,
		SortOrder:    1,
	}
	if err := db.Create(demoClass).Error; err != nil {
		return fmt.Errorf("create class: %w", err)
	}
	fmt.Println("  Created class 10A1")

	// ── Step 4: Local User Records ─────────────────────────────────────
	demoStudent := &users.User{
		ID:         uuid.New().String(),
		SupabaseID: studentAuthID,
		Username:   "demo_student",
		FullName:   "Nguyễn Minh Anh",
		Email:      "demo_student@lms.edu.vn",
		Role:       "STUDENT",
		ClassID:    demoClassID,
	}
	if err := db.Create(demoStudent).Error; err != nil {
		return fmt.Errorf("create student: %w", err)
	}

	demoTeacher := &users.User{
		ID:         uuid.New().String(),
		SupabaseID: teacherAuthID,
		Username:   "demo_teacher",
		FullName:   "Phạm Văn Hùng",
		Email:      "demo_teacher@lms.edu.vn",
		Role:       "TEACHER",
		ClassID:    demoClassID,
	}
	if err := db.Create(demoTeacher).Error; err != nil {
		return fmt.Errorf("create teacher: %w", err)
	}

	demoParent := &users.User{
		ID:         uuid.New().String(),
		SupabaseID: parentAuthID,
		Username:   "demo_parent",
		FullName:   "Nguyễn Thị Hương",
		Email:      "demo_parent@lms.edu.vn",
		Role:       "PARENT",
	}
	if err := db.Create(demoParent).Error; err != nil {
		return fmt.Errorf("create parent: %w", err)
	}

	// Update class teacher
	db.Model(&classes.Class{}).Where("id = ?", demoClassID).Update("teacher_id", demoTeacher.ID)
	fmt.Println("  Created 3 local user records")

	// ── Step 5: Subjects ───────────────────────────────────────────────
	var subjCount int64
	db.Model(&subjects.Subject{}).Count(&subjCount)
	subjectMap := make(map[string]string) // key -> ID
	if subjCount == 0 {
		for _, s := range []struct {
			id, name, icon, color, desc string
		}{
			{"subject_toan_10", "Toán", "Calculator", "#EF4444", "Kiến thức toán học lớp 10"},
			{"subject_nguvan_10", "Ngữ văn", "BookOpen", "#3B82F6", "Văn học và ngôn ngữ lớp 10"},
			{"subject_tienganh_10", "Tiếng Anh", "Globe", "#10B981", "Tiếng Anh giao tiếp và ngữ pháp lớp 10"},
		} {
			subj := &subjects.Subject{ID: s.id, Name: s.name, Icon: s.icon, Color: s.color, Description: s.desc, GradeLevel: 10, SortOrder: 1}
			if err := db.Create(subj).Error; err != nil {
				return fmt.Errorf("create subject %s: %w", s.name, err)
			}
			subjectMap[s.id] = s.id
		}
		fmt.Println("  Created 3 subjects")
	} else {
		var all []subjects.Subject
		db.Find(&all)
		for _, s := range all {
			subjectMap[s.ID] = s.ID
		}
	}

	// ── Step 6: Courses ────────────────────────────────────────────────
	var courseCount int64
	db.Model(&courses.Course{}).Count(&courseCount)
	courseMap := make(map[string]string) // key -> ID
	if courseCount == 0 {
		courseDefs := []struct {
			key, subjectID, title, desc string
			sortOrder                   int
		}{
			{"dai_so_10", subjectMap["subject_toan_10"], "Đại số 10", "Kiến thức đại số cơ bản lớp 10", 1},
			{"hinh_hoc_10", subjectMap["subject_toan_10"], "Hình học 10", "Kiến thức hình học cơ bản lớp 10", 2},
			{"van_hoc_vn", subjectMap["subject_nguvan_10"], "Văn học Việt Nam", "Tác phẩm văn học Việt Nam lớp 10", 1},
			{"nghi_luan_xh", subjectMap["subject_nguvan_10"], "Nghị luận xã hội", "Kỹ năng viết văn nghị luận", 2},
			{"eng_grammar", subjectMap["subject_tienganh_10"], "English Grammar", "Ngữ pháp tiếng Anh lớp 10", 1},
			{"eng_reading", subjectMap["subject_tienganh_10"], "English Reading", "Đọc hiểu tiếng Anh lớp 10", 2},
		}
		for _, cd := range courseDefs {
			c := &courses.Course{SubjectID: cd.subjectID, Title: cd.title, Description: cd.desc, GradeLevel: 10, SortOrder: cd.sortOrder, IsPublished: true}
			if err := db.Create(c).Error; err != nil {
				return fmt.Errorf("create course %s: %w", cd.title, err)
			}
			courseMap[cd.key] = c.ID
		}
		fmt.Println("  Created 6 courses")
	} else {
		var all []courses.Course
		db.Find(&all)
		for _, c := range all {
			courseMap[c.ID] = c.ID
		}
	}

	// ── Step 7: Lessons ────────────────────────────────────────────────
	var lessonCount int64
	db.Model(&lessons.Lesson{}).Count(&lessonCount)
	lessonIDs := make([]string, 0, 18)
	lessonMapByKey := make(map[string]string) // key -> ID
	if lessonCount == 0 {
		lessonDefs := []struct {
			key, courseKey, title, desc, summary, objectives string
			sortOrder                                         int
		}{
			// Đại số 10
			{"ds_menh_de", "dai_so_10", "Mệnh đề và tập hợp", "Mệnh đề logic và các phép toán trên tập hợp", "Mệnh đề, tập hợp và các phép toán", "Nắm vững khái niệm mệnh đề và tập hợp", 1},
			{"ds_ham_so", "dai_so_10", "Hàm số bậc nhất", "Hàm số bậc nhất và đồ thị", "Định nghĩa, tính chất và đồ thị hàm số bậc nhất", "Vẽ và phân tích đồ thị hàm số bậc nhất", 2},
			{"ds_pt_bac_hai", "dai_so_10", "Phương trình bậc hai", "Phương trình bậc hai và công thức nghiệm", "Công thức nghiệm và ứng dụng", "Giải thành thạo phương trình bậc hai", 3},
			// Hình học 10
			{"hh_vecto", "hinh_hoc_10", "Vectơ trong mặt phẳng", "Khái niệm vectơ và các phép toán", "Vectơ, tổng và hiệu hai vectơ", "Hiểu và vận dụng các phép toán vectơ", 1},
			{"hh_tich_vo_huong", "hinh_hoc_10", "Tích vô hướng của hai vectơ", "Định nghĩa và ứng dụng tích vô hướng", "Tích vô hướng và góc giữa hai vectơ", "Tính được tích vô hướng và góc giữa hai vectơ", 2},
			{"hh_pt_duong_thang", "hinh_hoc_10", "Phương trình đường thẳng", "Phương trình tham số và tổng quát của đường thẳng", "Các dạng phương trình đường thẳng", "Viết được phương trình đường thẳng", 3},
			// Văn học Việt Nam
			{"van_truyen_kieu", "van_hoc_vn", "Truyện Kiều - Nguyễn Du", "Tác phẩm Truyện Kiều của đại thi hào Nguyễn Du", "Phân tích giá trị nội dung và nghệ thuật Truyện Kiều", "Hiểu và phân tích được các đoạn trích Truyện Kiều", 1},
			{"van_chi_pheo", "van_hoc_vn", "Chí Phèo - Nam Cao", "Tác phẩm Chí Phèo của nhà văn Nam Cao", "Phân tích nhân vật Chí Phèo và giá trị hiện thực", "Phân tích được bi kịch của nhân vật Chí Phèo", 2},
			{"van_vo_nhat", "van_hoc_vn", "Vợ nhặt - Kim Lân", "Tác phẩm Vợ nhặt của nhà văn Kim Lân", "Giá trị nhân đạo trong tác phẩm Vợ nhặt", "Phân tích được tình huống truyện độc đáo", 3},
			// Nghị luận xã hội
			{"nl_mo_bai", "nghi_luan_xh", "Cách viết mở bài nghị luận", "Kỹ thuật viết mở bài cho bài văn nghị luận", "Các cách mở bài: trực tiếp, gián tiếp, so sánh", "Viết được mở bài ấn tượng", 1},
			{"nl_lap_luan", "nghi_luan_xh", "Lập luận trong văn nghị luận", "Các phương pháp lập luận", "Lập luận diễn dịch, quy nạp, so sánh, nhân quả", "Sử dụng thành thạo các phương pháp lập luận", 2},
			{"nl_ket_bai", "nghi_luan_xh", "Kết bài và dẫn chứng", "Kỹ thuật viết kết bài và sử dụng dẫn chứng", "Các loại kết bài và cách chọn dẫn chứng", "Viết được kết bài thuyết phục", 3},
			// English Grammar
			{"eng_present", "eng_grammar", "Present Tenses", "Present Simple, Present Continuous, Present Perfect", "Cách dùng và cấu trúc các thì hiện tại", "Phân biệt và sử dụng đúng các thì hiện tại", 1},
			{"eng_past", "eng_grammar", "Past Tenses", "Past Simple, Past Continuous, Past Perfect", "Cách dùng và cấu trúc các thì quá khứ", "Phân biệt và sử dụng đúng các thì quá khứ", 2},
			{"eng_conditional", "eng_grammar", "Conditional Sentences", "Câu điều kiện loại 1, 2, 3", "Cấu trúc và cách dùng các loại câu điều kiện", "Sử dụng thành thạo các loại câu điều kiện", 3},
			// English Reading
			{"eng_skim", "eng_reading", "Skimming Techniques", "Kỹ thuật đọc lướt để nắm ý chính", "Các chiến lược skimming hiệu quả", "Đọc lướt và nắm được ý chính trong 2 phút", 1},
			{"eng_main_idea", "eng_reading", "Main Idea Identification", "Kỹ thuật xác định ý chính của đoạn văn", "Phân biệt main idea và supporting details", "Xác định chính xác main idea của đoạn văn", 2},
			{"eng_inference", "eng_reading", "Inference Questions", "Kỹ thuật trả lời câu hỏi suy luận", "Các bước suy luận từ văn bản", "Trả lời đúng câu hỏi inference", 3},
		}
		for _, ld := range lessonDefs {
			courseID := courseMap[ld.courseKey]
			l := &lessons.Lesson{
				CourseID: courseID, Title: ld.title, Description: ld.desc,
				Summary: ld.summary, Objectives: ld.objectives,
				DurationMinutes: 45, SortOrder: ld.sortOrder, IsPublished: true,
			}
			if err := db.Create(l).Error; err != nil {
				return fmt.Errorf("create lesson %s: %w", ld.title, err)
			}
			lessonIDs = append(lessonIDs, l.ID)
			lessonMapByKey[ld.key] = l.ID
		}
		fmt.Println("  Created 18 lessons")
	} else {
		var all []lessons.Lesson
		db.Find(&all)
		for _, l := range all {
			lessonIDs = append(lessonIDs, l.ID)
		}
	}

	// ── Step 8: Assignments ────────────────────────────────────────────
	studentSupabaseIDs, _ := json.Marshal([]string{studentAuthID})
	today := time.Now()
	makeDate := func(daysAgo int) time.Time {
		return time.Date(today.Year(), today.Month(), today.Day(), 10, 0, 0, 0, today.Location()).AddDate(0, 0, -daysAgo)
	}

	assignmentDefs := []struct {
		title, subjectID   string
		daysAgo, dueOffset int
		questions          string
	}{
		{"Bài tập Toán: Phương trình bậc hai", subjectMap["subject_toan_10"], 14, 7, `[{"q":"Giải phương trình: x² - 5x + 6 = 0"},{"q":"Tìm m để phương trình x² - 2mx + m - 1 = 0 có nghiệm kép"},{"q":"Giải: 2x² + 3x - 5 = 0"}]`},
		{"Bài tập Toán: Hàm số bậc nhất", subjectMap["subject_toan_10"], 10, 7, `[{"q":"Vẽ đồ thị hàm số y = 2x - 3"},{"q":"Tìm giao điểm của y = x + 1 và y = -2x + 4"},{"q":"Xét tính đồng biến của y = (m-1)x + 2"}]`},
		{"Bài tập Văn: Phân tích nhân vật Chí Phèo", subjectMap["subject_nguvan_10"], 7, 0, `[{"q":"Phân tích bi kịch bị từ chối quyền làm người của Chí Phèo"},{"q":"Nêu giá trị hiện thực và nhân đạo trong tác phẩm"}]`},
		{"Bài tập Tiếng Anh: Conditional Sentences", subjectMap["subject_tienganh_10"], 21, -7, `[{"q":"Complete: If I ___ (be) you, I would study harder."},{"q":"Write a conditional type 3 sentence about yesterday's missed bus."}]`},
		{"Bài tập Toán: Vectơ trong mặt phẳng", subjectMap["subject_toan_10"], 5, 2, `[{"q":"Cho vectơ a = (2,3), b = (-1,4). Tính a + b"},{"q":"Chứng minh 3 điểm A(1,2), B(3,5), C(5,8) thẳng hàng"}]`},
	}

	assignmentRecords := make([]*assignments.Assignment, 0, len(assignmentDefs))
	for _, ad := range assignmentDefs {
		dueDate := makeDate(ad.daysAgo - ad.dueOffset)
		a := &assignments.Assignment{
			ID:          uuid.New().String(),
			CreatorID:   demoTeacher.ID,
			CreatorName: demoTeacher.FullName,
			Title:       ad.title,
			Description: "Hoàn thành bài tập và nộp trước hạn.",
			SubjectID:   ad.subjectID,
			GradeLevel:  10,
			ClassID:     demoClassID,
			StudentIDs:  string(studentSupabaseIDs),
			MaxScore:    100,
			DueDate:     dueDate,
			Questions:   ad.questions,
			Status:      assignments.StatusAssigned,
			Source:      "teacher",
			CreatedAt:   makeDate(ad.daysAgo),
		}
		if err := db.Create(a).Error; err != nil {
			return fmt.Errorf("create assignment %s: %w", ad.title, err)
		}
		assignmentRecords = append(assignmentRecords, a)
	}
	fmt.Println("  Created 5 assignments")

	// ── Step 9: Submissions ────────────────────────────────────────────
	intPtr := func(v int) *int { return &v }

	gradedAt1 := makeDate(10)
	gradedAt2 := makeDate(6)
	gradedAt3 := makeDate(16)

	submissionDefs := []struct {
		assignment *assignments.Assignment
		score      *int
		feedback   string
		status     string
		daysAgo    int
		gradedAt   *time.Time
		content    string
	}{
		{assignmentRecords[0], intPtr(85), "Bài làm tốt, trình bày rõ ràng. Cần cẩn thận hơn ở bước kết luận nghiệm.", assignments.StatusGraded, 12, &gradedAt1, "x² - 5x + 6 = 0\nΔ = 25 - 24 = 1 > 0\nx₁ = (5 + 1)/2 = 3, x₂ = (5 - 1)/2 = 2\nVậy S = {2, 3}"},
		{assignmentRecords[1], intPtr(72), "Hiểu bài nhưng còn sai sót ở phần xét đồng biến.", assignments.StatusGraded, 8, &gradedAt2, "y = 2x - 3: đồ thị là đường thẳng qua A(0,-3) và B(1,-1)"},
		{assignmentRecords[2], nil, "", assignments.StatusSubmitted, 3, nil, "Chí Phèo là nhân vật điển hình cho người nông dân bị tha hóa..."},
		{assignmentRecords[3], intPtr(90), "Excellent! Good understanding of conditionals.", assignments.StatusGraded, 18, &gradedAt3, "If I were you, I would study harder."},
	}
	for _, sd := range submissionDefs {
		submittedAt := makeDate(sd.daysAgo)
		sub := &assignments.Submission{
			ID:           uuid.New().String(),
			AssignmentID: sd.assignment.ID,
			StudentID:    demoStudent.ID,
			StudentName:  demoStudent.FullName,
			Content:      sd.content,
			Score:        sd.score,
			Feedback:     sd.feedback,
			Status:       sd.status,
			GradedBy:     demoTeacher.ID,
			SubmittedAt:  submittedAt,
			GradedAt:     sd.gradedAt,
			CreatedAt:    submittedAt,
		}
		if err := db.Create(sub).Error; err != nil {
			return fmt.Errorf("create submission: %w", err)
		}
	}
	fmt.Println("  Created 4 submissions (3 graded, 1 pending)")

	// ── Step 10: Study Sessions (4 weeks, ~45 sessions) ─────────────────
	// Week start dates (Mondays): Apr 28, May 5, May 12, May 19
	weekStarts := []time.Time{
		time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 5, 12, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 5, 19, 0, 0, 0, 0, time.UTC),
	}

	// Sessions per week - increasing trend
	weekLessonCounts := []int{9, 11, 12, 13}
	totalSessions := 0
	for weekIdx, weekStart := range weekStarts {
		nSessions := weekLessonCounts[weekIdx]
		// Select lessons for this week (cycle through lesson pool)
		for s := 0; s < nSessions; s++ {
			// Pick a weekday (Mon-Sat), skip some days randomly
			dayOffset := s % 6 // Mon(0) to Sat(5)
			if weekIdx == 0 && (dayOffset == 2) {
				continue // Wed skipped in week 1
			}

			sessionDate := weekStart.AddDate(0, 0, dayOffset)
			if sessionDate.After(today) {
				continue
			}

			// Duration: 25-90 min -> 1500-5400 seconds
			durationSec := 1500 + (s*137)%3900 // pseudo-random but deterministic

			lessonIdx := (weekIdx*13 + s*3) % len(lessonIDs)
			startTime := sessionDate.Add(time.Duration(8+s%6)*time.Hour + time.Duration(s%60)*time.Minute)
			endTime := startTime.Add(time.Duration(durationSec) * time.Second)
			heartbeatTime := endTime

			session := &progress.StudySession{
				ID:              uuid.New().String(),
				UserID:          demoStudent.ID,
				LessonID:        lessonIDs[lessonIdx],
				CourseID:        "",
				DurationSeconds: durationSec,
				StartedAt:       startTime,
				EndedAt:         &endTime,
				LastHeartbeatAt: &heartbeatTime,
			}
			if err := db.Create(session).Error; err != nil {
				return fmt.Errorf("create study session: %w", err)
			}
			totalSessions++
		}
	}
	fmt.Printf("  Created %d study sessions across 4 weeks\n", totalSessions)

	// ── Step 11: Weakness Profiles ─────────────────────────────────────
	yesterday := time.Now().AddDate(0, 0, -1)
	weekAgo := time.Now().AddDate(0, 0, -7)
	twoWeeksAgo := time.Now().AddDate(0, 0, -14)
	resolvedAt := weekAgo

	weaknessDefs := []struct {
		topic, source, lessonKey string
		errorCount, quizAttempts, quizCorrect, improvementScore int
		resolved                                                 bool
		coachNotes                                               string
		lastErrorAt                                              *time.Time
		weight                                                   float64
	}{
		{"Câu điều kiện loại 2", "quiz", "eng_conditional", 5, 8, 3, 0, false, "", &yesterday, 1.5},
		{"Tích vô hướng vectơ", "quiz", "hh_tich_vo_huong", 3, 5, 2, 1, false, "", &weekAgo, 1.0},
		{"Phân tích nhân vật", "exercise", "van_chi_pheo", 4, 0, 0, 0, false, "", &yesterday, 0.8},
		{"Mệnh đề toán học", "quiz", "ds_menh_de", 2, 4, 2, 3, true, "Đã tiến bộ rõ rệt!", &twoWeeksAgo, 0.5},
		{"Present Perfect vs Past Simple", "quiz", "eng_past", 4, 6, 2, 0, false, "", &weekAgo, 1.2},
		{"Lập luận nghị luận", "exercise", "nl_lap_luan", 3, 0, 0, 0, false, "Cần luyện thêm về cách triển khai luận điểm", &yesterday, 0.8},
		{"Phương trình bậc hai chứa tham số", "quiz", "ds_pt_bac_hai", 2, 3, 1, 0, false, "", &weekAgo, 0.7},
	}

	for _, wd := range weaknessDefs {
		var lessonID string
		if lk := wd.lessonKey; lk != "" {
			lessonID = lessonMapByKey[lk]
		}
		var resolvedAtPtr *time.Time
		if wd.resolved {
			resolvedAtPtr = &resolvedAt
		}
		wp := &weaknesses.WeaknessProfile{
			ID:               uuid.New().String(),
			UserID:           demoStudent.ID,
			LessonID:         lessonID,
			Topic:            wd.topic,
			Source:           wd.source,
			Weight:           wd.weight,
			ErrorCount:       wd.errorCount,
			QuizAttempts:     wd.quizAttempts,
			QuizCorrect:      wd.quizCorrect,
			LastErrorAt:      wd.lastErrorAt,
			ImprovementScore: wd.improvementScore,
			Resolved:         wd.resolved,
			ResolvedAt:       resolvedAtPtr,
			CoachNotes:       wd.coachNotes,
		}
		if err := db.Create(wp).Error; err != nil {
			return fmt.Errorf("create weakness: %w", err)
		}
	}
	fmt.Println("  Created 7 weakness profiles")

	// ── Step 12: Diamond Transactions ───────────────────────────────────
	diamondReasons := []struct {
		amount int
		reason string
	}{
		{25, "study_complete"}, {25, "study_complete"}, {25, "study_complete"},
		{50, "quiz_pass"}, {50, "quiz_pass"},
		{30, "assignment_submit"}, {30, "assignment_submit"}, {30, "assignment_submit"},
		{60, "assignment_grade"}, {40, "assignment_grade"}, {60, "assignment_grade"},
		{100, "streak_milestone"}, {100, "streak_milestone"},
		{5, "daily_login"}, {5, "daily_login"}, {5, "daily_login"}, {5, "daily_login"}, {5, "daily_login"},
		{10, "daily_login"}, {10, "daily_login"}, {10, "daily_login"},
		{50, "achievement"}, {50, "achievement"}, {50, "achievement"},
		{80, "assignment_grade"},
		{5, "daily_login"}, {5, "daily_login"}, {5, "daily_login"}, {5, "daily_login"},
		{25, "study_complete"}, {25, "study_complete"}, {25, "study_complete"}, {25, "study_complete"},
		{50, "quiz_pass"},
		{30, "assignment_submit"},
		{5, "daily_login"}, {5, "daily_login"}, {5, "daily_login"},
	}

	for i, dr := range diamondReasons {
		daysAgo := (i * 3) % 28
		dt := &gamification.DiamondTransaction{
			UserID:  demoStudent.ID,
			Amount:  dr.amount,
			Reason:  dr.reason,
			CreatedAt: makeDate(daysAgo),
		}
		if err := db.Create(dt).Error; err != nil {
			return fmt.Errorf("create diamond transaction: %w", err)
		}
	}
	fmt.Printf("  Created %d diamond transactions\n", len(diamondReasons))

	// ── Step 13: Streak ────────────────────────────────────────────────
	streak := &gamification.Streak{
		ID:            uuid.New().String(),
		UserID:        demoStudent.ID,
		CurrentStreak: 8,
		LongestStreak: 12,
		LastStudyDate: &yesterday,
	}
	if err := db.Create(streak).Error; err != nil {
		return fmt.Errorf("create streak: %w", err)
	}
	fmt.Println("  Created streak record (current: 8, longest: 12)")

	// ── Step 14: Weekly Reports ────────────────────────────────────────
	reportWeeks := []struct {
		weekStart, weekEnd       string
		totalMin, prevMin        int
		completed, diamonds      int
		prevDiamonds             int
		avgScore                 float64
		streak                   int
		dailyStudy               []reports.DailyStudyEntry
		weaknesses               []reports.WeaknessEntry
		title, assessment        string
		highlights               []string
		weaknessAnalysis         string
		trendComparison          string
		recommendations          []string
		coachMessage             string
	}{
		{
			weekStart: "2026-05-05", weekEnd: "2026-05-11",
			totalMin: 320, prevMin: 250, completed: 1, diamonds: 180, prevDiamonds: 120, avgScore: 78, streak: 5,
			dailyStudy: []reports.DailyStudyEntry{
				{Date: "2026-05-05", Minutes: 45}, {Date: "2026-05-06", Minutes: 60}, {Date: "2026-05-07", Minutes: 30},
				{Date: "2026-05-08", Minutes: 55}, {Date: "2026-05-09", Minutes: 0}, {Date: "2026-05-10", Minutes: 40}, {Date: "2026-05-11", Minutes: 90},
			},
			weaknesses: []reports.WeaknessEntry{
				{Topic: "Câu điều kiện loại 2", ErrorCount: 5, Trend: "up"},
				{Topic: "Tích vô hướng vectơ", ErrorCount: 3, Trend: "stable"},
				{Topic: "Phân tích nhân vật", ErrorCount: 4, Trend: "up"},
			},
			title: "Báo cáo học tập tuần 05/05 - 11/05/2026", assessment: "positive",
			highlights:       []string{"Hoàn thành 1 bài tập đúng hạn", "Thời gian học tăng 28% so với tuần trước", "Duy trì streak 5 ngày liên tiếp"},
			weaknessAnalysis: "Em gặp khó khăn nhất với Câu điều kiện tiếng Anh và Phân tích nhân vật trong môn Văn.",
			trendComparison:  "So với tuần trước, thời gian học tăng 28%, từ 250 lên 320 phút.",
			recommendations:  []string{"Ôn lại cấu trúc câu điều kiện loại 2 và 3", "Luyện thêm bài tập về vectơ", "Đọc lại tác phẩm Chí Phèo để nắm chắc nội dung"},
			coachMessage:     "Minh Anh đã có một tuần học tập chăm chỉ! Thời gian học tăng lên đáng kể. Hãy tiếp tục phát huy và tập trung cải thiện những điểm yếu còn tồn tại nhé.",
		},
		{
			weekStart: "2026-05-12", weekEnd: "2026-05-18",
			totalMin: 380, prevMin: 320, completed: 1, diamonds: 240, prevDiamonds: 180, avgScore: 82, streak: 8,
			dailyStudy: []reports.DailyStudyEntry{
				{Date: "2026-05-12", Minutes: 60}, {Date: "2026-05-13", Minutes: 45}, {Date: "2026-05-14", Minutes: 70},
				{Date: "2026-05-15", Minutes: 50}, {Date: "2026-05-16", Minutes: 35}, {Date: "2026-05-17", Minutes: 0}, {Date: "2026-05-18", Minutes: 120},
			},
			weaknesses: []reports.WeaknessEntry{
				{Topic: "Present Perfect vs Past Simple", ErrorCount: 4, Trend: "up"},
				{Topic: "Lập luận nghị luận", ErrorCount: 3, Trend: "new"},
				{Topic: "Mệnh đề toán học", ErrorCount: 2, Trend: "down"},
			},
			title: "Báo cáo học tập tuần 12/05 - 18/05/2026", assessment: "positive",
			highlights:       []string{"Điểm trung bình tăng lên 82%", "Thời gian học đạt 380 phút - cao nhất từ trước đến nay", "Đã cải thiện đáng kể môn Toán"},
			weaknessAnalysis: "Điểm yếu về Mệnh đề toán học đã giảm, nhưng xuất hiện thêm khó khăn về Lập luận nghị luận.",
			trendComparison:  "So với tuần trước, điểm trung bình tăng từ 78 lên 82, thời gian học tăng 19%.",
			recommendations:  []string{"Tập trung luyện tập phân biệt Present Perfect và Past Simple", "Đọc thêm các bài văn mẫu nghị luận xã hội", "Giữ vững phong độ học tập"},
			coachMessage:     "Tuần này em đã có sự bứt phá rõ rệt! Điểm số tăng và thời gian học cũng tăng. Cô rất tự hào về sự tiến bộ của em. Chỉ cần kiên trì thêm một chút nữa thôi!",
		},
		{
			weekStart: "2026-05-19", weekEnd: "2026-05-25",
			totalMin: 430, prevMin: 380, completed: 2, diamonds: 310, prevDiamonds: 240, avgScore: 85, streak: 8,
			dailyStudy: []reports.DailyStudyEntry{
				{Date: "2026-05-19", Minutes: 55}, {Date: "2026-05-20", Minutes: 80}, {Date: "2026-05-21", Minutes: 65},
				{Date: "2026-05-22", Minutes: 50}, {Date: "2026-05-23", Minutes: 45}, {Date: "2026-05-24", Minutes: 0}, {Date: "2026-05-25", Minutes: 135},
			},
			weaknesses: []reports.WeaknessEntry{
				{Topic: "Phương trình bậc hai chứa tham số", ErrorCount: 2, Trend: "new"},
				{Topic: "Câu điều kiện loại 2", ErrorCount: 5, Trend: "stable"},
				{Topic: "Lập luận nghị luận", ErrorCount: 3, Trend: "stable"},
			},
			title: "Báo cáo học tập tuần 19/05 - 25/05/2026", assessment: "positive",
			highlights:       []string{"Hoàn thành 2 bài tập với điểm số 85 và 90", "Thời gian học đạt 430 phút", "Điểm yếu Mệnh đề toán học đã được giải quyết hoàn toàn"},
			weaknessAnalysis: "Em đã khắc phục được điểm yếu về Mệnh đề toán học. Tuy nhiên Câu điều kiện tiếng Anh vẫn là thách thức lớn nhất.",
			trendComparison:  "So với tuần trước, thời gian học tăng 13%, điểm trung bình tăng từ 82 lên 85.",
			recommendations:  []string{"Dành thêm 20 phút mỗi ngày ôn câu điều kiện", "Làm thêm bài tập về phương trình bậc hai chứa tham số", "Duy trì thói quen học tập đều đặn"},
			coachMessage:     "Chúc mừng Minh Anh! Em đã có một tuần học tập xuất sắc. Điểm yếu về Mệnh đề toán học đã được giải quyết - đây là minh chứng cho sự nỗ lực của em. Tiếp tục phát huy nhé!",
		},
	}

	for _, rw := range reportWeeks {
		reportData := reports.ReportData{
			DailyStudy:           rw.dailyStudy,
			TotalStudyMinutes:    rw.totalMin,
			PreviousWeekMinutes:  rw.prevMin,
			CompletedAssignments: rw.completed,
			AvgScore:             rw.avgScore,
			TopWeaknesses:        rw.weaknesses,
			DiamondsEarned:       rw.diamonds,
			CurrentStreak:        rw.streak,
			PreviousWeekDiamonds: rw.prevDiamonds,
		}
		reportJSON, _ := json.Marshal(reportData)

		aiMsg := reports.AIReportResponse{
			Title:              rw.title,
			OverallAssessment:  rw.assessment,
			Highlights:         rw.highlights,
			WeaknessAnalysis:   rw.weaknessAnalysis,
			TrendComparison:    rw.trendComparison,
			Recommendations:    rw.recommendations,
			CoachMessage:       rw.coachMessage,
		}
		aiJSON, _ := json.Marshal(aiMsg)

		wr := &reports.WeeklyReport{
			ID:         uuid.New().String(),
			UserID:     demoStudent.ID,
			WeekStart:  rw.weekStart,
			WeekEnd:    rw.weekEnd,
			ReportJSON: string(reportJSON),
			AIMessage:  string(aiJSON),
		}
		if err := db.Create(wr).Error; err != nil {
			return fmt.Errorf("create weekly report: %w", err)
		}
	}
	fmt.Println("  Created 3 weekly reports")

	// ── Step 15: Parent-Child Link ─────────────────────────────────────
	cl := &parent.ChildLink{
		ID:        uuid.New().String(),
		ParentID:  demoParent.ID,
		ChildID:   demoStudent.ID,
		CreatedAt: makeDate(30),
	}
	if err := db.Create(cl).Error; err != nil {
		return fmt.Errorf("create child link: %w", err)
	}
	fmt.Println("  Created parent-child link")

	// ── Step 16: Achievements ──────────────────────────────────────────
	var achCount int64
	db.Model(&achievements.Achievement{}).Count(&achCount)
	var achievementIDs []string
	if achCount == 0 {
		achDefs := []struct {
			title, desc, icon, ruleType string
			threshold, diamondReward    int
		}{
			{"Học sinh chăm chỉ", "Hoàn thành 7 ngày học liên tiếp", "Star", "streak_days", 7, 50},
			{"Cao thủ học tập", "Đạt streak 14 ngày liên tiếp", "Trophy", "streak_days", 14, 100},
			{"Nhà toán học", "Hoàn thành 10 bài học Toán", "Calculator", "lessons_completed", 10, 60},
			{"Tay săn điểm 10", "Đạt điểm tuyệt đối một bài tập", "Award", "perfect_score", 100, 80},
			{"Ong chăm chỉ", "Tổng thời gian học đạt 20 giờ", "Clock", "total_study", 1200, 100},
			{"Vua kim cương", "Tích lũy được 500 kim cương", "Gem", "total_diamonds", 500, 50},
			{"Săn bài tập", "Hoàn thành 5 bài tập", "Target", "assignments_done", 5, 50},
			{"Tiến bộ vượt bậc", "Cải thiện điểm trung bình lên 10%", "TrendingUp", "score_improvement", 10, 80},
		}
		for _, ad := range achDefs {
			a := &achievements.Achievement{
				ID:            uuid.New().String(),
				Title:         ad.title,
				Description:   ad.desc,
				Icon:          ad.icon,
				RuleType:      ad.ruleType,
				Threshold:     ad.threshold,
				DiamondReward: ad.diamondReward,
				IsActive:      true,
			}
			if err := db.Create(a).Error; err != nil {
				return fmt.Errorf("create achievement: %w", err)
			}
			achievementIDs = append(achievementIDs, a.ID)
		}
		fmt.Println("  Created 8 achievements")
	} else {
		var all []achievements.Achievement
		db.Find(&all)
		for _, a := range all {
			achievementIDs = append(achievementIDs, a.ID)
		}
	}

	// Award 3 achievements to student
	if len(achievementIDs) >= 3 {
		uaDefs := []struct {
			achIdx  int
			daysAgo int
		}{
			{0, 14}, // Học sinh chăm chỉ
			{2, 10}, // Nhà toán học
			{6, 5},  // Săn bài tập
		}
		for _, uad := range uaDefs {
			if uad.achIdx < len(achievementIDs) {
				ua := &achievements.UserAchievement{
					ID:            uuid.New().String(),
					UserID:        demoStudent.ID,
					AchievementID: achievementIDs[uad.achIdx],
					EarnedAt:      makeDate(uad.daysAgo),
				}
				// Skip if already exists
				var existing int64
				db.Model(&achievements.UserAchievement{}).Where("user_id = ? AND achievement_id = ?", demoStudent.ID, achievementIDs[uad.achIdx]).Count(&existing)
				if existing == 0 {
					if err := db.Create(ua).Error; err != nil {
						return fmt.Errorf("create user achievement: %w", err)
					}
				}
			}
		}
		fmt.Println("  Awarded 3 achievements to student")
	}

	// ── Step 17: Notifications ─────────────────────────────────────────
	notifDefs := []struct {
		userID, title, body, notifType, link string
		read                                  bool
		daysAgo                               int
	}{
		{demoStudent.ID, "Bài tập mới", "Giáo viên Phạm Văn Hùng đã giao bài tập: Vectơ trong mặt phẳng", "assignment", "/assignments/" + assignmentRecords[4].ID, false, 5},
		{demoStudent.ID, "Điểm số mới", "Bài tập Phương trình bậc hai đã được chấm: 85/100", "grade", "/assignments/" + assignmentRecords[0].ID, true, 10},
		{demoStudent.ID, "Streak đạt mốc", "Chúc mừng! Bạn đã đạt streak 7 ngày liên tiếp", "achievement", "/reports", true, 14},
		{demoStudent.ID, "Báo cáo hàng tuần", "Báo cáo học tập tuần 19/05 đã sẵn sàng", "report", "/reports", false, 2},
		{demoStudent.ID, "Kim cương nhận được", "Bạn nhận được 100 kim cương từ streak milestone!", "reward", "/leaderboard", true, 7},
		{demoStudent.ID, "Nhắc nhở học tập", "Đã 2 ngày bạn chưa học Tiếng Anh. Hãy quay lại nhé!", "reminder", "/courses", false, 1},
		{demoTeacher.ID, "Học sinh nộp bài", "Nguyễn Minh Anh đã nộp bài tập: Phân tích nhân vật Chí Phèo", "submission", "/assignments/" + assignmentRecords[2].ID, false, 3},
		{demoTeacher.ID, "Cần chấm điểm", "Bạn có 1 bài tập đang chờ chấm điểm", "grading", "/teacher", false, 3},
	}
	for _, nd := range notifDefs {
		notif := &notifications.Notification{
			ID:        uuid.New().String(),
			UserID:    nd.userID,
			Title:     nd.title,
			Body:      nd.body,
			Type:      nd.notifType,
			Read:      nd.read,
			Link:      nd.link,
			CreatedAt: makeDate(nd.daysAgo),
		}
		if err := db.Create(notif).Error; err != nil {
			return fmt.Errorf("create notification: %w", err)
		}
	}
	fmt.Println("  Created 8 notifications")

	// ── Step 18: Quizzes ───────────────────────────────────────────────
	quizDefs := []struct {
		title, lessonKey string
		passingScore     int
		questions        []map[string]interface{}
	}{
		{
			title: "Kiểm tra Phương trình bậc hai", lessonKey: "ds_pt_bac_hai", passingScore: 70,
			questions: []map[string]interface{}{
				{"q": "Phương trình x² - 5x + 6 = 0 có nghiệm là?", "options": []map[string]interface{}{{"text": "x = 2, x = 3", "isCorrect": true}, {"text": "x = -2, x = -3", "isCorrect": false}, {"text": "x = 1, x = 6", "isCorrect": false}, {"text": "x = 2, x = -3", "isCorrect": false}}, "difficulty": "nhan_biet", "score": 10},
				{"q": "Δ của phương trình 2x² - 4x + 1 = 0 là?", "options": []map[string]interface{}{{"text": "8", "isCorrect": true}, {"text": "4", "isCorrect": false}, {"text": "16", "isCorrect": false}, {"text": "0", "isCorrect": false}}, "difficulty": "thong_hieu", "score": 10},
				{"q": "Điều kiện để phương trình bậc hai có nghiệm kép?", "options": []map[string]interface{}{{"text": "Δ = 0", "isCorrect": true}, {"text": "Δ > 0", "isCorrect": false}, {"text": "Δ < 0", "isCorrect": false}, {"text": "Δ ≥ 0", "isCorrect": false}}, "difficulty": "nhan_biet", "score": 10},
				{"q": "Tổng hai nghiệm của x² - 7x + 12 = 0?", "options": []map[string]interface{}{{"text": "7", "isCorrect": true}, {"text": "12", "isCorrect": false}, {"text": "-7", "isCorrect": false}, {"text": "-12", "isCorrect": false}}, "difficulty": "thong_hieu", "score": 10},
				{"q": "Tích hai nghiệm của x² - 7x + 12 = 0?", "options": []map[string]interface{}{{"text": "12", "isCorrect": true}, {"text": "7", "isCorrect": false}, {"text": "-12", "isCorrect": false}, {"text": "-7", "isCorrect": false}}, "difficulty": "thong_hieu", "score": 10},
			},
		},
		{
			title: "Kiểm tra Conditional Sentences", lessonKey: "eng_conditional", passingScore: 70,
			questions: []map[string]interface{}{
				{"q": "If I ___ (be) you, I would study harder.", "options": []map[string]interface{}{{"text": "were", "isCorrect": true}, {"text": "am", "isCorrect": false}, {"text": "was", "isCorrect": false}, {"text": "will be", "isCorrect": false}}, "difficulty": "nhan_biet", "score": 10},
				{"q": "If it rains tomorrow, we ___ at home.", "options": []map[string]interface{}{{"text": "will stay", "isCorrect": true}, {"text": "would stay", "isCorrect": false}, {"text": "would have stayed", "isCorrect": false}, {"text": "stay", "isCorrect": false}}, "difficulty": "nhan_biet", "score": 10},
				{"q": "If he had left earlier, he ___ the bus.", "options": []map[string]interface{}{{"text": "would have caught", "isCorrect": true}, {"text": "would catch", "isCorrect": false}, {"text": "will catch", "isCorrect": false}, {"text": "catches", "isCorrect": false}}, "difficulty": "thong_hieu", "score": 10},
				{"q": "Which sentence is type 2 conditional?", "options": []map[string]interface{}{{"text": "If I had money, I would travel", "isCorrect": true}, {"text": "If I have money, I will travel", "isCorrect": false}, {"text": "If I had had money, I would have traveled", "isCorrect": false}, {"text": "If I have money, I travel", "isCorrect": false}}, "difficulty": "thong_hieu", "score": 10},
				{"q": "Complete: If she ___ (not/miss) the train, she would be here now.", "options": []map[string]interface{}{{"text": "hadn't missed", "isCorrect": true}, {"text": "didn't miss", "isCorrect": false}, {"text": "doesn't miss", "isCorrect": false}, {"text": "wouldn't miss", "isCorrect": false}}, "difficulty": "van_dung", "score": 10},
			},
		},
	}
	for _, qd := range quizDefs {
		questionsJSON, _ := json.Marshal(qd.questions)
		quiz := &quizzes.Quiz{
			ID:            uuid.New().String(),
			LessonID:      lessonMapByKey[qd.lessonKey],
			Title:         qd.title,
			Questions:     string(questionsJSON),
			IsAIGenerated: false,
			PassingScore:  qd.passingScore,
		}
		if err := db.Create(quiz).Error; err != nil {
			return fmt.Errorf("create quiz: %w", err)
		}
	}
	fmt.Println("  Created 2 quizzes")

	// ── Step 19: Attendance ────────────────────────────────────────────
	for i := 0; i < 5; i++ {
		d := today.AddDate(0, 0, -i)
		if d.Weekday() == time.Sunday {
			continue
		}
		status := attendance.StatusPresent
		if i == 2 {
			status = attendance.StatusLate
		}
		att := &attendance.Attendance{
			ID:        uuid.New().String(),
			ClassID:   demoClassID,
			Date:      d.Format("2006-01-02"),
			StudentID: demoStudent.ID,
			Status:    status,
		}
		if err := db.Create(att).Error; err != nil {
			// Skip if duplicate
			continue
		}
	}
	fmt.Println("  Created attendance records")

	// ── Step 20: Flashcard Deck ────────────────────────────────────────
	deck := &flashcards.FlashcardDeck{
		ID:       uuid.New().String(),
		UserID:   demoStudent.ID,
		LessonID: lessonMapByKey["eng_conditional"],
		Title:    "Ôn tập Conditional Sentences",
	}
	if err := db.Create(deck).Error; err != nil {
		return fmt.Errorf("create flashcard deck: %w", err)
	}

	cardDefs := []struct {
		question, answer string
	}{
		{"Câu điều kiện loại 1 dùng để làm gì?", "Diễn tả điều kiện có thể xảy ra ở hiện tại hoặc tương lai."},
		{"Cấu trúc câu điều kiện loại 2", "If + S + V-ed, S + would + V-inf"},
		{"Cấu trúc câu điều kiện loại 3", "If + S + had + V3/ed, S + would have + V3/ed"},
		{"Ví dụ câu điều kiện loại 1?", "If it rains, I will stay at home."},
		{"Khi nào dùng câu điều kiện loại 3?", "Diễn tả điều kiện không có thật trong quá khứ."},
		{"Phân biệt loại 2 và loại 3?", "Loại 2: không có thật ở hiện tại. Loại 3: không có thật ở quá khứ."},
	}
	for _, cd := range cardDefs {
		card := &flashcards.Flashcard{
			ID:             uuid.New().String(),
			DeckID:         deck.ID,
			Question:       cd.question,
			Answer:         cd.answer,
			EaseFactor:     2.5,
			NextReviewDate: today.AddDate(0, 0, 1),
		}
		if err := db.Create(card).Error; err != nil {
			return fmt.Errorf("create flashcard: %w", err)
		}
	}
	fmt.Println("  Created flashcard deck with 6 cards")

	fmt.Println("Demo seed: complete!")
	return nil
}

// ── Supabase helpers ─────────────────────────────────────────────────────

func getOrCreateSupabaseUser(supabaseURL, serviceRoleKey, email, password, fullName, username, role string) (string, error) {
	// Try to find existing user by email first
	id, err := findSupabaseUserByEmail(supabaseURL, serviceRoleKey, email)
	if err == nil && id != "" {
		return id, nil
	}
	// Create new user
	return createSupabaseUser(supabaseURL, serviceRoleKey, email, password, fullName, username, role)
}

func findSupabaseUserByEmail(supabaseURL, serviceRoleKey, email string) (string, error) {
	if supabaseURL == "" || serviceRoleKey == "" {
		return "", fmt.Errorf("supabase not configured")
	}

	filter := url.QueryEscape("email eq '" + email + "'")
	fullURL := strings.TrimRight(supabaseURL, "/") + "/auth/v1/admin/users?filter=" + filter
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("apikey", serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("supabase find user error: %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Parse JSON array response
	var users []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(respBody, &users); err != nil {
		// Try single object response
		var single struct {
			ID string `json:"id"`
		}
		if err2 := json.Unmarshal(respBody, &single); err2 != nil {
			return "", fmt.Errorf("unexpected response: %s", string(respBody))
		}
		return single.ID, nil
	}
	if len(users) > 0 {
		return users[0].ID, nil
	}
	return "", fmt.Errorf("user not found")
}
