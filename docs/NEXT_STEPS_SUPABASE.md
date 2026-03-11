## Supabase 개인화 작업 진행상황 & 다음 단계

### 1. 현재까지 완료된 것

- **UI/사용성**
  - 메인 피드 UI, 모바일 헤더, 다크모드, 필터/빈 상태 메시지 1·2차 다듬기 완료.
  - 사이드바에서 각 유튜브 채널·RSS 클릭 시 해당 소스만 보는 기능 구현.
  - YouTube API 키 상태, RSS 정상 여부를 헤더/사이드바/본문에서 일관되게 노출.

- **데이터 수집/안정성**
  - YouTube API 에러(키 없음/키 오류/요청 실패) 시 조용히 폴백하고 경고만 1회 로그.
  - RSS/YouTube 모두 중복 제거 + 날짜 정렬 + ID 안정화 처리.

- **AI·개인화 준비**
  - 설치 완료: `@supabase/ssr`, `@supabase/supabase-js`, `@google/genai`, `youtube-transcript`.
  - Supabase 연결 / Auth / DB 스키마 / 요약 파이프라인은 아직 미구현.
  - `Supabase 개인화 로드맵`(plan 파일)로 전체 Phase 1~4 큰 그림 설계 완료.

- **Git/GitHub & 보안**
  - 로컬 `main`과 GitHub `origin/main` 동기화 완료.
  - `.env.example`의 실제 YouTube API 키는 제거하고 placeholder(`your_youtube_api_key_here`)만 남김.
  - `.env.local` 등 실제 키 파일은 `.gitignore`에 의해 커밋 제외.

---

### 2. 전체 우선순위 (Phase 기준)

1. **Supabase Auth & 기본 DB 구조 (Phase 1)**
   - Supabase 프로젝트 연결
   - Google 로그인 연동
   - `users`, `subscriptions` 스키마 + RLS 규칙 확정

2. **구독 관리(Settings) + 기본 개인화 (Phase 2)**
   - Settings 페이지에서 유튜브/RSS URL 추가·삭제 UI
   - 유튜브 URL → Channel ID 파싱 유틸
   - `defaultSources`를 로그인 전 데모용으로만 남기고, 로그인 시에는 DB 구독 기반으로 전환

3. **AI 요약 파이프라인 설계 (Phase 3 준비)**
   - `transcript.ts` (유튜브 자막 추출), `gemini.ts` (요약 호출) 서비스 계층 설계
   - `feed_items` 테이블 설계 (원문 메타 + 요약 + 상태 플래그)

4. **북마크/크론 등 부가 기능 (Phase 4)**
   - 북마크/나중에 보기 테이블 및 UI
   - Vercel Cron으로 주기적 피드·요약 미리 생성

---

### 3. 체크리스트 (내일 이후 바로 이어서 할 일)

#### [Phase 1 – Supabase/Auth]
- [ ] Supabase 프로젝트 생성, `SUPABASE_URL`, `ANON_KEY` 발급
- [ ] `.env.local`에 Supabase/Google OAuth 설정 추가
- [ ] `src/lib/supabase-server.ts` (필요 시 `supabase-client.ts`도) 생성
- [ ] Google 로그인 버튼 컴포넌트 추가 (`src/components/auth/LoginButton.tsx` 예정)
- [ ] 상단/사이드바에 로그인 상태(프로필/로그인 버튼) 노출

#### [Phase 2 – 구독/Settings]
- [ ] `subscriptions` 테이블 DDL + RLS 정책 작성
- [ ] `src/lib/subscriptions.ts`에서 CRUD 함수 구현
- [ ] `src/app/settings/page.tsx` + `SubscriptionForm` 구현
- [ ] `defaultSources`를 “로그인 전 데모 소스”로만 사용하도록 정리
- [ ] `getMergedFeed`가 로그인 유저의 `subscriptions`를 사용하도록 변경

#### [Phase 3 – AI 요약 준비]
- [ ] `src/lib/transcript.ts` 설계 (youtube-transcript 사용 전략 포함)
- [ ] `src/lib/gemini.ts` 설계 (`GEMINI_API_KEY` 기반)
- [ ] `feed_items` 테이블 설계 및 요약 상태 플로우 정의

---

### 4. 내일 시작할 때 참고 문장

> 어제 작업 이어서, `.env` 상태 확인 후 Supabase Auth부터 붙이고 Phase 1 체크리스트를 순서대로 진행한다.

