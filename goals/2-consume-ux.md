---
vhk_format: 1
type: goal
id: 2
title: 소비 UX 잔여
status: NOT_STARTED
priority: P1
depends_on: 1
---

# Goal 2: 소비 UX 잔여

내 피드로 쓸 만하게. Goal 1 DONE 후.

## Phase

| Phase | 목표 | 상태 |
|------|------|------|
| Phase 1 | 온보딩·배너 | todo |
| Phase 2 | 트렌드 필터 | todo |
| Phase 3 | 큐레이션 방향 | todo |
| Phase 4 | 게이트 | todo |

## Tasks

### Phase 1
- [ ] **Task 1** WelcomeBanner 고아 — 삭제 또는 온보딩 재배치, 죽은 import 없음 / 증거: 커밋 + 홈 캡처

### Phase 2
- [ ] **Task 2** 트렌드 2토큰 매칭 — 빈결과 회피 + 과매칭 완화, 키워드 3개 확인 / 증거: 본 Goal 또는 learnings 결과표

### Phase 3
- [ ] **Task 3** recommendations.ts 살림/폐기 문서화 / 증거: docs 또는 본 Goal 경로
- [ ] **Task 4** AI 랭킹 프롬프트 1차 (폐기면 na) / 증거: diff 또는 na 사유

### Phase 4
- [ ] **Task 5** 게이트 — `npm run vhk -- goal check --id 2` / 증거: 터미널 로그

## Goal DONE

- Phase 1–4 Task 전부 `[x]` 또는 `(na)`
- `npm run vhk -- goal check --id 2`
- `npm run verify:focus-feed` + `npm run vhk:policy`
