---
vhk_format: 1
type: meta
project: focus-feed
version: v0.1
---

# Common Gates

1. `npm run verify:focus-feed`
2. `npm run vhk:policy`

## Forbidden Actions (전역)

- 결제·Stripe·요금제·출시·상업화 작업 (개인용)
- 승인 없는 `vhk sync` / `vhk start` / `vhk init` / `vhk save` / `vhk undo` / deploy·publish
- VHK 통과만으로 제품 완료 선언

## Goal 파일 스키마 (필수 — VHK)

| 필드 | 필수 | 값 |
| --- | --- | --- |
| `type` | ✅ | `goal` |
| `id` | ✅ | 숫자만 (`1`, `2` …) |
| `status` | ✅ | `NOT_STARTED` \| `IN_PROGRESS` \| `DONE` \| `BLOCKED` \| `CANCELED` \| `DEFERRED` \| `OBSERVING` |
| `priority` | 권장 | `P0` \| `P1` \| `P2` |
| `title` | 권장 | 한 줄 제목 |
| `depends_on` | 선택 | 선행 Goal ID 콤마 |

파일명: `goals/<id>-<name>.md`.

## 본문 규약 (사람·에이전트)

VHK CLI/채팅에 뜨는 것: **Goal 제목** (`goal list` / `peek` / `next`).
Phase·Task는 본문. `goal check`는 Task를 검증하지 않는다.

| 층 | 형식 | 예 |
|----|------|-----|
| Goal | frontmatter `title` | 쓰기 안정화 (모바일·채널·런타임) |
| Phase | `Phase N` | Phase 1 |
| Task | Goal 안 `Task N` | Task 1, Task 2 |
| 지칭 | `Goal {id} / Task N` 또는 제목 + Task | Goal 1 / Task 1 |

본문:

```md
- [ ] **Task 1** 제목 — 완료조건 / 증거: …
```

오늘 할 일 (`docs/state/next-task.md`):

```
TASK: Goal 1 — 쓰기 안정화
  micro: Task 1 홈 스크롤·드로어
```

티켓은 별층 — `Refs: #N`.  
Refs: https://github.com/byh3071-cpu/youtube-summary/issues/47
