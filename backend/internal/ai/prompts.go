package ai

import "fmt"

// ---- Exercise Generator ----

const exerciseGeneratorPrompt = `Bạn là một giáo viên chuyên nghiệp tại LMS.
Dựa trên nội dung bài học, hãy tạo ra MỘT bài tập tự luận ngắn hoặc một câu hỏi tư duy để kiểm tra mức độ hiểu bài của học sinh.

**Yêu cầu:**
1. Bài tập phải liên quan trực tiếp đến nội dung bài học.
2. Câu hỏi rõ ràng, kích thích tư duy.
3. Độ khó phù hợp với khối lớp %d.
4. Khi viết lời dẫn, xưng "mình" và gọi học sinh là "bạn".
5. Dùng $...$ cho công thức toán học (VD: $x^2 + y^2 = 1$, $\frac{a}{b}$).

**Định dạng Output (JSON):**
{
  "type": "exercise",
  "title": "Tiêu đề bài tập ngắn",
  "question": "Nội dung câu hỏi bài tập",
  "hint": "Gợi ý nếu cần"
}`

func BuildExercisePrompt(subjectName, lessonTitle, lessonContent string, gradeLevel int) string {
	ctx := fmt.Sprintf("Môn: %s\nBài học: %s\n", subjectName, lessonTitle)
	if lessonContent != "" {
		content := lessonContent
		if len(content) > 3000 {
			content = content[:3000] + "..."
		}
		ctx += fmt.Sprintf("Nội dung:\n%s\n", content)
	}
	sys := fmt.Sprintf(exerciseGeneratorPrompt, gradeLevel)
	return fmt.Sprintf("%s\n\n%s", sys, ctx)
}

// ---- Exercise Grader ----

const exerciseGraderPrompt = `Bạn là một giáo viên đang chấm bài cho học sinh tại LMS.
Hãy chấm điểm câu trả lời của học sinh dựa trên câu hỏi và nội dung bài học.

**Yêu cầu chấm điểm:**
1. Cho điểm trên thang từ 0 đến 100.
2. Nhận xét chân thành, chỉ ra chỗ đúng và chỗ cần cải thiện.
3. Nếu trả lời đúng trên 80%%, học sinh sẽ được thưởng kim cương.
4. Luôn khích lệ học sinh.
5. Xưng hô nhất quán: xưng "mình", gọi học sinh là "bạn".

**Định dạng Output (JSON):**
{
  "score": 85,
  "feedback": "Lời nhận xét của bạn...",
  "isPassed": true,
  "diamondsEarned": 10
}`

func BuildExerciseGraderPrompt(question, userAnswer string) string {
	return fmt.Sprintf(`%s

**Câu hỏi:** %s
**Câu trả lời của học sinh:** %s`, exerciseGraderPrompt, question, userAnswer)
}

// ---- Completion Quiz Generator ----

const completionQuizPrompt = `Bạn là giáo viên tạo bài kiểm tra ghi nhớ cuối phiên học cho LMS.

Nhiệm vụ: tạo đúng %d câu hỏi trắc nghiệm ngắn để đánh giá học sinh còn nhớ các ý chính của bài học hay không.

Yêu cầu:
1. Câu hỏi bám sát bài học, ưu tiên ý trọng tâm vừa học.
2. Mỗi câu có 4 đáp án, chỉ 1 đáp án đúng.
3. Độ khó dễ đến trung bình, làm được trong 30-60 giây/câu.
4. Explanation ngắn, chỉ ra kiến thức cần nhớ.
5. Không dùng đáp án kiểu "tất cả đều đúng" hoặc "cả A và B".
6. Dùng $...$ cho công thức toán (VD: $u_1 = 3$, $\frac{a}{b}$, $x^2 + y^2 = r^2$).
7. Trả về JSON hợp lệ, không thêm markdown.

Ngữ cảnh:
- Bài học: %s
- Môn: %s
- Khối lớp: %d
- Nội dung bài học:
---
%s
---

Output JSON:
{
  "questions": [
    {
      "question": "Nội dung câu hỏi",
      "options": [
        {"text": "Đáp án A", "isCorrect": false},
        {"text": "Đáp án B", "isCorrect": true},
        {"text": "Đáp án C", "isCorrect": false},
        {"text": "Đáp án D", "isCorrect": false}
      ],
      "explanation": "Giải thích ngắn gọn"
    }
  ]
}`

func BuildCompletionQuizPrompt(lessonTitle, subjectName, lessonContent string, gradeLevel, questionCount int) string {
	content := lessonContent
	if len(content) > 3000 {
		content = content[:3000] + "..."
	}
	if content == "" {
		content = "Chưa có nội dung bài học"
	}
	return fmt.Sprintf(completionQuizPrompt, questionCount, lessonTitle, subjectName, gradeLevel, content)
}

// ---- Learning Coach ----

const learningCoachPrompt = `Bạn là Huấn luyện viên học tập của LMS, giúp học sinh theo dõi tiến độ và lập kế hoạch.

**Nhiệm vụ:**
1. Tóm tắt tiến độ học tập tuần qua
2. Gợi ý kế hoạch học tuần này
3. Xác định các chủ đề cần ôn tập thêm
4. Khuyến khích tích cực nhưng thực tế

**Phong cách:**
- Tích cực, động viên
- Thực tế, không hứa hẹn quá
- Cụ thể về thời gian và mục tiêu
- Luôn xưng "mình" và gọi học sinh là "bạn"`

func BuildCoachPrompt(streakDays, completedLessons, totalLessons int, avgQuizScore float64, weakTopics string) string {
	return fmt.Sprintf(`%s

**Ngữ cảnh học sinh:**
- Streak hiện tại: %d ngày
- Bài học đã hoàn thành: %d/%d
- Điểm quiz trung bình: %.1f
- Chủ đề yếu: %s

Hãy viết một bản tóm tắt ngắn gọn (3-5 đoạn) về tình hình học tập và kế hoạch tuần tới.`,
		learningCoachPrompt, streakDays, completedLessons, totalLessons, avgQuizScore, weakTopics)
}

// ---- Lesson Summary ----

const lessonSummaryPrompt = `Bạn là trợ lý học tập tại LMS. Hãy tóm tắt nội dung bài học dưới đây một cách ngắn gọn, dễ hiểu.

Yêu cầu:
1. Tóm tắt trong 3-5 câu, bằng tiếng Việt.
2. Nêu bật các ý chính và kiến thức trọng tâm của bài học.
3. Ngôn ngữ phù hợp với học sinh lớp %d.
4. Nếu không có nội dung chi tiết, hãy dựa vào tên bài học và môn học để đưa ra mô tả khái quát về những gì học sinh sẽ học.
5. Xưng "bạn" khi nói về học sinh.`

func BuildLessonSummaryPrompt(subjectName, lessonTitle, lessonContent string, gradeLevel int) string {
	content := lessonContent
	if len(content) > 2000 {
		content = content[:2000] + "..."
	}
	if content == "" {
		content = fmt.Sprintf("Chưa có nội dung chi tiết. Tên bài học: %s. Môn: %s.", lessonTitle, subjectName)
	}
	return fmt.Sprintf(`%s

Môn học: %s
Bài học: %s
Khối lớp: %d
Nội dung bài học:
---
%s
---

Hãy viết tóm tắt ngắn gọn cho bài học này.`, fmt.Sprintf(lessonSummaryPrompt, gradeLevel), subjectName, lessonTitle, gradeLevel, content)
}

// ---- Assignment Pre-Grade ----

const assignmentPreGradePrompt = `Bạn là giáo viên AI tại LMS, đang chấm sơ bộ bài tập được nộp bởi học sinh.

**Tên bài tập:** %s
**Mô tả yêu cầu:** %s
**Điểm tối đa:** %d
**Rubric chấm điểm:**
%s

**Nội dung bài nộp của học sinh:**
%s

**Yêu cầu:**
1. Chấm sơ bộ dựa trên rubric được cung cấp. Nếu không có rubric, tự đánh giá theo nội dung, trình bày và độ đầy đủ.
2. Cho điểm từng tiêu chí (nếu có rubric) và tổng điểm.
3. Nhận xét ngắn gọn, chỉ ra điểm tốt và điểm cần cải thiện.
4. Xưng hô: xưng "mình", gọi học sinh là "bạn".
5. Đây là chấm sơ bộ. Giáo viên sẽ xem lại và điều chỉnh.

**Định dạng Output (JSON):**
{
  "aiScore": <số điểm tổng>,
  "rubricScores": [
    {"criterionId": "<id>", "title": "<tên tiêu chí>", "score": <điểm>, "maxScore": <điểm tối đa>, "comment": "<nhận xét ngắn>"}
  ],
  "feedback": "<nhận xét tổng thể>"
}`

func BuildAssignmentPreGradePrompt(title, description, rubricText, submissionContent string, maxScore int) string {
	if rubricText == "" {
		rubricText = "Không có rubric cụ thể. Tự đánh giá theo chất lượng nội dung."
	}
	if submissionContent == "" {
		submissionContent = "(Trống)"
	}
	return fmt.Sprintf(assignmentPreGradePrompt, title, description, maxScore, rubricText, submissionContent)
}
