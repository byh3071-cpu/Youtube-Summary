---
id: focus-feed-devlog-2026-08-01-knowledge-capture-stabilization
date: 2026-08-01
project: youtube-summary (Focus Feed)
tags: [devlog, knowledge-capture, supabase, rls, status, test]
---

# Dev Log — 지식 캡처 P0 안정화

## 한 줄

운영 DB와 인증 설정은 바꾸지 않고, Focus Feed의 지식 접수·상태 조회를 로그인 사용자 경계와 비용 한도 안에서 동작하도록 코드와 테스트를 보강했다.

## 변경

- 캡처 API의 service-role 테이블 접근을 제거했다. 쿠키 세션 enqueue RPC가 auth.uid·중복·active 10건·일 50건을 원자 검증하며, authenticated의 table 직접 write는 모두 닫는다.
- API에는 사용자별 10회/분 완화 한도를 enqueue RPC보다 앞에 두어 burst 요청이 DB를 계속 읽지 않게 했다.
- enqueue는 `capture_ready=false` 예약만 만든다. 제한된 enrich RPC가 메타 보강과 준비 완료를 원자 처리하고, worker는 준비된 행만 claim한다. 준비가 끝난 중복·quota 초과 요청은 외부 메타 비용을 만들지 않으며, 중간에 끊긴 예약만 같은 행에서 보강을 재개한다.
- 로그인 사용자의 YouTube 작업을 요청당 최대 50개 조회하는 `/api/knowledge/status`를 추가했다.
- 피드는 영상 ID를 50개씩 순차 조회하고 `queued`, `processing`, `review_required`, `completed`, `action_required`, `failed`, `cancelled`를 카드와 롱폼 상세에 표시한다. active ID만 15→120초 backoff로 읽고, 숨은 탭은 늦추며 창 복귀 시 전체 상태를 갱신한다.
- 늦은 GET·POST 응답은 updated_at 기준으로 병합해 더 최신 worker 상태를 덮지 않는다. 공유 확인 화면도 active 작업을 짧게 polling한다. 로그아웃 성공 뒤에는 전체 탐색을 다시 로드해 사용자별 클라이언트 상태를 제거한다.
- 단일 PWA share target은 `/capture`로 유지하되, 같은 화면에서 기존 채널 추가 흐름으로 갈 수 있는 보조 진입점을 보존했다.
- worker claim은 세 번의 lease 만료 뒤 action_required로 격리하고, 현재 lease token으로만 NotebookLM checkpoint·lease 연장·완료가 가능하도록 SQL 계약을 강화했다.
- 인증 401, URL 400, migration·PostgREST schema-cache 503, API/DB quota 429, 중복 멱등, 사용자 격리, 50개 제한, 상태 병합, worker lease SQL 계약을 자동 테스트로 고정했다.

## 검증

- 지식 캡처 관련 단위·API·SQL 계약 테스트 40개 통과.
- 전체 단위 테스트 225개 통과.
- TypeScript 검사와 Next.js 프로덕션 빌드 통과.
- PWA manifest의 share target `/capture`·GET·파라미터 계약을 Playwright 1건으로 검증.
- 전체 ESLint 오류 0. 이번 변경과 무관한 기존 테스트 파일 경고 1개는 기준선으로 분리했다.
- 시크릿 검사와 VHK incident policy 통과.

## 교훈

- RLS가 정의돼 있어도 앱 코드가 service-role 클라이언트를 사용하면 사용자 경계를 우회한다. 사용자 시작 요청은 쿠키 세션 클라이언트를 사용하고, worker RPC만 service-role로 분리해야 한다.
- RLS의 행 소유권만으로는 비용 유발 enqueue 남용을 막지 못한다. 직접 write를 닫고 auth.uid·멱등·quota를 한 트랜잭션에서 검사하는 좁은 RPC가 필요하다.
- 카드마다 상태 API를 호출하지 말고 상위 피드에서 제한 크기로 묶어 조회해야 한다. polling은 전체 피드가 아니라 active ID만 대상으로 하고 visibility·backoff를 둔다.
- 사용자별 비동기 캐시는 updated_at이 역행하지 않게 병합하고, 로그아웃 성공 시 전체 client state를 폐기해야 한다.
- enqueue 뒤 외부 메타 보강이 있다면 queued 하나로 접수·준비 완료를 함께 표현하지 않는다. 별도 readiness gate로 worker 선점을 막고, 끊긴 예약은 멱등 재요청으로 복구한다.
- 외부 쓰기 성공 뒤 DB checkpoint 전에 죽는 구간은 lease만으로 exactly-once가 되지 않는다. worker 재시도는 canonical URL·hash로 NotebookLM 기존 source를 먼저 대조해야 한다.
- Supabase 수동 Database 타입에 `Relationships`, `Views`, `Functions`가 빠지면 최신 클라이언트의 mutation 입력이 `never`가 된다. 임시 캐스트 대신 GenericSchema 계약을 완성해야 RLS 클라이언트의 insert 타입도 유지된다.

## 남은 사람 게이트

1. migration 012 운영 적용.
2. 실제 계정으로 RLS·중복·상태 표시 canary 1건.
3. NotebookLM worker가 checkpoint RPC로 lease를 연장하고 source를 사전 대조하도록 연결한 뒤, review 승인·action 재시도·취소 전이를 검증.
4. iPhone 공유 시트·PWA 업데이트 실기기 확인.
