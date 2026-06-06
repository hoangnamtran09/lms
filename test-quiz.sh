#!/bin/bash
# Quick test /api/ai/completion-quiz
# Usage: ./test-quiz.sh [lessonId] [questionCount]

LESSON_ID="${1:-fa6449d0-6a2e-4bb9-843f-8a64fa9ba1f3}"
COUNT="${2:-2}"
BACKEND="https://lms-backend.agreeableriver-a1dda4c6.southeastasia.azurecontainerapps.io"
SUPABASE_URL="https://rafubckyfkvjjxsdceiz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZnViY2t5Zmt2amp4c2RjZWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDY3NzMsImV4cCI6MjA5MzgyMjc3M30.gse7PabjrVtJBf0MuVJZ81XrUgi8aVZcyktXNIFzHeM"

# Login & get token
echo "🔐 Đang lấy token..."
LOGIN_RESP=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"hs1@lms.internal","password":"Test@123"}' 2>&1)

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Không lấy được token. Response:"
  echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESP"
  echo ""
  echo "💡 Fallback: paste token thủ công"
  echo "   Lấy từ browser console:"
  echo "   document.cookie.split('; ').find(c=>c.startsWith('sb-rafubcky'))?.split('=')[1]"
  exit 1
fi
echo "✅ Đã có token"

# Test API
echo ""
echo "🚀 Gọi /api/ai/completion-quiz (${COUNT} câu)..."
START=$(python3 -c "import time; print(int(time.time()*1000))")

RESP=$(curl -s -w "\n%{http_code}" -X POST "${BACKEND}/api/ai/completion-quiz" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"lessonId\":\"${LESSON_ID}\",\"sessionId\":\"script-test\",\"questionCount\":${COUNT}}" 2>&1)

END=$(python3 -c "import time; print(int(time.time()*1000))")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
ELAPSED=$((END - START))

if [ "$HTTP_CODE" = "200" ]; then
  Q_COUNT=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('questions',[])))" 2>/dev/null)
  echo "✅ HTTP 200 | ${Q_COUNT} câu hỏi | ${ELAPSED}ms"
  echo ""
  echo "$BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for i, q in enumerate(d.get('questions', [])):
    print(f\"\033[1;36m--- Câu {i+1}: {q['question']} ---\033[0m\")
    for j, o in enumerate(q['options']):
        print(f\"  {chr(65+j)}. {o['text']}\")
    print(f\"  \033[90m💡 {q['explanation']}\033[0m\")
    print()
"
else
  echo "❌ HTTP ${HTTP_CODE} | ${ELAPSED}ms"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
fi
