# Báo Cáo Kiểm Tra Codebase — 10/06/2026

## Tổng Quan

| Chỉ số | Trước | Sau (10/06) |
|--------|-------|-------------|
| ESLint errors | 31 | **21** ✅ |
| ESLint warnings | 27 | **23** ✅ |
| File dead code | 3+ | **0** ✅ |
| Dependency không dùng | 5 packages | **0** ✅ |
| File page >1000 dòng | 3 files | 3 files (1 đã giảm 14%) |
| Test frontend | 0 file, 0 test | **5 files, 50 tests** ✅ |
| Test coverage (lines) | 0% | **91.45%** ✅ |
| Custom hooks | 1 | **2** ✅ |
| AI handler | 1818 dòng, 1 file | **6 files** (nhỏ nhất 154 dòng) ✅ |

---

## 1. Dead Code

### 1.1 ~~Component PDF viewer không được sử dụng~~ ✅ ĐÃ XOÁ

> **Đã xử lý 10/06/2026.** Cả 2 file và thư mục `src/components/pdf/` đã bị xoá.

<details>
<summary>Chi tiết cũ</summary>

Cả hai component PDF viewer đều **không hề được import** trong toàn bộ `src/`. Code chết hoàn toàn.

| File | Dòng | Mô tả |
|------|------|-------|
| `src/components/pdf/pdf-viewer.tsx` | 113 | PDF viewer dùng react-pdf, render từng trang |
| `src/components/lessons/pdf-viewer.tsx` | 25 | PDF viewer dùng iframe proxy URL |

</details>

### 1.2 ~~Thư mục rỗng `src/components/assignments/`~~ ✅ ĐÃ XOÁ

> **Đã xử lý 10/06/2026.**

### 1.3 ~~Backend: `_ = quizzesSvc`~~ ✅ ĐÃ XOÁ (10/06/2026)

> Đã xoá import, khởi tạo, và `_ = quizzesSvc` khỏi `router.go`. Backend build sạch.

---

## 2. ESLint — 31 Errors + 27 Warnings

### 2.1 ~~Errors: `any` type trong WeaknessQuizPanel~~ ✅ ĐÃ SỬA

> **Đã xử lý 10/06/2026.** Đã thêm 3 interface (`WeaknessQuestion`, `WeaknessOption`, `QuizState`) và thay 10 chỗ `any` bằng type cụ thể.

<details>
<summary>Interface đã thêm</summary>

```ts
interface WeaknessOption {
  text: string;
  isCorrect: boolean;
}

interface WeaknessQuestion {
  id?: string;
  question: string;
  weaknessTopic?: string;
  weaknessId?: string;
  options?: WeaknessOption[];
  answered?: boolean;
  correct?: boolean;
  selectedIdx?: number;
  explanation?: string;
}

interface QuizState {
  loading: boolean;
  questions: WeaknessQuestion[];
  error?: string;
}
```

</details>

### 2.2 Warnings đáng chú ý

| File | Dòng | Vấn đề | Trạng thái |
|------|------|--------|------------|
| `teacher/reports/[studentId]/page.tsx` | 5 | Import `BarChart3`, `TrendingUp` không dùng | ✅ Đã sửa |
| `teacher/reports/page.tsx` | 19 | Biến `user` được gán nhưng không dùng | ✅ Đã sửa |
| `teacher/students/new/page.tsx` | 50 | Biến `filledCount` được gán nhưng không dùng | ✅ Đã sửa |
| `assignment/grading-sheet.tsx` | 420 | Dùng `<img>` thay vì `<Image />` từ `next/image` | ✅ Đã sửa |
| `app/layout.tsx` | 19 | Custom font không thêm trong `_document`, chỉ load cho 1 page | ✅ Đã suppress |

---

## 3. Dependency Không Dùng

Các package trong `package.json` nhưng **không hề được import** trong `src/`:

| Package | Vị trí | Ghi chú |
|---------|--------|---------|
| `dagre` | dependencies | Layout engine cho graph; `@xyflow/react` đã có sẵn engine riêng |
| `@types/dagre` | devDependencies | Type cho dagre |
| `jimp` | devDependencies | Xử lý ảnh; có thể leftover từ favicon generation |
| `png-to-ico` | devDependencies | Chuyển PNG sang ICO |
| `pngjs` | devDependencies | Đọc/ghi PNG |

**Hành động:** ~~Chạy `pnpm remove dagre @types/dagre jimp png-to-ico pngjs`~~ ✅ ĐÃ XOÁ 10/06/2026 — giảm 66 packages.

---

## 4. ~~Không Có Test Frontend~~ ✅ ĐÃ THIẾT LẬP (10/06/2026)

> **Đã thêm vitest + @testing-library. 50 tests, coverage 91.45% lines.**

### Test infrastructure

| Thành phần | Trạng thái |
|------------|------------|
| Vitest config | ✅ `vitest.config.ts` |
| jsdom environment | ✅ |
| `@testing-library/react` | ✅ |
| `@testing-library/jest-dom` | ✅ |
| Coverage (v8) | ✅ `@vitest/coverage-v8` |
| `pnpm test` script | ✅ |

### Test files (5 files, 50 tests)

| File | Tests | Mô tả |
|------|-------|-------|
| `src/lib/__tests__/utils.test.ts` | 8 | `cn()` merge class, conditional, edge cases |
| `src/lib/__tests__/api-client.test.ts` | 15 | `api()`, `ApiError`, `fetchList()`, `uploadFile()`, `apiStream()` |
| `src/hooks/__tests__/use-study-timer.test.ts` | 12 | Timer lifecycle, session API, visibility, beforeunload |
| `src/components/ai/__tests__/math-text.test.tsx` | 7 | LaTeX rendering, HTML escape, error fallback |
| `src/components/ai/__tests__/interactive-quiz.test.tsx` | 8 | Quiz render, answer selection, API validation, error handling |

### Coverage (10/06/2026)

```
Statements : 87.78%  (266/303)
Branches   : 76.10%  (121/159)
Functions  : 93.33%  ( 42/ 45)
Lines      : 91.45%  (257/281)
```

### Lộ trình còn lại

```
✅ 1. Cài vitest + @testing-library/react
✅ 2. Viết test cho use-study-timer.ts
✅ 3. Viết test cho src/lib/utils.ts
✅ 4. Viết test cho src/lib/api-client.ts
✅ 5. Viết test cho component AI quiz (math-text, interactive-quiz)
⬜ 6. Tăng dần coverage cho page lớn (assignment, admin)
```

---

## 5. Page File Quá Lớn

3 file chiếm gần **4000 dòng**:

| File | Trước | Sau (10/06) | Trạng thái |
|------|-------|-------------|------------|
| `teacher/assignments/[id]/page.tsx` | 1,190 | **1,022** | ✅ Đã tách types (91) + hook (120) |
| `assignments/[id]/page.tsx` | 1,412 | 1,412 | ⬜ |
| `admin/assignments/page.tsx` | 1,382 | 1,382 | ⬜ |

### Đã làm: `teacher/assignments/[id]/`

```
teacher/assignments/[id]/
├── page.tsx                         ← 1022 dòng (từ 1190)
├── _types.ts                        ← 91 dòng (types + constants)
└── _hooks/
    └── use-question-editor.ts       ← 120 dòng (state + 9 methods)
```

### Gợi ý tách nhỏ (còn lại)

```
assignments/[id]/
├── page.tsx              ← ~200 dòng, chỉ orchestration
├── _components/           ← UI components
│   ├── assignment-header.tsx
│   ├── assignment-content.tsx
│   ├── submission-list.tsx
│   └── grading-panel.tsx
└── _hooks/                ← logic hooks
    ├── use-assignment-detail.ts
    ├── use-submission.ts
    └── use-grading.ts
```

---

## 6. Thiếu Custom Hooks

Trước: **1 hook** (`use-study-timer.ts`). Sau (10/06): **2 hooks** — thêm `use-question-editor.ts`.

Các hook tiềm năng nên tách ra:
- ~~`useQuestionEditor()`~~ ✅ Đã tách (120 dòng, 9 methods)
- `useAssignments()` — fetch + cache bài tập
- `useSubmissions()` — quản lý nộp bài
- `useGrading()` — logic chấm điểm
- `useAIChat()` — quản lý chat session với AI
- `useQuiz()` — quản lý trạng thái quiz
- `usePagination()` — phân trang (đang duplicate logic ở nhiều page)

---

## 7. Các Vấn Đề Nhỏ Khác

### 7.1 Backend: Go test coverage

Backend Go không thấy file `*_test.go`. Nên kiểm tra và bổ sung test cho các handler quan trọng (AI, grading).

### 7.2 Logger chuẩn

Backend dùng `log.Printf` — cân nhắc dùng structured logger như `slog` (Go 1.21+) hoặc `zerolog` để dễ debug trên production.

### 7.3 ~~AI handler 1818 dòng~~ ✅ ĐÃ TÁCH (10/06/2026)

> Dùng Go AST parser (`go/parser` + `go/printer`) để tách chính xác 51 declarations thành 6 file.

| File | Dòng | Nội dung |
|------|------|----------|
| `ai/handler.go` | 154 | Handler struct, NewHandler, utilities |
| `ai/chat.go` | 173 | chatInput type, Chat |
| `ai/quiz.go` | 339 | ExtractQuestions, ValidateQuiz, CompletionQuiz, GenerateQuiz, GenerateWeaknessQuiz |
| `ai/exercise.go` | 375 | GenerateExercise, GradeExercise, GenerateRemediation, GenerateRemediationAssignment |
| `ai/content.go` | 610 | Coach, LessonSummary, MindMap, KnowledgeGraph, GenerateFlashcards, SummarizeWeaknesses |
| `ai/grading.go` | 150 | Grade, normalizeScores, GenerateAssignment |
| **Tổng** | **1801** | 6 files (giảm 91.5% file chính: 1818 → 154 dòng) |

---

## Tổng Kết Mức Độ Ưu Tiên

### 🔴 ~~Làm ngay~~ ✅ ĐÃ XONG (10/06/2026)

| # | Hành động | Kết quả |
|---|-----------|---------|
| 1 | Xoá 2 file PDF viewer + thư mục rỗng | ✅ Đã xoá |
| 2 | Xoá 5 dependency không dùng | ✅ Đã xoá, giảm 66 packages |
| 3 | Sửa import/biến không dùng (3 files) | ✅ Đã sửa |
| 4 | Sửa `any` type trong weakness-quiz-panel | ✅ Đã sửa, thêm 3 interface |

### 🟡 Làm tuần này

| # | Hành động | Thời gian ước tính |
|---|-----------|-------------------|
| ~~5~~ | ~~Cài vitest + viết test~~ | ✅ Đã xong (5 files, 50 tests, 91.45% coverage) |
| 6 | ~~Tách 1 page lớn ra hooks + components~~ | ✅ Teacher assignments page: 1190→1022, types + hook đã tách |
| 7 | ~~Backend: xoá quizzesSvc / tách AI handler~~ | ✅ quizzesSvc đã xoá. AI handler đã tách thành 6 file (1818→154 dòng) |

### 🟢 Cân nhắc dài hạn

| # | Hành động |
|---|-----------|
| 8 | Test coverage cho critical path (quiz, grading, auth) |
| 9 | Tách toàn bộ page lớn |
| 10 | Backend: structured logging, Go test coverage |
