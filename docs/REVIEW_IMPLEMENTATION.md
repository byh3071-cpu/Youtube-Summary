# 구현·검토 요약

구현된 기능과 검토 시 발견·수정 사항, 선택적 후속 작업을 정리했습니다.

---

## 1. 구현된 기능 체크리스트

| 영역 | 항목 | 상태 | 비고 |
|------|------|------|------|
| **Stripe** | Checkout Session (Pro 구독) | ✅ | POST `/api/stripe/checkout-session`, client_reference_id=user.id |
| | Webhook (구독 완료/갱신/해지) | ✅ | user_plan upsert/update |
| | .env (STRIPE_*, NEXT_PUBLIC_SITE_URL) | ✅ | .env.example 반영 |
| **결제 페이지** | /pricing | ✅ | Free/Pro 카드, Pro 구독 시 Stripe 이동, success/canceled 처리 |
| **로그인** | /login | ✅ | Google 로그인, next 리다이렉트 |
| **랜딩** | /landing | ✅ | 히어로, CTA, 혜택 카드, 푸터 |
| **팀** | 팀 생성/목록 GET·POST | ✅ | /api/teams |
| | 팀 설정(이름·목표) PATCH | ✅ | /api/teams/[teamId], 소유자/관리자만 |
| | 팀 설정 페이지 | ✅ | /teams/[teamId]/settings |
| | 팀 초대 POST | ✅ | /api/teams/[teamId]/invite, 초대 링크 반환 |
| | 팀 초대 UI | ✅ | 설정 페이지에서 이메일 입력, 링크 생성·복사 |
| | 팀 가입 | ✅ | /teams/join?token=, team_members 추가 후 invite 삭제 |
| | 팀 브리핑 | ✅ | /teams/[teamId]/briefing, goal_text 기반 rankFeedByGoals |
| **팀 북마크** | GET /api/bookmarks?team_id= | ✅ | 팀 멤버 검증 후 팀 전체 북마크 조회(서버 클라이언트 사용) |
| | POST body team_id | ✅ | 팀 멤버일 때만 팀 북마크로 저장 |
| | /teams/[teamId]/bookmarks | ✅ | 팀 북마크 목록·추가·삭제(본인 추가분만 삭제) |
| **팀 결제** | 팀 플랜 스케치 | ✅ | 설정 페이지에 "준비 중" 문구 + /pricing 링크 |
| **타입/리팩터** | types/teams | ✅ | TeamRow, TeamMemberSummary, TeamInviteRow, TeamWithRole, canManageTeam |
| | API·페이지 타입 통일 | ✅ | 팀 관련 API·페이지에서 위 타입 사용 |

---

## 2. 검토 중 발견·수정 사항

### 2.1 팀 북마크 조회와 RLS

- **문제**: `bookmarks` RLS가 `auth.uid() = user_id`만 허용해서, anon(쿠키 세션) 클라이언트로는 **본인이 추가한 팀 북마크만** 보이고, 다른 팀원이 추가한 건 안 보임.
- **조치**: 팀 북마크 조회 시 **멤버 검증은 기존대로** 하고, 실제 북마크 목록 조회만 **getServerSupabaseClient()(service role)** 로 수행하도록 수정함.  
  → 팀 멤버라면 팀 전체 북마크를 볼 수 있음.

### 2.2 팀 가입 페이지 searchParams

- **문제**: `searchParams`가 `Promise`일 때와 `undefined`일 때 타입/처리가 애매할 수 있음.
- **조치**: `const params = searchParams != null ? await searchParams : {}`, `token`은 `typeof params.token === "string"`일 때만 사용하도록 명시적으로 처리.

### 2.3 그 외 확인된 사항

- **초대 API**: `inviteLink` camelCase로 반환, 클라이언트 `data.inviteLink`와 일치 ✅
- **개인 북마크**: `getBookmarksFromDb`에 `.is("team_id", null)` 적용되어 개인/팀 분리 ✅
- **DELETE /api/bookmarks**: `user_id`로만 삭제 가능 → 팀 북마크도 **추가한 사람만** 삭제 가능 ✅

---

## 3. DB·마이그레이션 정합성

- **001**: user_plan, usage_daily, playlists.user_id — 코드와 일치.
- **002**: user_plan.stripe_subscription_id — 웹훅·타입과 일치.
- **003**: teams, team_members, team_invites, bookmarks.team_id — 팀·초대·팀 북마크와 일치.

`teams`/`team_members`/`team_invites`는 RLS가 없고, 앱에서는 **서버(service role) 전용**으로만 접근하므로 현재 구조로 일관됨.

---

## 4. 선택적 후속 작업

- **팀 결제**: 팀 플랜 상품·팀 단위 구독·팀 plan 업그레이드 플로우 (현재는 스케치만 반영).
- **북마크 RLS 확장(선택)**: 팀 북마크를 anon으로도 읽게 하려면, 팀 멤버 SELECT 정책을 추가할 수 있음.  
  현재는 팀 북마크 GET을 service role로 처리해 두어 RLS 변경 없이 동작함.
- **팀 초대**: 동일 이메일 중복 초대 시 여러 행 생성 — 의도된 동작(토큰별 만료). 필요 시 “이미 초대된 이메일” 안내만 추가 가능.

---

## 5. 테스트 권장 시나리오

1. **결제**: 로그인 → /pricing → Pro 구독 → Stripe 결제 → /pricing?success=1 → 웹훅으로 user_plan pro 반영.
2. **팀**: 팀 생성 → 설정에서 목표 저장 → 초대 링크 생성·복사 → 시크릿/다른 계정으로 join → 팀 브리핑/팀 북마크 확인.
3. **팀 북마크**: 팀원 A가 팀 북마크 추가 → 팀원 B가 /teams/[id]/bookmarks에서 목록에 A 추가 분 노출 확인.
4. **개인 북마크**: /bookmarks에서는 팀 북마크 제외, 개인만 노출되는지 확인.

이 문서는 구현 재검토 시점의 스냅샷이며, 위 항목들은 이후에도 참고용으로 유지할 수 있습니다.
