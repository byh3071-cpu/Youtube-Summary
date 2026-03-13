# Phase 7 (북마크 & 하이라이트) 완료 로그

> CURSOR_HANDOFF.md Phase 7 기준 구현 후, 안티그래비티 참고용 정리.

**작업 일자**: 2026-03-12

---

## 1. 완료한 작업 요약

| 항목 | 내용 |
|------|------|
| bookmarks 타입 | `supabase-server.ts`에 `user_id` 추가 (Row/Insert) |
| API | `GET/POST/DELETE /api/bookmarks` — 쿠키 세션 기반 유저 식별 |
| 북마크 버튼 | `BookmarkButton.tsx` 추가, `YouTubeCard`에 노출 (라디오 추가 버튼 옆) |
| 북마크 목록 페이지 | `src/app/bookmarks/page.tsx` — 비로그인 시 안내, 로그인 시 목록 + 삭제 |
| 사이드바/모바일 | "내 콘텐츠"에 **내 플레이리스트**, **북마크** 링크 추가 |

---

## 2. 변경·추가된 파일

| 파일 | 변경 유형 |
|------|------------|
| `src/lib/supabase-server.ts` | 수정 — bookmarks에 `user_id` 추가 |
| `src/lib/supabase-server-cookies.ts` | 수정 — `getBookmarksFromDb`, `BookmarkRow` 타입 추가 |
| `src/app/api/bookmarks/route.ts` | **신규** — GET/POST/DELETE |
| `src/components/feed/BookmarkButton.tsx` | **신규** |
| `src/components/feed/FeedClientContainer.tsx` | 수정 — `bookmarks` state, `fetchBookmarks`, `BookmarkEntry` |
| `src/components/feed/FeedList.tsx` | 수정 — `bookmarks`, `onBookmarkChange` → YouTubeCard |
| `src/components/feed/YouTubeCard.tsx` | 수정 — `bookmark`, `onBookmarkChange`, `BookmarkButton` |
| `src/app/bookmarks/page.tsx` | **신규** |
| `src/app/bookmarks/BookmarksClient.tsx` | **신규** |
| `src/components/layout/Sidebar.tsx` | 수정 — 내 콘텐츠(플레이리스트, 북마크) 링크 |
| `src/components/layout/MobileNavDrawer.tsx` | 수정 — 동일 링크 |
| `docs/SUPABASE_BOOKMARKS_TABLE.md` | **신규** — bookmarks 테이블 DDL |
| `src/components/ui/AuthErrorBanner.tsx` | 수정 — lint(setState in effect) 해결 |

---

## 3. Supabase에서 할 일

**`docs/SUPABASE_BOOKMARKS_TABLE.md`** 에 있는 DDL을 SQL Editor에서 실행하세요.

- `public.bookmarks` 테이블 생성 (id, user_id, video_id, video_title, highlight, created_at)
- RLS 및 정책 3개 (select/insert/delete own)

테이블이 없으면 북마크 API가 실패하거나 빈 결과만 반환합니다.

---

## 4. 완료 기준 체크 (CURSOR_HANDOFF.md Phase 7)

| 기준 | 상태 |
|------|:----:|
| 피드 카드에서 북마크 추가/제거 가능 | ✅ |
| `/bookmarks` 페이지에서 저장한 북마크 목록 표시 | ✅ |
| 로그인 유저만 북마크 사용 가능 (비로그인 시 안내 메시지) | ✅ (`/bookmarks`에서 안내) |
| `npm run build` 성공 | ✅ |
| `npm run lint` 에러 0건 | ✅ |

---

## 5. 테스트 방법

1. Supabase에서 `docs/SUPABASE_BOOKMARKS_TABLE.md` DDL 실행.
2. 로그인 후 피드에서 유튜브 카드의 **북마크 아이콘** 클릭 → 저장됨(노란색).
3. 다시 클릭 → 북마크 해제.
4. 사이드바 **북마크** 클릭 → 저장한 목록 표시, 삭제 버튼 동작 확인.
5. 비로그인 상태에서 `/bookmarks` 접속 → "로그인하면..." 안내 문구 확인.
