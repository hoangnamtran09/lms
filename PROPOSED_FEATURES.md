# Đề xuất tính năng đột phá cho LMS

## Tổng quan

Tài liệu này đề xuất 6 tính năng đột phá nhằm thuyết phục ban giám khảo, được xây dựng dựa trên hạ tầng hiện có của hệ thống LMS.
Mỗi tính năng bao gồm: mô tả, lý do thuyết phục, cách triển khai, và mức độ công sức.

---

## 1. 🎙️ AI Voice Chat Gia Sư

### Mô tả
Học sinh **nói chuyện trực tiếp** với AI tutor bằng giọng nói tiếng Việt, thay vì gõ chữ. Hệ thống chuyển giọng nói thành văn bản (STT), gửi đến AI xử lý, rồi chuyển phản hồi thành giọng nói (TTS) đọc lại cho học sinh nghe.

### Trải nghiệm người dùng
- Giao diện như một **cuộc gọi video**: nút tròn lớn "Nhấn để nói" ở giữa màn hình
- Khi AI đang nói: hiển thị **waveform animation** + avatar AI đang "suy nghĩ"
- Học sinh có thể ngắt lời AI bất cứ lúc nào (như trò chuyện thật)
- Transcript văn bản vẫn hiển thị bên dưới dạng bubble chat
- Toggle dễ dàng giữa voice mode và text mode

### Tại sao gây ấn tượng
- Voice AI là xu hướng công nghệ nóng nhất hiện nay (GPT-4o voice, Gemini Live)
- Demo live voice bằng **tiếng Việt** với ngữ điệu tự nhiên là cực kỳ thuyết phục
- Cho thấy team không chỉ "gọi API" mà còn tích hợp công nghệ tiên tiến

### Cách triển khai
| Thành phần | Công nghệ |
|------------|-----------|
| STT (Speech-to-Text) | Web Speech API (trình duyệt) hoặc Google Cloud STT / Azure Speech tiếng Việt |
| TTS (Text-to-Speech) | Web Speech Synthesis API hoặc ElevenLabs / Google Cloud TTS tiếng Việt |
| Real-time streaming | Tận dụng SSE streaming có sẵn từ AI chat, thêm WebSocket cho audio |
| Voice Activity Detection | Custom hook phát hiện khi user ngừng nói để gửi request |

### Tận dụng code có sẵn
- SSE streaming AI chat (`backend/internal/ai/handler.go` — endpoint `/api/ai/chat`)
- Socratic tutor system prompt (`backend/internal/ai/socratic.go`)
- `api-client.ts` — `apiStream()` đã hỗ trợ SSE streaming
- `AITutorPanel`, `ChatMessage` — giao diện chat có sẵn

### Công sức
**Cao** — Cần thêm WebSocket server, tích hợp STT/TTS API, xây dựng voice UI.

---

## 2. 🧠 AI Mind Map & Knowledge Graph

### Mô tả
AI tự động sinh **sơ đồ tư duy tương tác** từ nội dung bài học và **đồ thị tri thức** hiển thị mối quan hệ giữa tất cả khái niệm trong môn học. Mỗi node là một khái niệm, được tô màu theo trạng thái của học sinh.

### Trải nghiệm người dùng
- **Mind Map View**: Sơ đồ cây với chủ đề chính ở giữa, các nhánh tỏa ra là khái niệm con
- **Knowledge Graph View**: Đồ thị lực (force-directed graph) với các node khái niệm được kết nối
- Màu sắc node: 🟢 Đã hiểu rõ | 🔴 Điểm yếu | 🔵 Đang học | ⚪ Chưa học
- Click vào node → popup với: tóm tắt khái niệm, bài tập liên quan, link tới bài học
- Animation mượt mà khi zoom/pan/drag node
- Có nút "Phát sinh lại với AI" để làm mới sơ đồ

### Tại sao gây ấn tượng
- Trực quan hóa dữ liệu đẹp mắt luôn gây ấn tượng mạnh khi demo
- Kết hợp AI + D3.js/React Flow thể hiện chiều sâu kỹ thuật
- Phản ánh triết lý "học tập thích ứng": mỗi học sinh có một graph khác nhau

### Cách triển khai
| Thành phần | Công nghệ |
|------------|-----------|
| AI sinh cấu trúc graph | Prompt yêu cầu AI trả về JSON cấu trúc cây (node, edge, weight) |
| Hiển thị Mind Map | `reactflow` hoặc `d3-force` |
| Hiển thị Knowledge Graph | `@xyflow/react` (React Flow v12) |
| Cache graph | Lưu JSON vào cột `objectives` hoặc bảng mới trong DB |
| Màu theo tiến độ | Join dữ liệu từ `weakness_profiles` + `progress` |

### Tận dụng code có sẵn
- AI prompt engine (`backend/internal/ai/prompts.go`) — thêm prompt sinh graph
- Weakness data (`backend/internal/weaknesses/service.go`)
- Lesson context (`backend/internal/lessons/service.go`)
- Subject/Course data có sẵn

### Công sức
**Trung bình** — Chủ yếu là frontend visualization + 1 AI prompt mới + 1 API endpoint.

---

## 3. ⚔️ Quiz Battle / Đấu Trí

### Mô tả
Học sinh **thách đấu** bạn cùng lớp trong trận đấu quiz real-time. Cả hai cùng trả lời một bộ câu hỏi do AI sinh. Ai trả lời nhanh hơn và đúng nhiều hơn sẽ thắng. Hệ thống có bảng xếp hạng ELO.

### Trải nghiệm người dùng
- Màn hình **tìm trận**: chọn môn, chờ ghép cặp (matchmaking)
- Màn hình **đấu**: chia đôi màn hình — bên trái là mình, bên phải là đối thủ
- Mỗi câu hỏi có **đồng hồ đếm ngược 10 giây**
- **Thanh máu** (HP bar) giảm khi trả lời sai, animation rung lắc kịch tính
- Hiệu ứng "CRITICAL HIT" khi trả lời đúng trong 2 giây đầu
- Kết thúc: màn hình chiến thắng/thất bại với animation + điểm ELO thay đổi
- **Bảng xếp hạng đấu trí** riêng với ELO rating

### Tại sao gây ấn tượng
- Biến việc học thành **trò chơi đối kháng** — yếu tố cạnh tranh tạo động lực mạnh
- Demo 2 màn hình/browser cạnh nhau cực kỳ mãn nhãn
- ELO rating system cho thấy sự nghiêm túc trong thiết kế (như cờ vua, Liên Minh)

### Cách triển khai
| Thành phần | Công nghệ |
|------------|-----------|
| Matchmaking | WebSocket hub trên Go backend, queue người chơi |
| Real-time sync | WebSocket broadcast câu hỏi, đáp án, điểm số |
| AI sinh câu hỏi | Tận dụng `POST /api/ai/quiz/generate` có sẵn |
| ELO rating | Lưu `elo_rating` vào bảng `users`, tính toán sau mỗi trận |
| Animation | CSS keyframes + framer-motion cho HP bar, critical hit |

### Tận dụng code có sẵn
- Quiz generator API (`backend/internal/ai/handler.go` — `GenerateQuiz`)
- Hệ thống diamond (thưởng diamond khi thắng trận)
- Leaderboard có sẵn (`backend/internal/progress/`)

### Công sức
**Cao** — Cần WebSocket server mới, matchmaking logic, real-time game state, UI game.

---

## 4. 📅 AI Study Planner

### Mô tả
AI phân tích toàn bộ dữ liệu học tập của học sinh (điểm yếu, assignment deadline, lịch sử học, streak, mục tiêu) để tạo **kế hoạch học tập cá nhân hóa mỗi ngày**.

### Trải nghiệm người dùng
- Giao diện **timeline/calendar** hiển thị kế hoạch hôm nay
- Mỗi mục: "📖 Ôn Phân Số (15 phút) → ✏️ Làm 3 bài tập → 🧠 Quiz kiểm tra"
- Cảnh báo thông minh: "⚠️ Assignment Toán còn 2 ngày, bạn chưa bắt đầu!"
- Nút **"Bắt đầu học"** cho từng mục — click vào mở trực tiếp bài học
- Cho phép kéo thả để sắp xếp lại thứ tự ưu tiên
- Cuối ngày: tổng kết "Bạn đã hoàn thành 3/5 mục tiêu hôm nay"
- Lịch sử các ngày trước có thể xem lại

### Tại sao gây ấn tượng
- Thể hiện AI không chỉ phản ứng (trả lời câu hỏi) mà còn **chủ động dẫn dắt**
- Cá nhân hóa sâu dựa trên dữ liệu thực của học sinh
- Giải quyết vấn đề thực tế: học sinh không biết bắt đầu từ đâu

### Cách triển khai
| Thành phần | Công nghệ |
|------------|-----------|
| AI sinh kế hoạch | Prompt mới: input là weakness, assignments, progress → output là timeline JSON |
| Giao diện timeline | Component tùy chỉnh với CSS grid/timeline |
| Calendar view | `react-day-picker` hoặc custom |
| Lưu kế hoạch | Bảng `study_plans`: id, user_id, date, plan_json, completion_json |

### Tận dụng code có sẵn
- AI Coach endpoint (`POST /api/ai/coach`) — có thể mở rộng
- Weakness profiles (`backend/internal/weaknesses/`)
- Assignments với deadline (`backend/internal/assignments/`)
- Study progress & streak (`backend/internal/progress/`, `backend/internal/gamification/`)

### Công sức
**Trung bình** — Chủ yếu là prompt engineering + 1-2 API endpoints + frontend timeline.

---

## 5. 📊 AI Weekly Progress Reports

### Mô tả
Mỗi tuần AI tự động sinh **báo cáo tiến độ cá nhân hóa** cho từng học sinh. Báo cáo phân tích thời gian học, bài đã hoàn thành, điểm yếu cải thiện, và đưa ra đề xuất cho tuần tiếp theo. Phụ huynh và giáo viên cũng nhận được báo cáo của học sinh mình quản lý.

### Trải nghiệm người dùng
- **Trang "Báo cáo của tôi"**: danh sách báo cáo hàng tuần
- Mỗi báo cáo hiển thị dạng **dashboard thu nhỏ**:
  - 📊 Biểu đồ thời gian học từng ngày trong tuần
  - 🎯 Số bài hoàn thành & điểm trung bình
  - 🔴 Top 3 điểm yếu & xu hướng cải thiện
  - 💎 Kim cương kiếm được
  - 📝 AI Coach nhận xét: "Tuần này bạn đã tiến bộ rõ ở môn Toán, nhưng cần chú ý thêm..."
- Nút **Xuất PDF** để tải về hoặc gửi cho phụ huynh
- **Email tự động** (tùy chọn): gửi báo cáo vào mỗi Chủ Nhật

### Tại sao gây ấn tượng
- Tạo giá trị cho **cả 3 bên**: học sinh, phụ huynh, giáo viên
- Tự động hóa việc theo dõi tiến độ — phụ huynh không cần hỏi con "hôm nay học gì"
- Demo một báo cáo mẫu đẹp mắt cho ban giám khảo xem

### Cách triển khai
| Thành phần | Công nghệ |
|------------|-----------|
| AI sinh nội dung báo cáo | Prompt tận dụng AI Coach + thêm template báo cáo |
| Dữ liệu đầu vào | Aggregation từ: study_sessions, quiz_attempts, weaknesses, diamonds |
| Giao diện báo cáo | Trang mới với recharts + markdown rendering |
| PDF export | Backend: `go-wkhtmltopdf` hoặc `chromedp` render HTML → PDF |
| Email (tùy chọn) | SMTP integration hoặc Supabase email |

### Tận dụng code có sẵn
- Analytics overview (`backend/internal/analytics/handler.go`)
- AI Coach (`backend/internal/ai/handler.go` — `/api/ai/coach`)
- Weekly chart (`backend/internal/progress/` — `GetWeeklyChart`)
- Study sessions data

### Công sức
**Thấp-Trung bình** — Hầu hết dữ liệu đã có, chủ yếu là aggregation + UI mới.

---

## 6. 🃏 AI Flashcards + Spaced Repetition

### Mô tả
AI tự động tạo bộ **flashcard từ nội dung bài học**. Hệ thống áp dụng thuật toán **spaced repetition (SM-2)** để quyết định thẻ nào cần ôn hôm nay. Giao diện lật thẻ mượt mà, kèm streak ôn tập hàng ngày.

### Trải nghiệm người dùng
- Sau khi học xong bài: nút **"Tạo Flashcard"** — AI sinh 5-10 thẻ từ nội dung
- **Màn hình ôn tập**: thẻ hiển thị câu hỏi → click lật → hiện đáp án → chọn mức độ:
  - 🔴 Khó (lặp lại sau 1 ngày)
  - 🟡 Vừa (lặp lại sau 3 ngày)
  - 🟢 Dễ (lặp lại sau 7 ngày)
- **Dashboard Flashcards**: hiển thị số thẻ cần ôn hôm nay, tiến độ tổng
- **Streak ôn tập**: ngày ôn flashcard liên tiếp (tận dụng streak system)
- Animation **lật thẻ 3D** (CSS 3D transform) mượt mà

### Tại sao gây ấn tượng
- Dựa trên **khoa học nhận thức đã được chứng minh** (spaced repetition = phương pháp học hiệu quả nhất)
- Animation flip card đẹp mắt khi demo
- Cho thấy team hiểu về learning science, không chỉ chạy theo công nghệ

### Cách triển khai
| Thành phần | Công nghệ |
|------------|-----------|
| AI sinh flashcard | Prompt mới: "Tạo N cặp câu hỏi-đáp từ nội dung bài học sau" |
| Spaced Repetition | Thuật toán SM-2: tính `next_review_date` dựa trên `ease_factor` và `interval` |
| Giao diện lật thẻ | CSS `transform: rotateY(180deg)` + `perspective` |
| Dashboard | Trang `/flashcards` với thống kê + danh sách thẻ cần ôn |

### Tận dụng code có sẵn
- AI content generation (`backend/internal/ai/prompts.go`)
- Streak system (`backend/internal/gamification/streaks.go`)
- API client (`api-client.ts`)

### Công sức
**Trung bình** — Model mới trong DB + 2-3 API endpoints + frontend flip animation.

---

## So sánh tổng quan

| # | Tính năng | Độ WOW | Công sức | Tận dụng code có sẵn | Thời gian dự kiến |
|---|-----------|---------|----------|----------------------|-------------------|
| 1 | AI Voice Chat | ⭐⭐⭐⭐⭐ | Cao | SSE, AI Chat, Socratic prompt | 5-7 ngày |
| 2 | Mind Map / Knowledge Graph | ⭐⭐⭐⭐⭐ | Trung bình | AI prompts, weakness data, lessons | 3-4 ngày |
| 3 | Quiz Battle / Đấu Trí | ⭐⭐⭐⭐ | Cao | Quiz generator, leaderboard, diamonds | 5-7 ngày |
| 4 | AI Study Planner | ⭐⭐⭐⭐ | Trung bình | AI Coach, weakness, assignments, progress | 3-4 ngày |
| 5 | Weekly AI Reports | ⭐⭐⭐ | Thấp | Analytics, AI Coach, progress, charts | 2-3 ngày |
| 6 | Flashcards + SR | ⭐⭐⭐⭐ | Trung bình | AI generation, streak, API client | 3-4 ngày |

---

## Lộ trình đề xuất

### Giai đoạn 1 — Ấn tượng thị giác (làm trước)
1. **Mind Map / Knowledge Graph** — Demo đẹp mắt, vừa sức
2. **Flashcards + Spaced Repetition** — Animation flip card ấn tượng

### Giai đoạn 2 — Chiều sâu AI (làm sau)
3. **AI Study Planner** — Thể hiện AI chủ động dẫn dắt
4. **Weekly AI Reports** — Giá trị cho phụ huynh & giáo viên

### Giai đoạn 3 — Đỉnh cao công nghệ (làm cuối, nếu còn thời gian)
5. **AI Voice Chat** — Công nghệ tiên tiến nhất
6. **Quiz Battle / Đấu Trí** — Real-time multiplayer

---

## Ghi chú

- Tất cả text trong giao diện tuân thủ nguyên tắc **tiếng Việt** (theo CLAUDE.md)
- Sử dụng tối đa hạ tầng hiện có: AI pipeline, SSE streaming, rate limiting, RBAC
- Không thêm dependency không cần thiết — ưu tiên thư viện đã có trong project
- Mỗi tính năng cần có error state, loading state, empty state đầy đủ