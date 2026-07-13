# 세션 핸드오프 — 2026-07-13 (기능 감사·수정·로드맵·프로덕션 정합)

새 세션이 이 프로젝트의 **현재 상태와 판단 근거**를 빠르게 잡도록 정리한다. 결함 상세는 `docs/FOCUS_FEED_AUDIT_2026-07-12.md` 참조.

## 0. 이 프로젝트가 뭔지 (제일 먼저 읽을 것)

포커스피드(youtube-summary)는 두 겹의 목적이다:
1. **개인 도구(도그푸딩)** — 요한이 실제로 유용해서 쓴다.
2. **상업화 학습 실험대** — 나중에 상업 서비스를 만들 때를 대비해 팀 기능·요금제·결제(Stripe)·랜딩페이지를 미리 구현·실험한다.

**판단 함의**: "혼자 쓰니 팀 기능은 안 쓸 테고 방치 OK"는 **틀린 판단**이다. 학습 목적상 팀·결제·요금제가 실제로 작동해야 실험이 된다 → "안 쓰니 빼자"가 아니라 "굴려보며 배우자".

**⚠️ 상업화 리스크(반드시 기억)**: 자막 수집이 `youtubei.js`(InnerTube = YouTube 비공식 API) 스크래핑이라 **실제 상업화 시 YouTube ToS·저작권 리스크가 크다.** 학습·개인용 단계는 굴려도 되지만, **이대로 상업화 금지** — 그땐 자막 소스를 공식 API로 바꾸거나 콘텐츠를 피벗하는 아키텍처 재설계 + 변호사 자문이 선행돼야 한다.

## 1. 스택·환경

- 배포: **Vercel** (team `byh3071-7593s-projects`, project `youtube-summary`, prj_HHDQatTBNB59ToYYIC3keWWJrtT8). main 머지 시 자동배포.
  - Vercel edge가 `x-forwarded-for`를 덮어써 스푸핑을 막으므로 **IP rate-limit의 XFF 최좌측 추출은 이미 안전**(감사 [2-2]/[3-9]는 이 맥락에서 false-positive).
- DB: **Supabase** (project `olacbbfblhwssbcmradm`, "Focus Feed", ap-northeast-1, pg17).
  - **Supabase MCP는 read-only** — `apply_migration`/DDL write 불가. SELECT(검증)만 된다. **마이그레이션은 사용자가 SQL Editor에서 직접 실행**하고, 나는 read-only로 검증한다.
- 마이그레이션은 `docs/supabase-migrations/*.sql`을 **수동 적용**(자동 CI 없음) → 프로덕션 스키마 드리프트 상시 주의.

## 2. 현재 규모 (2026-07-13 실측)

- **pre-launch.** auth 가입자 1명(owner 본인, 2026-03-12), 최근 7일 신규/로그인 0, 무료 유저 AI 호출 0, 자막 캐시 5건.
- 즉 실사용자 없음 → 스케일 인프라(Upstash·성능 최적화)는 **데이터상 지금 불필요**.
- 참고: **VHK(npm 발행·긱뉴스)와 포커스피드는 다른 제품**이다. VHK 런칭이 포커스피드 웹앱 유저를 만들지 않는다.

## 3. 이 세션에 main에 반영한 것 (감사→수정)

| PR | 결함 | 심각도 |
|---|---|---|
| #24 | Stripe 구독 만료일(무기한 Pro) · 피드 fetch 타임아웃(SSR 블로킹) · 라디오 재생/일시정지 토글(위치 리셋) · CI tsc 게이트 · 감사 리포트 | High~Med |
| #26 | 팀 owner 락아웃(admin이 owner 제거 → 팀 영구 잠김) | High |
| #28 | 무인증 자막 액션 남용(IP rate-limit + 자막 크기 상한) | Med |
| #29 | revalidate 서버 액션 전환(위조 origin 우회 제거, 버튼 정상) | Med |
| #31 | 사용량 한도 fail-open→fail-closed | High |
| #32 | rate-limit XFF 정정(Vercel false-positive, 코드0) | 문서 |
| #33 | 사용량 증가 원자적 RPC(마이그레이션 011, lost update 해결) | High |

모두 워크트리 격리 → 검증(로컬/브라우저/critic 적대검증) → rebase 머지.

## 4. 🔴 프로덕션 스키마 드리프트 (미해결 잔여 주의)

`docs/supabase-migrations`가 수동적용이라 프로덕션에 **여러 마이그레이션이 누락**돼 있었다. 이 세션에 발견·**전부 복구 완료**:

| 객체 | 마이그레이션 | 프로덕션 상태 |
|---|---|---|
| feed_qa_count 컬럼 | 002 | ✅ 이 세션 적용(누락이 fail-closed와 겹쳐 무료 유저 feed_qa 차단하던 회귀 복구) |
| increment_usage RPC | 011 | ✅ 이 세션 적용 |
| teams / team_members / team_invites (+ RLS) | 003·009 | ✅ **이 세션 적용**(팀 기능 프로덕션 미작동이던 것 복구) |
| content_states (+ RLS 4정책) | 008 | ✅ **이 세션 적용**(콘텐츠 dismiss/큐 미작동이던 것 복구) |
| bookmarks.team_id, custom_sources, playlists, video_transcripts, video_digests(+source_mode), hidden_default_sources | 003부분·004·005·006·007·010 | ✅ 적용됨 |

즉 001~011 프로덕션 정합화 완료. read-only로 테이블·RLS·정책 존재 검증함.

**교훈은 남는다**: 마이그레이션이 수동적용이라 언제든 다시 드리프트할 수 있다. 새 마이그레이션(012~) 추가 시 반드시 프로덕션 적용 + `information_schema` 검증까지 하고, "파일 있음 ≠ 프로덕션 적용됨"을 기억하라.

**교훈**: 마이그레이션 참조 코드를 배포하기 전 `information_schema`로 프로덕션 스키마를 실제 확인하라. 파일이 있다고 프로덕션에 적용된 게 아니다.

## 5. 남은 할 일 (학습 관점 우선순위)

| 할 일 | 학습 가치 | 언제 |
|---|---|---|
| ~~프로덕션 스키마 정합화(teams·content_states)~~ | 팀·dismiss 실작동 | ✅ 이 세션 완료 |
| Stripe 결제 플로우(테스트 모드) | 결제·요금제 실전 감각 | 코드는 있음, 굴려볼 가치 |
| TOCTOU 선차감(병렬 창) | check→increment 창 완전 차단 | 호출부 3곳 재설계 — 별도 |
| rate-limit 공유저장소(Upstash 무료티어) | 스케일 | 트래픽 나면(유저·AI호출 수백/일) |
| 프론트 성능 3종(릴뷰 누수·필터 메모·카드 localStorage) | 성능 | 유저 나고 + 다른 세션 UI 리디자인 끝난 뒤 |
| 감사 백로그 Low들(에러 삼킴·캐시 키 등) | — | 급하지 않음 |

## 6. 모니터링 / "언제 움직여라" 트리거

- 유저 감지: Supabase → Authentication(가입자), `usage_daily`(AI 사용), 또는 나에게 "유저 체크" 요청(read-only 쿼리). 방문자까지 보려면 런칭 시 Vercel Analytics(무료 티어) 켜기.
- 트리거: 가입 수십 명+하루 AI 호출 수백 → Upstash / 피드 느리다는 피드백 → 프론트 성능 / Gemini·YouTube 비용 급등 → 비용가드 재점검.

## 7. 이 세션에서 정립한 작업 원칙 (새 세션도 지킬 것)

- **워크트리 격리**: 다른 세션이 main 워킹트리에서 병렬 작업 중 → 최신 `origin/main`에서 워크트리 분기 → 수정 → rebase 머지 → 정리. main 워킹트리 무접촉.
- **검증 후 머지**: 순수 함수는 vitest, 런타임은 브라우저/로컬 DB로 실증, critic 적대검증. 미검증 PR 양산 금지.
- **데이터로 결정**: 인프라 추가는 감이 아니라 실측 규모로. 유저 0에 스케일 인프라 = over-engineering.
- **적대적 재검증이 방향을 여러 번 바꿨다**: revalidate(route 삭제→시크릿-only 유지), 자막(rate-limit만→크기상한 추가), fail-open(클로버 결함 보강). critic/advisor를 실제로 신뢰하고 방향 전환하라.
