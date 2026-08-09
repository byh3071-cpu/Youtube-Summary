---
패턴명: 비동기 큐가 입력 보강 전에 소비되는 경쟁 조건
카테고리: state
증상: API가 큐 행을 만든 뒤 외부 메타데이터를 보강하는 사이 worker가 행을 선점해, 임시 제목·빈 설명처럼 불완전한 입력으로 작업을 끝낸다.
원인: 생산자의 접수 완료와 소비 가능한 준비 완료를 같은 queued 상태 하나로 표현한다. enqueue 커밋 즉시 worker 조건을 만족한다.
해결: 행에 별도 준비 완료 표식을 두고 enqueue는 false로 예약만 만든다. 보강 RPC가 허용된 열을 갱신하면서 true로 원자 전이하고, worker claim은 true인 행만 선택한다. 중단된 예약은 같은 멱등 키의 재요청이 이어서 보강할 수 있어야 하며, 늦은 POST·poll 응답은 updated_at으로 병합한다.
적용조건: 큐 생성 뒤 파일 업로드·메타 조회·검증·정규화 같은 준비 단계가 있고 worker가 별도 프로세스에서 즉시 소비하는 시스템.
출처프로젝트: focus-feed (youtube-summary)
태그: [queue, race-condition, readiness, two-phase, idempotency, async-state]
발견일: 2026-08-01
출처DevLog: docs/devlog/2026-08-01-knowledge-capture-stabilization.md
---

## 확인 기준

- 예약 생성 직후 worker claim 쿼리에 잡히지 않는다.
- 준비 완료 전 요청이 끊겨도 같은 키로 재시도할 수 있다.
- 준비 완료 전이와 worker claim이 DB 조건으로 직렬화된다.
- 늦은 API 응답이 더 최신 worker 상태를 되돌리지 않는다.
