# 입트영 English Habit App

1인용 영어 학습 PWA. 교재 사진에서 핵심 표현을 자동 추출하고, 회화·작문·복습까지 한 흐름으로 묶었어요.

```
.
├── client/   # Vite + React 18 + TypeScript + Tailwind (PWA)
└── server/   # Node + Express + Anthropic (Claude) + OpenAI (Whisper)
```

---

## 기능 한눈에 보기

| 탭 | 무엇을 하는가 |
| --- | --- |
| **Home** | 연속 학습일(streak), 이번 주 암기율, 누적 통계, 갈무리·기록 진입점, 설정(테마·백업) |
| **Today** | 교재 페이지 사진 업로드 → Claude vision으로 8~15개 핵심 표현 자동 추출 → 카드로 표시 |
| **Conversation** | 오늘의 표현으로 Claude와 영어 회화. 한국어 코멘트 + 다양한 영어 표현 제안(paraphrases) + 다음 질문. 마이크 입력 지원 |
| **Writing** | 오늘 주제로 영작 과제 생성 → 답 작성 → Claude가 문장별 교정·총평·모범답안 첨삭 |
| **Review** | 주차별 학습 정리 + 플래시카드(타이핑 / 보고 말하기). 마이크로 답해도 자동 채점 |

추가 페이지:
- **/saved** — ★ 갈무리(북마크)한 표현 + 복습에서 “다시” 표시한 표현(오답) 모아보기
- **/history** — 캘린더로 날짜 선택 → 그 날 학습 내용(세션·표현·대화·영작) 확인
- **/expression/:id** — 표현 상세(발음·예문·유사 표현·내 문장)

---

## 사전 준비

1. **Node.js 18 이상**
2. **Anthropic API 키** (https://console.anthropic.com)
3. **OpenAI API 키** — 마이크 입력(아이폰 등)에서 음성→텍스트 변환에 사용. 없으면 마이크 답변 기능만 비활성, 다른 기능은 모두 동작.
4. `server/.env` 파일 생성:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...        # 없어도 됨 (마이크 답변 기능만 안 됨)
   PORT=8787
   ```

---

## 로컬에서 돌리기

```powershell
npm run install:all       # 루트 + server + client 의존성
npm run dev               # server(:8787) + client(:5173) 동시 실행
```

- 클라이언트: http://localhost:5173
- 서버 헬스체크: http://localhost:8787/api/health

### 폰에서도 보고 싶다면 (같은 Wi-Fi)

- `client/vite.config.ts`의 `server.host`는 이미 `true` 라서 LAN 노출됨
- 단, **마이크가 동작하려면 HTTPS가 필요해** (보안 컨텍스트). LAN의 http:// 주소는 마이크 권한이 막힘
- HTTPS 터널이 필요하면:

  ```powershell
  # cloudflared 한 번 설치 (예: winget install Cloudflare.cloudflared)
  cloudflared tunnel --url http://localhost:5173
  ```

  → `https://xxx.trycloudflare.com` 같은 임시 URL이 발급됨. 폰 Safari/Chrome에 입력 → "홈 화면에 추가"

### Vite가 외부 host를 거부할 때
`client/vite.config.ts`에 `server.allowedHosts: true` 가 이미 설정돼 있어서 cloudflared 등 임의 도메인을 허용함.

---

## 배포

`server/render.yaml` + `client/vercel.json` 가 준비돼 있음.

### 서버 → Render
1. GitHub에 푸시
2. https://dashboard.render.com → New + → Blueprint → 저장소 선택
3. `server/render.yaml` 자동 감지 → web service 1개 생성
4. Environment 탭에 입력:
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY` (선택)
   - `ALLOWED_ORIGIN` = 곧 배포할 클라 도메인 (비워두면 모든 origin 허용 — 1인용이라면 OK)
5. 배포 완료 → `https://xxx.onrender.com` 발급

### 클라이언트 → Vercel
1. https://vercel.com → Add New → Project → 같은 저장소
2. Root Directory: `client`
3. Environment Variables:
   - `VITE_API_BASE_URL` = 위에서 받은 서버 URL
4. Deploy → `https://xxx.vercel.app`
5. (선택) Render의 `ALLOWED_ORIGIN`을 이 도메인으로 설정 후 재배포

### 폰에 앱처럼 설치
- **iOS Safari**: 공유 버튼 → "홈 화면에 추가"
- **Android Chrome**: 우상단 메뉴 → "앱 설치" 또는 "홈 화면에 추가"

---

## 사용 흐름 (전체)

1. **Today** 탭 → 📷 → 교재 페이지 한 장 → "표현 추출하기" → 카드 리스트
2. 카드 탭 → **표현 상세** (영어 / 한국어 / 유형 / 교재 예문 ▶ / 유사 표현 / 내 문장 작성·첨삭 / ★ 갈무리 토글)
3. **Conversation** 탭 → 세션 선택 → "대화 시작하기" → 한국어 코멘트 + 같은 의미 다른 표현 + 영어 질문. 답은 키보드 또는 🎤
4. **Writing** 탭 → 세션 선택 → "영작 과제 받기" → 3~5문장 작성 → "첨삭 받기" → 문장별 교정 + 총평 + 모범답안 ▶
5. **Review** 탭 → 주차 선택 → 플래시카드. "보고 말하기" + 마이크면 음성으로 답변 → 자동 채점. "타이핑"이면 키보드로 입력
6. **Home** → 연속 학습일·통계 확인. **갈무리** / **기록** 으로 모아보기·캘린더 탐색
7. **Settings**(Home 하단) → 테마(밝게/어둡게/시스템), 데이터 내보내기·가져오기

---

## 데이터 저장 위치

- 구조화 데이터(세션·표현·대화·영작): **localStorage**
- 이미지 Blob: **IndexedDB**
- 설정(테마·재생속도): **localStorage**

전부 브라우저 안에만 보관됨. 서버는 API 라우팅만 담당. 백업은 **Home → 설정 → 내보내기**에서 JSON 한 파일로 받고, 다른 기기에서 **가져오기**로 복원 가능.

---

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run install:all` | 루트 + server + client 의존성 설치 |
| `npm run dev` | server(8787) + client(5173) 동시 실행 |
| `npm run build` | server TS → dist, client Vite → dist (PWA 포함) |
| `npm --prefix client run preview` | 빌드된 PWA 결과 로컬 미리보기 |

---

## API 엔드포인트 요약

| Method | 경로 | 용도 |
| --- | --- | --- |
| GET | `/api/health` | 헬스체크 + API 키 설정 여부 |
| POST | `/api/extract` | 교재 이미지 → 핵심 표현 추출 |
| POST | `/api/enrich` | 표현 → 유사 표현·추가 예문 |
| POST | `/api/sentence-feedback` | 학습자 문장 → 자연스러움 평가·교정 |
| POST | `/api/conversation` | 회화 한 턴 (reply + paraphrases + nextQuestion) |
| POST | `/api/writing-prompt` | 주제 → 영작 과제 |
| POST | `/api/writing-feedback` | 학습자 영작 → 교정·총평·모범답안 |
| POST | `/api/transcribe` | 오디오 → 텍스트 (OpenAI Whisper) |
