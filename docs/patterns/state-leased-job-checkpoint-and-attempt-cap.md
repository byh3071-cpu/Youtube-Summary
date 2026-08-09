---
패턴명: 외부 부작용 worker의 lease만 있고 checkpoint·시도 상한이 없음
카테고리: state
증상: worker crash 뒤 같은 작업이 무한 재선점되고 외부 API 비용이 반복된다. 긴 작업의 lease가 끝나면 이전 worker와 새 worker가 겹치거나 오래된 checkpoint가 남는다.
원인: claim 시 lease token만 만들고 heartbeat/checkpoint 경로, 만료 검증, 최대 attempt 전이가 없다. 외부 부작용 식별자도 일반 service-role update로 저장해 lease 계약과 분리된다.
해결: 현재 id·status·lease token·미만료 시각을 모두 만족할 때만 checkpoint와 lease 연장을 한 RPC에서 수행한다. complete도 미만료 token을 요구한다. 반복 만료가 상한에 닿으면 action_required 같은 격리 상태로 원자 전이한다. 외부 source ID와 hash를 checkpoint하고, 외부 성공과 DB checkpoint 사이 crash window에 대비해 재시도 전에 canonical URL·hash로 외부 상태를 먼저 대조한다.
적용조건: NotebookLM·결제·메일·파일 변환처럼 외부 부작용이 있는 DB queue worker와 FOR UPDATE SKIP LOCKED lease 패턴.
출처프로젝트: focus-feed (youtube-summary)
태그: [worker, lease, heartbeat, checkpoint, poison-job, idempotency, retry]
발견일: 2026-08-01
출처DevLog: docs/devlog/2026-08-01-knowledge-capture-stabilization.md
---

## 확인 기준

- claim 수와 작업별 attempt 수를 별도로 제한한다.
- checkpoint·heartbeat·complete가 같은 현재 lease token을 검증한다.
- 만료 token은 상태를 갱신할 수 없다.
- attempt 상한 뒤 자동 재선점하지 않고 사람이 볼 상태로 격리한다.
- 외부 쓰기 직후 DB checkpoint 전에 죽어도, 재시도가 기존 외부 결과를 찾아 재사용한다.
