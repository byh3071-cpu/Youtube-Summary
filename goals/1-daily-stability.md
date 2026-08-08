---
vhk_format: 1
type: goal
id: 1
title: 쓰기 안정화 (모바일·채널·런타임)
status: IN_PROGRESS
priority: P0
---

# Goal 1: 쓰기 안정화 (모바일·채널·런타임)

매일 쓰는 경로가 안 깨지게. 결제·Stripe·출시 제외.

## Phase

| Phase | 목표 | 상태 |
|------|------|------|
| Phase 1 | 핵심 소비 경로 스모크 | todo |
| Phase 2 | M8 런타임 (결제 제외) | todo |
| Phase 3 | 모바일 QA (Stripe = na) | todo |
| Phase 4 | 게이트·증거 | todo |

## Tasks

### Phase 1
- [ ] **Task 1** 홈 스크롤·드로어 — 세로만, 열림/닫힘/ESC/오버레이 / 증거: `MOBILE_QA` #1·#3 기록
- [ ] **Task 2** 채널 추가·삭제 — 추가→목록, 삭제(+Undo) 한 사이클 / 증거: 기록 또는 e2e 경로
- [ ] **Task 3** 숏폼 — 무음 자동재생·종료 시 다음·검은 화면 없음 / 증거: 캡처 또는 e2e
- [ ] **Task 4** 라디오 미니·큐 — 재생/다음/큐, FAB 과도 겹침 없음 / 증거: 캡처 또는 e2e

### Phase 2
- [ ] **Task 5** 로그인 세션 — OAuth 유지·상세 복귀 URL / 증거: Preview·로컬 메모
- [ ] **Task 6** 인박스 선별 — `005`/`008` 후 처리대기·제외·필터 / 증거: `MOBILE_QA` #19
- [ ] **Task 7** 보안 헤더·proxy — 결제 경로 제외 스모크 / 증거: curl·devtools 스니펫

### Phase 3
- [ ] **Task 8** MOBILE_QA 공통 #1–5 / 증거: 체크리스트 기록 표
- [ ] **Task 9** iOS·Android 핵심 #6–12 (#13 Stripe = na) / 증거: 동일 표
- [ ] **Task 10** M8 회귀 #14–19 / 증거: 동일 표

### Phase 4
- [ ] **Task 11** 게이트 — `npm run vhk -- goal check --id 1` 통과 / 증거: 터미널 로그

## Goal DONE

- Phase 1–4 Task 전부 `[x]` 또는 `(na)`
- `npm run vhk -- goal check --id 1`
- `npm run verify:focus-feed` + `npm run vhk:policy`
