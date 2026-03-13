# Supabase로 채널 목록 동기화 — 당장 할 일

현재 프로젝트 기준으로, **추가 채널**을 Supabase에 저장해 컴퓨터/노트북에서 공유하려면 아래 순서대로 진행하면 됩니다.

---

## 1. 이미 있는 것 (확인만 하면 됨)

| 항목 | 상태 |
|------|------|
| 패키지 | `@supabase/supabase-js`, `@supabase/ssr` 이미 설치됨 |
| Supabase 서버 클라이언트 | `src/lib/supabase-server.ts` — summaries, playlists, bookmarks 테이블 타입 정의됨 |
| 환경 변수 | `.env.local`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 있음 |
| 채널 데이터 구조 | `src/lib/sources.ts`의 `FeedSource` (id, name, type, category, avatarUrl?) |

**주의:** `SUPABASE_SERVICE_ROLE_KEY` 값이 `sb_publishable_...` 형태라면 **Anon Key**일 수 있음.  
Supabase 대시보드 → Settings → API에서 **Service Role Key** (비공개, 서버 전용)를 복사해 넣어야 RLS 우회·서버 전용 작업이 안정적으로 동작함.

---

## 2. Supabase 대시보드에서 할 일

### 2-1. 테이블 생성

**SQL Editor**에서 아래 실행:

```sql
-- 사용자별 추가 채널 저장 (Auth 사용 시 user_id로 구분)
create table if not exists public.custom_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,   -- YouTube 채널 ID (UC...)
  name text not null,
  category text not null default '기타',
  avatar_url text,
  created_at timestamptz not null default now(),
  unique(user_id, source_id)
);

-- RLS 활성화
alter table public.custom_sources enable row level security;

-- 정책: 본인 행만 조회/삽입/삭제 (Auth 사용 시)
create policy "Users can read own custom_sources"
  on public.custom_sources for select
  using (auth.uid() = user_id);

create policy "Users can insert own custom_sources"
  on public.custom_sources for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own custom_sources"
  on public.custom_sources for delete
  using (auth.uid() = user_id);
```

**로그인 없이 “동기화 코드”만 쓸 계획이면** `user_id` 대신 `sync_code text not null unique` 같은 컬럼로 테이블 설계를 바꾸고, RLS는 서버만 접근하도록 두는 방식으로 가면 됨.

### 2-2. Auth 설정 (기기 간 동기화용)

- **Authentication → Providers**  
  - **Anonymous** 켜기: “이메일 없이” 기기만 구분해 저장할 때 유용.  
  - 또는 **Email** / **Google** 등 원하는 로그인 방식 활성화.
- **Authentication → URL Configuration**  
  - Site URL에 로컬/배포 주소 넣기 (예: `http://localhost:3000`, `https://your-app.vercel.app`).

---

## 3. 환경 변수 추가

`.env.local`에 다음이 있는지 확인하고, **클라이언트에서 Auth를 쓸 경우**만 추가:

```env
# 이미 있음 (서버용)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Service Role Key (비공개)

# 클라이언트 Auth 사용 시 추가 (공개해도 되는 Anon Key)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- **서버 API만** 쓰고, 프론트에서는 쿠키/세션으로 “누가 로그인했는지”만 전달하는 구조라면 `NEXT_PUBLIC_*` 없이도 가능.
- Supabase Auth 로그인/로그아웃을 **브라우저에서** 하려면 `NEXT_PUBLIC_*` 두 개 필요.

---

## 4. 코드에서 할 일 (순서대로)

### 4-1. DB 타입 확장

**파일:** `src/lib/supabase-server.ts`

- `Database` 타입의 `public.Tables`에 `custom_sources` 테이블 추가.
- 컬럼: `id`, `user_id`, `source_id`, `name`, `category`, `avatar_url`, `created_at` (위 SQL과 동일한 이름/타입).

### 4-2. API 라우트 추가

| 용도 | 경로 | 메서드 | 설명 |
|------|------|--------|------|
| 목록 조회 | `/api/custom-sources` 또는 `/api/user/sources` | GET | 쿠키/세션에서 user 식별 후 해당 유저의 custom_sources 반환 |
| 채널 추가 | 위와 동일 | POST | body: `{ sourceId, name, category, avatarUrl? }` → DB insert 후 cookie도 갱신(선택) |
| 채널 삭제 | 위와 동일 + `?id=UC...` 또는 body | DELETE | 해당 행 delete |

- **서버**에서는 `getServerSupabaseClient()`로 Supabase 접근.
- **유저 식별:**  
  - Supabase Auth 사용 시: `@supabase/ssr`로 쿠키에서 세션 읽어 `user.id` 사용.  
  - 당장은 “쿠키만” 쓰고 Supabase는 “동기화용 백업”으로만 둘 수도 있음 → 그 경우 API에서 **device_id** 또는 **anonymous_id**를 쿠키로 받아서 `user_id` 대신 사용하는 식으로 설계 가능.

### 4-3. 페이지에서 소스 병합

**파일:** `src/app/page.tsx`

- 지금: `getCustomSourcesFromCookie(cookieStore.get(...))` 만 사용.
- 변경:  
  - (선택) 로그인 여부 또는 “동기화 코드” 여부에 따라 **API 호출**로 custom sources 목록을 가져오기.  
  - 가져온 목록을 `defaultSources`와 **merge** (이미 있는 `mergeSources` 활용).  
  - 로그인 안 했을 때는 **기존처럼 쿠키만** 쓰면 됨.

### 4-4. 채널 추가/삭제 시 Supabase 반영

**파일:**

- `src/components/feed/AddChannelModal.tsx`  
  - 채널 추가 성공 시: `document.cookie = buildCustomSourcesCookie(updated)` **뒤에** `/api/custom-sources` POST 호출 (로그인 시에만 호출하거나, 항상 호출 후 서버에서 “유저 없으면 무시” 처리).
- `src/components/layout/YouTubeSourceList.tsx`  
  - 채널 제거 시: 쿠키 갱신 **뒤에** `/api/custom-sources` DELETE 호출.

- **동기화 전략:**  
  - **A)** 로그인한 경우에만 API 호출하고, 비로그인은 쿠키만.  
  - **B)** 항상 API 호출하고, 서버에서 “anonymous id” 또는 “sync_code”로 저장 (로그인 없이 동기화 코드만 쓰는 경우).

---

## 5. 클라이언트 Supabase (Auth용, 선택)

- **Auth를 브라우저에서** 쓰려면 `createBrowserClient`(@supabase/ssr)로 클라이언트 전용 Supabase 인스턴스를 만들고, 로그인/로그아웃/세션 확인을 그걸로 처리.
- **위 API만** 쓰고, 로그인 UI는 NextAuth 등으로 할 경우에는 Supabase 클라이언트 Auth를 안 써도 됨.

---

## 6. 체크리스트 요약

- [ ] Supabase 대시보드: `custom_sources` 테이블 + RLS 생성
- [ ] Supabase 대시보드: Auth(Anonymous 또는 Email/소셜) 활성화
- [ ] `.env.local`: Service Role Key 확인, (선택) `NEXT_PUBLIC_SUPABASE_*` 추가
- [ ] `supabase-server.ts`: `Database`에 `custom_sources` 타입 추가
- [ ] API 라우트: GET/POST/DELETE `/api/custom-sources` (또는 `/api/user/sources`) 구현
- [ ] `page.tsx`: 필요 시 API에서 custom sources 가져와서 merge
- [ ] `AddChannelModal.tsx`: 채널 추가 시 API 호출
- [ ] `YouTubeSourceList.tsx`: 채널 삭제 시 API 호출
- [ ] (선택) 클라이언트 Supabase + 로그인 UI 또는 “동기화 코드” UI

이 순서대로 하면 현재 폴더/파일/코드 구조를 최대한 유지하면서 Supabase로 채널 동기화를 붙일 수 있습니다.
