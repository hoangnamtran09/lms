# Tính năng & Tiến độ phát triển

## Chú thích trạng thái
- ✅ Hoàn thiện
- 🚧 Đang phát triển
- 📋 Lên kế hoạch

---

## 1. Xác thực & Phân quyền

| Tính năng | Trạng thái |
|-----------|-----------|
| Đăng nhập / Đăng xuất qua Supabase Auth | ✅ |
| JWT middleware (Go backend) | ✅ |
| RBAC 5 vai trò (SUPER_ADMIN, ADMIN, TEACHER, PARENT, STUDENT) | ✅ |
| Ma trận phân quyền chi tiết (tài nguyên × hành động) | ✅ |
| Middleware Next.js redirect khi chưa đăng nhập | ✅ |
| Admin route protection | ✅ |
| Tự động logout khi token hết hạn | ✅ |

## 2. Quản lý học tập

| Tính năng | Trạng thái |
|-----------|-----------|
| CRUD Môn học | ✅ |
| CRUD Khóa học | ✅ |
| CRUD Bài học | ✅ |
| Upload PDF (Cloudflare R2) | ✅ |
| Upload hàng loạt PDF | ✅ |
| Xem PDF trong browser (react-pdf) | ✅ |
| Panel kéo thả resize (PDF / AI Chat) | ✅ |
| Khoá AI chat đến khi đọc đủ thời gian + số trang | ✅ |

## 3. Trợ lý AI (Socratic Tutor)

| Tính năng | Trạng thái |
|-----------|-----------|
| Chat streaming với AI (phương pháp Socratic) | ✅ |
| Quiz trắc nghiệm inline trong chat | ✅ |
| Sinh quiz tự động (5-20 câu) | ✅ |
| Quiz kết thúc bài học | ✅ |
| Tạo bài tập tự luận | ✅ |
| Chấm bài tập tự luận bằng AI | ✅ |
| Tóm tắt bài học | ✅ |
| Lộ trình học cá nhân (Roadmap) | ✅ |
| Huấn luyện viên học tập (Coach) | ✅ |
| Bài tập cải thiện điểm yếu (Remediation) | ✅ |
| Lịch sử chat (lưu / xoá) | ✅ |
| Hiển thị LaTeX (toán học) | ✅ |
| Rate limiting (chat: 30 req/min, generate: 10 req/min) | ✅ |

## 4. Bài tập & Chấm điểm

| Tính năng | Trạng thái |
|-----------|-----------|
| Tạo bài tập (tiêu đề, mô tả, rubric, điểm, hạn nộp, PDF, chọn học sinh) | ✅ |
| Nộp bài | ✅ |
| Chấm điểm thủ công | ✅ |
| Chấm điểm AI tự động | ✅ |
| Trả bài / yêu cầu sửa lại | ✅ |
| Quy trình: ASSIGNED → SUBMITTED → GRADED → RETURNED → ACCEPTED | ✅ |
| Audit log mọi thao tác | ✅ |
| Xuất CSV bảng điểm | ✅ |

## 5. Theo dõi tiến độ

| Tính năng | Trạng thái |
|-----------|-----------|
| Phiên học tự động (bắt đầu / tạm dừng / kết thúc) | ✅ |
| sendBeacon khi đóng tab | ✅ |
| Thống kê cá nhân (tổng giờ, hôm nay, tuần này, điểm TB) | ✅ |
| Biểu đồ cột 7 ngày | ✅ |
| Bảng xếp hạng (tuần / tháng / tất cả) | ✅ |
| Mục tiêu: 2h/ngày, 10h/tuần | ✅ |

## 6. Gamification

| Tính năng | Trạng thái |
|-----------|-----------|
| Kim cương (thưởng khi học, quiz, bài tập) | ✅ |
| Lịch sử giao dịch kim cương | ✅ |
| Admin trao thưởng thủ công | ✅ |
| Streak (chuỗi ngày học liên tục) | ✅ |
| Thành tựu (Achievements) | ✅ |

## 7. Chẩn đoán điểm yếu

| Tính năng | Trạng thái |
|-----------|-----------|
| Ghi nhận điểm yếu khi trả lời sai / điểm thấp | ✅ |
| Gom nhóm theo bài học + chủ đề | ✅ |
| Tự động cải thiện khi trả lời đúng | ✅ |
| AI tạo bài tập cải thiện riêng | ✅ |
| Giáo viên thêm ghi chú coach | ✅ |

## 8. Dashboard

| Tính năng | Trạng thái |
|-----------|-----------|
| Dashboard Học sinh | ✅ |
| Dashboard Admin (thống kê, biểu đồ, export) | ✅ |
| Dashboard Giáo viên | ✅ |
| Dashboard Phụ huynh (theo dõi con) | ✅ |

## 9. Quản trị

| Tính năng | Trạng thái |
|-----------|-----------|
| Quản lý người dùng (thêm / sửa / xoá / đổi role) | ✅ |
| Quản lý học sinh | ✅ |
| Quản lý giáo viên | ✅ |
| Quản lý môn học & bài học | ✅ |
| Quản lý bài tập | ✅ |
| Seed data tự động (admin, student01, teacher01) | ✅ |
| Export CSV (users, assignments) | ✅ |

## 10. Khác

| Tính năng | Trạng thái |
|-----------|-----------|
| UI Tiếng Việt toàn bộ | ✅ |
| Responsive (mobile / tablet / desktop) | ✅ |
| Skeleton loading, error & empty states | ✅ |
| ~45+ API endpoints | ✅ |
| Liên kết Phụ huynh - Học sinh | ✅ |

## 11. Đang phát triển

| Tính năng | Trạng thái |
|-----------|-----------|
| Lịch học (Schedule) | 🚧 |

---

## Tổng quan công nghệ

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Backend | Go 1.26 + Chi Router + GORM |
| Database | PostgreSQL 16 (Docker) |
| Auth | Supabase Auth (JWT) |
| Storage | Cloudflare R2 (PDF) |
| AI | BeeKnoee / Gemini API |

*Cập nhật lần cuối: 2026-05-15*
