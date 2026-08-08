---
vhk_format: 1
type: goal
id: 4
title: 최소 관측 (에러 추적)
status: NOT_STARTED
priority: P1
depends_on: 3
---

# Goal 4: 최소 관측 (에러 추적)

깨지면 바로 알게. 결제 알림·퍼널·A/B 제외. Goal 3 DONE 후.

## Phase

| Phase | 목표 | 상태 |
|------|------|------|
| Phase 1 | 도구 연결 | todo |
| Phase 2 | 핵심 경로 포착 | todo |
| Phase 3 | 게이트 | todo |

## Tasks

### Phase 1
- [ ] **Task 1** 에러 추적 도구 1개 선정 (Sentry 등), `.env.example`만 문서화 / 증거: Goal 메모 한 단락
- [ ] **Task 2** 서버·클라 SDK — 테스트 에러 1건 대시보드 도착 / 증거: 스크린

### Phase 2
- [ ] **Task 3** AI·요약 실패 이벤트 / 증거: 이벤트 ID
- [ ] **Task 4** 브레인 sync 실패 이벤트 / 증거: 이벤트 ID

### Phase 3
- [ ] **Task 5** 게이트 — `npm run vhk -- goal check --id 4` / 증거: 터미널 로그

## Goal DONE

- Phase 1–3 Task 전부 `[x]` 또는 `(na)`
- `npm run vhk -- goal check --id 4`
- `npm run verify:focus-feed` + `npm run vhk:policy`
