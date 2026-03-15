# 세부 구현 단계 (결제·팀·API 등)

아래는 **이미 코드에 반영된 것**을 제외하고, **결제 플랫폼·팀·B2B API** 등을 구현할 때 필요한 세부 단계만 정리한 문서입니다.

**먼저 할 일**: Supabase에서 `docs/supabase-migrations/001_plan_usage_playlists.sql` 내용을 SQL Editor로 실행한 뒤, `.env.local`에 `OWNER_EMAIL=본인이메일`을 넣으면 주인 분리·사용량 제한·플레이리스트 개인화가 동작합니다.

---

## 1. 적용 완료된 것 (참고)

- 주인 분리: `OWNER_EMAIL` env + `getPlanForUser`에서 owner면 제한 없음
- 플랜·사용량: `user_plan`, `usage_daily` 테이블, `checkUsageLimit` / `incrementUsage`
- 요약·인사이트·브리핑 액션에 로그인·제한 적용
- 플레이리스트 `user_id` 저장·목록 필터
- 마이그레이션 SQL: `docs/supabase-migrations/001_plan_usage_playlists.sql`

---

## 2. 결제 플랫폼 (Stripe) 연동

### 2-1. 준비

1. **Stripe 계정** 생성, Dashboard에서 제품·가격 생성  
   - 예: 제품 "Focus Feed Pro", 가격 월 9,900원 (recurring).
2. **환경 변수**  
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`  
   - (선택) `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (클라이언트 결제 UI용).

### 2-2. 결제 플로우 (Pro 구독)

1. **결제 페이지 또는 결제 버튼**  
   - 클라이언트에서 Stripe Checkout Session 생성 API 호출  
   - 또는 Stripe Customer Portal 링크로 “구독 관리” 페이지 이동.
2. **서버 API**  
   - `POST /api/stripe/checkout-session`:  
     - 로그인 사용자 확인 → Stripe `customers.create` 또는 기존 customer_id 조회  
     - `checkout.sessions.create` (mode: subscription, price_id: Pro 월 구독 가격 ID)  
     - `success_url`, `cancel_url`에 본 사이트 URL  
     - 반환: `session.url`로 리다이렉트.
   - `POST /api/stripe/webhook`:  
     - `stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)` 로 검증  
     - 이벤트 타입별 처리:  
       - `checkout.session.completed`: subscription_id 저장, `user_plan`에 해당 user_id로 plan='pro', expires_at=현재+1개월(또는 Stripe 구독 현재 기간 끝)  
       - `customer.subscription.updated`: 구독 갱신/취소 반영 → `user_plan.expires_at` 갱신  
       - `customer.subscription.deleted`: plan='free' 또는 row 삭제  
     - 처리 후 `res.sendStatus(200)`.
3. **DB**  
   - `user_plan` 테이블 이미 있음.  
   - (선택) `stripe_customer_id`, `stripe_subscription_id` 컬럼 추가해 취소/갱신 시 조회용.

### 2-3. 체크리스트

- [ ] Stripe 제품·가격 생성
- [ ] `.env`에 `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` 추가
- [ ] `POST /api/stripe/checkout-session` 구현 (로그인 → session 생성 → url 반환)
- [ ] `POST /api/stripe/webhook` 구현 (서명 검증 → 이벤트별 user_plan 갱신)
- [ ] Stripe Dashboard에서 Webhook URL 등록 (로컬은 stripe cli `forward` 사용)
- [ ] 설정/프로필에 “Pro 구독하기” 버튼 → checkout session 호출 후 리다이렉트

---

## 3. 팀(workspace)·멤버·초대

### 3-1. 테이블 설계

```sql
-- 팀
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'team')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 팀 멤버 (역할: owner, admin, member)
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 팀 초대 (이메일·토큰·만료)
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3-2. API·플로우

1. **팀 생성**  
   - `POST /api/teams`: 로그인 사용자로 팀 생성, `team_members`에 role='owner'로 추가.
2. **초대 생성**  
   - `POST /api/teams/[teamId]/invite`: body `{ email }` → token 생성(UUID 등), `team_invites` 저장, (선택) 이메일 발송에 초대 링크 포함.
3. **초대 수락**  
   - `GET /api/teams/join?token=xxx`: token으로 `team_invites` 조회, 만료 확인, 로그인 사용자면 `team_members` 추가, invite 삭제 또는 used 표시.
4. **팀 목록**  
   - `GET /api/teams`: 현재 user_id가 속한 팀 목록 (`team_members` 조인).

### 3-3. 북마크·브리핑 팀 확장

- **북마크**: `bookmarks`에 `team_id` (nullable) 추가. 팀 전용 북마크는 `team_id` 설정, 개인은 null. 목록 조회 시 “내 개인” + “내가 속한 팀의 팀 북마크” 병합.
- **팀 브리핑**: `teams`에 `goal_text` 또는 별도 `team_goals` 테이블. “팀 브리핑 실행” 시 기존 `rankFeedByGoalsAction(teamGoalText)` 호출 후 결과를 팀 대시 또는 슬랙으로 전달.

### 3-4. 체크리스트

- [ ] `teams`, `team_members`, `team_invites` 마이그레이션
- [ ] `POST /api/teams`, `GET /api/teams` 구현
- [ ] `POST /api/teams/[teamId]/invite`, `GET /api/teams/join?token=`
- [ ] 북마크에 `team_id` 추가, 저장/조회 시 팀 필터
- [ ] 팀 목표 저장 + `rankFeedByGoalsAction` 호출해 팀 브리핑 노출

---

## 4. 슬랙·노션 연동

### 4-1. 슬랙

- **Incoming Webhook**: 슬랙 앱에서 Webhook URL 발급.  
- 서버: 팀 브리핑 결과 또는 “오늘의 추천” 생성 후 `fetch(webhookUrl, { method: 'POST', body: JSON.stringify({ text: "오늘 팀 추천: ..." }) })`.  
- (선택) 팀 설정에 “슬랙 Webhook URL” 저장 → 팀 브리핑 시 해당 URL로만 전송.

### 4-2. 노션

- **노션 API**: 연동 페이지에서 노션 OAuth 또는 내부 통합 토큰 발급.  
- “북마크·요약을 노션 DB에 넣기” 시 노션 Blocks API 또는 Databases API로 행 추가.  
- 팀별 “노션 DB ID” 저장 후, 팀 북마크/요약 저장 시 해당 DB에 행 생성.

### 4-3. 체크리스트

- [ ] 팀 설정에 (선택) 슬랙 Webhook URL 필드
- [ ] 팀 브리핑 완료 시 슬랙 메시지 전송
- [ ] (선택) 노션 연동 토큰·DB ID 저장, 북마크/요약 노션 행 생성

---

## 5. B2B·크리에이터 API (요약/챕터)

### 5-1. API 키

- **테이블**: `api_keys` (id, key_hash, name, user_id 또는 team_id, created_at).  
- 키는 생성 시 한 번만 평문 노출, 저장은 해시만.
- **인증**: 요청 헤더 `Authorization: Bearer <api_key>` 또는 `x-api-key: <api_key>`. 서버에서 키 해시로 조회 후 user/team 식별.

### 5-2. 엔드포인트

- `POST /api/v1/summarize`: body `{ video_id }` → 기존 `summarizeVideoAction` 로직 호출, API 키로 사용량만 `api_usage`에 적재 (user_plan 제한 대신 호출 횟수 제한).
- `POST /api/v1/chapters`: body `{ video_id }` → (챕터 생성 구현 후) 자막 구간별 챕터 제목 생성, JSON 반환.

### 5-3. 사용량·과금

- `api_usage` 테이블: (api_key_id 또는 user_id, month, summary_count, chapter_count).  
- 월별 상한 또는 호출당 과금은 정책에 따라 웹훅·cron에서 집계 후 결제 연동.

### 5-4. 체크리스트

- [ ] `api_keys`, `api_usage` 테이블
- [ ] API 키 발급 화면(로그인 후 “API 키 생성”)
- [ ] 미들웨어 또는 라우트에서 `x-api-key` 검증
- [ ] `POST /api/v1/summarize` (기존 요약 로직 재사용)
- [ ] 챕터 생성 로직 구현 후 `POST /api/v1/chapters`
- [ ] 사용량 집계·과금 정책 연결

---

## 6. 목표(My Focus) 서버 동기화

- **테이블**: `user_goals` (user_id, goals_text, updated_at) 또는 `profiles`에 `goals` 컬럼.  
- **저장**: 로그인 시 My Focus 입력 blur/저장 버튼에서 `POST /api/goals` 또는 서버 액션으로 저장.  
- **로드**: 피드 로드 시 서버에서 `user_goals` 조회해 초기값으로 전달. 클라이언트는 기존처럼 로컬 상태로 편집하다가 저장 시 서버에 반영.

---

위 단계만 순서대로 적용하면, 현재 구현된 주인·플랜·사용량·플레이리스트와 이어서 **결제·팀·API**까지 확장할 수 있습니다.
