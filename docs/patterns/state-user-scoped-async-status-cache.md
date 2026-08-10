---
패턴명: 사용자별 비동기 상태 캐시의 역행·로그아웃 잔존
카테고리: state
증상: POST 직후 새 상태가 사라지거나 processing이 다시 queued로 보인다. 로그아웃 뒤에도 이전 사용자가 처리한 항목 표시가 화면에 남는다.
원인: 시작 순서와 응답 순서가 다른 GET·POST 결과를 전체 map 교체로 반영하고, 인증 경계가 바뀔 때 client state를 폐기하지 않는다. 오래된 응답과 다른 사용자의 메모리가 같은 상태 저장소를 계속 쓴다.
해결: 항목별 updated_at 또는 요청 generation을 비교해 단조롭게 병합하고, 응답에 없는 새 항목은 보존한다. 로그아웃 성공 시 전체 탐색을 다시 로드하거나 모든 사용자별 cache를 명시적으로 비운다. polling은 active ID만 대상으로 visibility와 backoff를 둔다.
적용조건: 로그인 사용자별 background job·업로드·결제·동기화 상태를 React client state에서 polling하는 애플리케이션.
출처프로젝트: focus-feed (youtube-summary)
태그: [async-race, polling, auth-boundary, cache, monotonic-state, logout]
발견일: 2026-08-01
출처DevLog: docs/devlog/2026-08-01-knowledge-capture-stabilization.md
---

## 확인 기준

- 늦게 도착한 응답이 더 최신 updated_at을 덮지 않는다.
- 일부 응답이 누락돼도 직전에 생성한 항목이 사라지지 않는다.
- 로그아웃 뒤 이전 사용자의 메모리 상태가 보이지 않는다.
- 숨은 탭과 변화 없는 상태에서 polling 간격이 늘어난다.
