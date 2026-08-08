---
vhk_format: 1
type: goal
id: 5
title: 성능 (트리거 시만)
status: DEFERRED
priority: P2
depends_on: 4
---

# Goal 5: 성능 (트리거 시만)

트리거 전 `DEFERRED`. 착수 후에만 Task 체크 연다.

**트리거:** 피드 느림 / 라디오·릴뷰 버벅임 / 병합 지연 반복

## Phase (착수 전 전부 na)

| Phase | 목표 | 상태 |
|------|------|------|
| Phase 1 | 트리거 기록 | na |
| Phase 2 | 병목 측정 | na |
| Phase 3 | 해소·회귀 | na |
| Phase 4 | 게이트 | na |

## Tasks

### Phase 1
- [ ] **Task 1** `(na)` 트리거 기록 — symptom / device / repro → blockers 또는 본 Goal

### Phase 2
- [ ] **Task 2** `(na)` 병목 1개 — metric 이름 + before ms

### Phase 3
- [ ] **Task 3** `(na)` 해소 — 가상 스크롤·페이지네이션 등 / 증거: diff
- [ ] **Task 4** `(na)` 회귀 — after ms + 기능 회귀 없음 / 증거: before·after 표

### Phase 4
- [ ] **Task 5** `(na)` 게이트 — `npm run vhk -- goal check --id 5`

## Goal DONE

- 트리거 없이 DONE 금지
- 착수 후 Task 전부 `[x]` + 게이트 + `verify:focus-feed` + `vhk:policy`
