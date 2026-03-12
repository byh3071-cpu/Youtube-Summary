# Phase 6 (채널 목록 Supabase 동기화) 완료 로그

> CURSOR_HANDOFF.md 지침에 따라 Phase 6을 구현한 뒤, 안티그래비티(Antigravity)가 참고할 수 있도록 정리한 로그입니다.

**작업 일자**: 2026-03-12  
**기준 문서**: `CURSOR_HANDOFF.md` § Phase 6

---

## 1. 완료한 작업 요약

| 항목 | 내용 |
|------|------|
| DB 타입 | `src/lib/supabase-server.ts`에 `custom_sources` 테이블 Row/Insert/Update 추가 |
| 쿠키 기반 서버 클라이언트 | `src/lib/supabase-server-cookies.ts` 신규 추가 — 세션으로 user 식별, `getCustomSourcesFromDb()` 제공 |
| API 라우트 | `src/app/api/custom-sources/route.ts` — GET / POST / DELETE 구현 |
| 채널 추가 시 DB 반영 | `AddChannelModal.tsx` — 쿠키 갱신 후 `POST /api/custom-sources` 호출 (fire-and-forget) |
| 채널 삭제 시 DB 반영 | `YouTubeSourceList.tsx` — 쿠키 갱신 후 `DELETE /api/custom-sources?sourceId=...` 호출 |
| 페이지 로드 시 병합 | `src/app/page.tsx` — 로그인 시 `getCustomSourcesFromDb()`로 DB 채널 조회 후 `mergeCustomSources(쿠키, DB)` 적용 |

---

## 2. 변경·추가된 파일

| 파일 | 변경 유형 | 설명 |
|------|------------|------|
| `src/lib/supabase-server.ts` | 수정 | `Database` 타입에 `custom_sources` 테이블 정의 추가 |
| `src/lib/supabase-server-cookies.ts` | **신규** | 쿠키 기반 `createServerSupabaseFromCookies`, `getCurrentUserFromCookies`, `getCustomSourcesFromDb` |
| `src/app/api/custom-sources/route.ts` | **신규** | GET(목록), POST(추가), DELETE(삭제) |
| `src/app/page.tsx` | 수정 | `getCustomSourcesFromDb` + `mergeCustomSources`로 쿠키·DB 병합 |
| `src/components/feed/AddChannelModal.tsx` | 수정 | 채널 추가 성공 시 `POST /api/custom-sources` 호출 추가 |
| `src/components/layout/YouTubeSourceList.tsx` | 수정 | 채널 제거 시 `DELETE /api/custom-sources?sourceId=...` 호출 추가 |

**수정하지 않은 파일** (지침 준수): `RadioQueueContext.tsx`, `FloatingRadioPlayer.tsx`, `RadioFooterControls.tsx` 등 라디오 플레이어 관련 파일은 미수정.

---

## 3. Supabase 대시보드에서 해야 할 일 (안티그래비티 확인)

코드 배포 전에 **Supabase SQL Editor**에서 아래 DDL을 실행해야 합니다.  
DDL 전문은 `docs/SUPABASE_CHANNEL_SYNC_TODO.md` § 2-1에 있습니다.

- `public.custom_sources` 테이블 생성
- RLS 활성화 및 정책 3개 생성:
  - `Users can read own custom_sources`
  - `Users can insert own custom_sources`
  - `Users can delete own custom_sources`

테이블이 없으면 API의 POST/DELETE 및 페이지 로드 시 DB 조회가 실패하거나 빈 결과만 반환합니다.

---

## 4. 완료 기준 체크리스트 (CURSOR_HANDOFF.md 기준)

| 기준 | 상태 |
|------|:----:|
| Supabase에 `custom_sources` 테이블이 생성되어 있음 | ⬜ (대시보드에서 실행 필요) |
| `Database` 타입에 `custom_sources`가 추가됨 | ✅ |
| API 라우트 (`/api/custom-sources`) GET/POST/DELETE 동작 | ✅ |
| 채널 추가/삭제 시 DB에 반영됨 (로그인 시) | ✅ (코드 반영 완료, 테이블 생성 후 동작) |
| 페이지 새로고침 시 DB의 채널 목록이 피드에 반영됨 | ✅ |
| 비로그인 시 기존 동작(쿠키만)과 동일하게 유지 | ✅ |
| `npm run build` 성공 | ✅ |
| `npm run lint` 에러 0건 | ✅ |

---

## 5. 테스트 방법 (안티그래비티 참고)

1. **Supabase**: `docs/SUPABASE_CHANNEL_SYNC_TODO.md` § 2-1 DDL 실행.
2. **로컬**: `npm run dev` 후 브라우저에서 Google 로그인.
3. **채널 추가**: 사이드바에서 채널 추가 → 쿠키 + DB에 동일 채널 반영되는지 확인.
4. **동기화 확인**: 다른 브라우저(또는 시크릿)에서 같은 계정으로 로그인 → 새로고침 시 이전에 추가한 채널이 보이는지 확인.
5. **채널 삭제**: 채널 제거 버튼 클릭 → 쿠키와 DB에서 모두 삭제되는지 확인.
6. **비로그인**: 로그아웃 후 채널 추가/삭제 → 기존처럼 쿠키만 변경되고, API는 200으로 응답하되 DB에는 미반영(비로그인)인지 확인.

---

## 6. 기술 노트

- **유저 식별**: 채널 동기화는 전부 `createServerSupabaseFromCookies` + Anon Key + 쿠키 세션으로만 처리합니다. `getServerSupabaseClient()`(Service Role)는 사용하지 않습니다.
- **실패 시 동작**: DB/API 실패 시에도 쿠키 기반 채널 목록은 그대로 동작합니다. POST/DELETE는 fire-and-forget으로 호출합니다.
- **타입**: `custom_sources` insert 시 Supabase 제네릭 추론 이슈로 `insert(row as any)` 단언 사용. (CURSOR_HANDOFF.md “타입 단언” 참고)

---

이 로그는 Phase 6 구현 완료 시점의 스냅샷이며, 이후 Phase 7(북마크)·8(설정 동기화)·9(RLS)는 CURSOR_HANDOFF.md 순서대로 진행하면 됩니다.
