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

const lessonSummaryPrompt = `Bạn là trợ lý học tập tại LMS. Hãy phân tích bài học và trả về kết quả dạng JSON.

Yêu cầu:
1. "summary": tóm tắt trong 3-5 câu, bằng tiếng Việt. Nêu bật các ý chính và kiến thức trọng tâm.
2. "objectives": 3-4 mục tiêu học tập NGẮN (mỗi mục tối đa 10 từ), liệt kê những gì học sinh sẽ làm được sau bài học.
3. Ngôn ngữ phù hợp với học sinh lớp %d.
4. Nếu không có nội dung chi tiết, hãy dựa vào tên bài học và môn học.
5. Xưng "bạn" khi nói về học sinh.

Định dạng JSON:
{
  "summary": "Tóm tắt 3-5 câu...",
  "objectives": ["Mục tiêu 1", "Mục tiêu 2", "Mục tiêu 3"]
}`

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

Trả về JSON (chỉ JSON, không thêm text khác).`, fmt.Sprintf(lessonSummaryPrompt, gradeLevel), subjectName, lessonTitle, gradeLevel, content)
}

// ---- Extract Questions from Document ----

const extractQuestionsPrompt = `Bạn là giáo viên tại LMS. Nhiệm vụ của bạn là đọc văn bản được trích xuất từ file Word và tách thành các câu hỏi riêng biệt.

**Yêu cầu:**
1. Xác định từng câu hỏi trong văn bản (có thể được đánh số 1, 2, 3 hoặc Câu 1, Câu 2, v.v.)
2. Với mỗi câu hỏi, trả về nội dung đầy đủ của câu hỏi đó
3. Giữ nguyên công thức toán học trong định dạng $...$ (VD: $x^2 + y^2 = 1$, $\frac{a}{b}$)
4. Nếu văn bản không chứa câu hỏi rõ ràng, hãy cố gắng chia thành các phần/bài tập nhỏ
5. Số lượng câu hỏi: tối thiểu 1, tối đa 20

**Định dạng Output (MẢNG JSON):**
[
  {
    "question": "Nội dung đầy đủ của câu hỏi 1"
  },
  {
    "question": "Nội dung đầy đủ của câu hỏi 2"
  }
]

CHỈ trả về mảng JSON, không thêm text hay markdown.`

func BuildExtractQuestionsPrompt(docxText string) string {
	text := docxText
	if len(text) > 8000 {
		text = text[:8000] + "..."
	}
	return fmt.Sprintf(`%s

**Văn bản trích xuất từ file:**
---
%s
---

Hãy tách các câu hỏi từ văn bản trên và trả về mảng JSON.`, extractQuestionsPrompt, text)
}

// ---- Generate Assignment from Lesson ----

const generateAssignmentPrompt = `Bạn là giáo viên tại LMS. Nhiệm vụ của bạn là tạo một đề bài tập từ nội dung bài học có sẵn.

**Yêu cầu:**
1. Tạo đúng %d câu hỏi dựa trên nội dung bài học được cung cấp
2. Loại câu hỏi: %s
3. Câu hỏi phải bám sát nội dung bài học, kiểm tra mức độ hiểu bài
4. Với câu trắc nghiệm (type="mcq"): question là câu hỏi KHÔNG chứa đáp án, options là mảng 4 đáp án A/B/C/D với isCorrect=true cho đáp án đúng, expectedAnswer là chữ cái đáp án đúng (VD: "B"), explanation giải thích ngắn gọn vì sao đáp án đó đúng
5. Với câu trả lời ngắn (type="short_answer"): question là câu hỏi mở, expectedAnswer là các ý chính cần có (1-2 câu), explanation giải thích ngắn gọn
6. Dùng $...$ cho công thức toán học (VD: $x^2 + y^2 = 1$, $\frac{a}{b}$)
7. Độ khó phù hợp với khối lớp %d
8. TỔNG điểm tất cả câu hỏi = 10. Phân phối điểm hợp lý theo độ khó và độ dài câu hỏi.

**Định dạng Output (MẢNG JSON):**
[
  {
    "type": "mcq",
    "question": "Nội dung câu hỏi (KHÔNG chứa đáp án)",
    "options": [
      {"text": "Đáp án A", "isCorrect": false},
      {"text": "Đáp án B", "isCorrect": true},
      {"text": "Đáp án C", "isCorrect": false},
      {"text": "Đáp án D", "isCorrect": false}
    ],
    "expectedAnswer": "B",
    "explanation": "Giải thích ngắn gọn vì sao B đúng",
    "score": 3
  },
  {
    "type": "short_answer",
    "question": "Nội dung câu hỏi tự luận ngắn?",
    "expectedAnswer": "Các ý chính cần có trong câu trả lời",
    "explanation": "Giải thích ngắn gọn",
    "score": 7
  }
]

CHỈ trả về mảng JSON, không thêm text hay markdown.`

func BuildGenerateAssignmentPrompt(lessonTitle, subjectName, lessonContent string, questionCount int, questionType string, gradeLevel int) string {
	content := lessonContent
	if len(content) > 3000 {
		content = content[:3000] + "..."
	}
	if content == "" {
		content = "Chưa có nội dung bài học"
	}
	return fmt.Sprintf(generateAssignmentPrompt, questionCount, questionType, gradeLevel) + fmt.Sprintf(`

**Ngữ cảnh:**
- Môn: %s
- Bài học: %s
- Khối lớp: %d
- Nội dung bài học:
---
%s
---

Hãy tạo %d câu hỏi và trả về mảng JSON.`, subjectName, lessonTitle, gradeLevel, content, questionCount)
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

// ---- Mind Map Generator ----

const mindMapPrompt = `Bạn là chuyên gia tạo sơ đồ tư duy cho LMS. Dựa trên nội dung bài học, hãy tạo một sơ đồ tư duy chi tiết, phân cấp rõ ràng với cấu trúc cây.

**YÊU CẦU QUAN TRỌNG:**
1. "centralTopic": chủ đề trung tâm (tên bài học)
2. Tạo 3-5 NHÁNH CHÍNH (type="concept") tỏa ra từ trung tâm. Mỗi nhánh là một chủ đề lớn trong bài.
3. Mỗi nhánh chính có 2-4 NHÁNH CON (type="subtopic") — các ý chi tiết hơn.
4. Mỗi nhánh con có thể có 1-3 CHI TIẾT (type="detail") — ví dụ, công thức, số liệu, sự kiện.
5. TỔNG số node: 12-25 node (càng nhiều càng tốt, miễn là có ý nghĩa)
6. TẤT CẢ label phải bằng tiếng Việt, ngắn gọn (3-8 từ)
7. MỖI node PHẢI có "description": 1-2 câu mô tả/giải thích khái niệm đó. Với detail thì description PHẢI cụ thể (công thức, số liệu, ví dụ). Viết bằng tiếng Việt.
8. Cấu trúc PHẢI là dạng cây phân cấp (không vòng lặp). Node cha kết nối đến node con qua edges.

**Định dạng Output (JSON):**
{
  "centralTopic": "Tên bài học",
  "nodes": [
    {"id": "c1", "label": "Khái niệm chính 1", "type": "concept", "description": "Giải thích ngắn gọn về khái niệm này"},
    {"id": "c1_s1", "label": "Ý phụ 1.1", "type": "subtopic", "description": "Mô tả chi tiết hơn về ý phụ"},
    {"id": "c1_s1_d1", "label": "Chi tiết cụ thể", "type": "detail", "description": "Công thức/số liệu/ví dụ cụ thể"},
    {"id": "c2", "label": "Khái niệm chính 2", "type": "concept", "description": "Giải thích ngắn gọn về khái niệm này"}
  ],
  "edges": [
    {"source": "central", "target": "c1", "label": ""},
    {"source": "c1", "target": "c1_s1", "label": ""},
    {"source": "c1_s1", "target": "c1_s1_d1", "label": ""},
    {"source": "central", "target": "c2", "label": ""}
  ]
}

LƯU Ý:
- Node gốc luôn có id="central"
- Dùng tiền tố để thể hiện quan hệ cha-con (VD: c1_s1 là con của c1)
- label của edges để trống nếu không có mối quan hệ đặc biệt
- TẠO ĐỦ 3-5 NHÁNH CHÍNH, mỗi nhánh có đủ cấp con`

func BuildMindMapPrompt(lessonTitle, subjectName, lessonContent string, gradeLevel int) string {
	content := lessonContent
	if len(content) > 3000 {
		content = content[:3000] + "..."
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

Trả về JSON (chỉ JSON, không thêm text khác).`, mindMapPrompt, subjectName, lessonTitle, gradeLevel, content)
}

// ---- Knowledge Graph Generator ----

const knowledgeGraphPrompt = `Bạn là trợ lý tạo đồ thị tri thức cho LMS. Dựa trên danh sách các bài học trong một môn học, hãy tạo đồ thị liên kết các khái niệm.

**Yêu cầu:**
1. "centralTopic": tên môn học
2. "nodes": danh sách 8-25 node đại diện cho các khái niệm/chủ đề trong toàn bộ môn học. Mỗi node có:
   - "id": định danh duy nhất
   - "label": nhãn hiển thị (bằng tiếng Việt, ngắn gọn)
   - "type": "concept" (khái niệm lớn), "subtopic" (chủ đề), hoặc "detail" (chi tiết)
   - "description": 1-2 câu mô tả/giải thích khái niệm đó, bằng tiếng Việt
3. "edges": kết nối thể hiện mối quan hệ giữa các khái niệm (khái niệm nào là nền tảng cho khái niệm nào):
   - "source": id node nguồn
   - "target": id node đích
   - "label": nhãn mối quan hệ (VD: "nền tảng", "mở rộng", "liên quan")

**Định dạng Output (JSON):**
{
  "centralTopic": "Tên môn học",
  "nodes": [
    {"id": "n1", "label": "Khái niệm A", "type": "concept", "description": "Mô tả khái niệm A"},
    {"id": "n2", "label": "Khái niệm B", "type": "concept", "description": "Mô tả khái niệm B"}
  ],
  "edges": [
    {"source": "n1", "target": "n2", "label": "nền tảng"}
  ]
}`

func BuildKnowledgeGraphPrompt(subjectName string, gradeLevel int, lessonSummaries string) string {
	return fmt.Sprintf(`%s

Môn học: %s
Khối lớp: %d

Danh sách bài học và mô tả:
---
%s
---

Trả về JSON (chỉ JSON, không thêm text khác).`, knowledgeGraphPrompt, subjectName, gradeLevel, lessonSummaries)
}

// ---- Flashcard Generator ----

const flashcardPrompt = `Bạn là giáo viên tạo thẻ học tập (flashcard) cho LMS.

Nhiệm vụ: tạo đúng %d thẻ học tập từ nội dung bài học. Mỗi thẻ gồm câu hỏi ngắn ở mặt trước và đáp án ngắn gọn ở mặt sau.

**Yêu cầu:**
1. Câu hỏi ngắn gọn, kiểm tra một ý chính
2. Đáp án ngắn gọn (1-2 câu hoặc một công thức/số)
3. Bao phủ các ý chính của bài học
4. Độ khó phù hợp với khối lớp
5. Dùng $...$ cho công thức toán học
6. Trả về MẢNG JSON, không thêm markdown

**Định dạng Output (MẢNG JSON):**
[
  {"question": "Câu hỏi 1?", "answer": "Đáp án 1"},
  {"question": "Câu hỏi 2?", "answer": "Đáp án 2"}
]`

func BuildFlashcardPrompt(lessonTitle, subjectName, lessonContent string, count int, gradeLevel int) string {
	content := lessonContent
	if len(content) > 3000 {
		content = content[:3000] + "..."
	}
	if content == "" {
		content = fmt.Sprintf("Chưa có nội dung chi tiết. Tên bài học: %s. Môn: %s.", lessonTitle, subjectName)
	}
	return fmt.Sprintf(flashcardPrompt, count) + fmt.Sprintf(`

Môn học: %s
Bài học: %s
Khối lớp: %d
Nội dung bài học:
---
%s
---

Tạo đúng %d thẻ học tập và trả về mảng JSON.`, subjectName, lessonTitle, gradeLevel, content, count)
}

// ---- Study Planner ----

const studyPlannerPrompt = `Bạn là trợ lý lập kế hoạch học tập thông minh cho LMS. Dựa trên dữ liệu học tập của học sinh, hãy tạo một kế hoạch học tập cho HÔM NAY.

**Dữ liệu học sinh:**
%s

**Yêu cầu kế hoạch:**
1. Tạo 3-5 nhiệm vụ học tập cho hôm nay, sắp xếp theo thứ tự ưu tiên (quan trọng nhất trước).
2. Mỗi nhiệm vụ phải có:
   - "title": tiêu đề ngắn gọn, hấp dẫn (VD: "Ôn tập Phân Số", "Học bài Định luật Ohm")
   - "description": mô tả 1-2 câu về việc cần làm, bằng tiếng Việt
   - "type": loại nhiệm vụ: "review" (ôn tập), "practice" (luyện tập), hoặc "assignment" (bài tập có hạn)
   - "estimatedMinutes": thời gian ước tính (phút), từ 10-45 phút
   - "subjectName": tên môn học liên quan, PHẢI trùng khớp với tên môn trong "Môn học và bài học có sẵn"
3. QUAN TRỌNG:
   - Nếu có điểm yếu: ưu tiên tạo nhiệm vụ ôn tập các chủ đề yếu đó trước.
   - Nếu có bài tập sắp hạn: ưu tiên hoàn thành bài tập đó.
   - Nếu KHÔNG có điểm yếu và KHÔNG có bài tập: HÃY TẠO NHIỆM VỤ HỌC BÀI MỚI từ danh sách "Môn học và bài học có sẵn", ưu tiên các bài "chưa học". Mỗi nhiệm vụ là một bài học cụ thể từ danh sách.
   - Nếu không có cả dữ liệu môn học: tạo nhiệm vụ ôn tập chung nhẹ nhàng.
4. Đa dạng loại nhiệm vụ, không nên toàn bộ là review.
5. Tổng thời gian ước tính từ 45-90 phút.
6. Lời văn khích lệ, tích cực, xưng "bạn".

**Định dạng Output (MẢNG JSON):**
[
  {
    "title": "Ôn tập Phân Số",
    "description": "Xem lại bài học về phép cộng và nhân phân số, tập trung vào các ví dụ trong SGK.",
    "type": "review",
    "estimatedMinutes": 20,
    "subjectName": "Toán"
  },
  {
    "title": "Học bài Định luật Ohm",
    "description": "Đọc hiểu khái niệm và công thức Định luật Ohm, ghi chú các ý chính.",
    "type": "review",
    "estimatedMinutes": 25,
    "subjectName": "Vật lý"
  }
]

CHỈ trả về mảng JSON, không thêm text hay markdown.`

func BuildStudyPlannerPrompt(contextData string) string {
	return fmt.Sprintf(studyPlannerPrompt, contextData)
}

func BuildAssignmentPreGradePrompt(title, description, rubricText, submissionContent string, maxScore int) string {
	if rubricText == "" {
		rubricText = "Không có rubric cụ thể. Tự đánh giá theo chất lượng nội dung."
	}
	if submissionContent == "" {
		submissionContent = "(Trống)"
	}
	return fmt.Sprintf(assignmentPreGradePrompt, title, description, maxScore, rubricText, submissionContent)
}
