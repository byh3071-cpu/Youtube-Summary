---
vhk_format: 1
type: goal
id: 3
title: 브레인 파이프 신뢰성
status: NOT_STARTED
priority: P1
depends_on: 2
---

# Goal 3: 브레인 파이프 신뢰성

영상→요약→지식 적재(경로 A). Goal 2 DONE 후. 경로 B·Notion 양방향 제품화 제외.

## Phase

| Phase | 목표 | 상태 |
|------|------|------|
| Phase 1 | Innertube 캐시 | todo |
| Phase 2 | 적재 도그푸딩 | todo |
| Phase 3 | 문서 정합 | todo |
| Phase 4 | 게이트 | todo |

## Tasks

### Phase 1
- [ ] **Task 1** Innertube 실패 시 영구캐시 초기화([3-4]) — 재시작 없이 재시도 / 증거: 재현+diff 또는 테스트

### Phase 2
- [ ] **Task 2** 리뷰게이트 1사이클 — reviewed 1건→요약·트리플/인물/개념 / 증거: 영상 ID + 브레인·로그 경로
- [ ] **Task 3** sync 실패 가시성 — UI 또는 서버 로그에 원인 / 증거: 스니펫·캡처

### Phase 3
- [ ] **Task 4** 경로 A 정본·경로 B 미채택 명시 / 증거: `YOHAN_BRAIN_*`·HANDOFF diff

### Phase 4
- [ ] **Task 5** 게이트 — `npm run vhk -- goal check --id 3` / 증거: 터미널 로그

## Goal DONE

- Phase 1–4 Task 전부 `[x]` 또는 `(na)`
- `npm run vhk -- goal check --id 3`
- `npm run verify:focus-feed` + `npm run vhk:policy`
