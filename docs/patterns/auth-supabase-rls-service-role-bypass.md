---
패턴명: Supabase RLS 사용자 경로의 service-role 우회
카테고리: auth
증상: 테이블에 RLS와 사용자별 policy가 있어도 앱 API가 다른 사용자의 행까지 읽거나 쓸 수 있는 권한을 가진다. 테스트 환경에서는 user_id 필터만 있어 안전해 보일 수 있다.
원인: 사용자 요청을 처리하는 서버 API가 쿠키 세션의 anon 클라이언트 대신 service-role 키로 만든 관리 클라이언트를 사용한다. service-role은 RLS를 우회하므로 policy가 실제 보안 경계로 작동하지 않는다.
해결: 사용자 시작 요청의 읽기는 요청 쿠키로 만든 Supabase 서버 클라이언트를 사용해 RLS를 통과시키고, 쿼리에도 현재 user_id를 명시한다. 비용을 유발하는 쓰기는 행 소유권만으로 부족하므로 table 직접 write를 닫고, 쿠키 세션으로 호출하는 좁은 enqueue RPC가 auth.uid·멱등·quota를 한 트랜잭션에서 검증하게 한다. service-role은 worker 전용 RPC처럼 관리 권한이 꼭 필요한 경로에만 두고 역할 검사·lease·호출 제한을 함께 둔다.
적용조건: Supabase RLS 테이블을 Next.js Route Handler·Server Action·백엔드 API에서 사용자 요청으로 읽거나 쓰는 모든 프로젝트.
출처프로젝트: focus-feed (youtube-summary)
태그: [supabase, rls, service-role, cookie-session, least-privilege, user-isolation]
발견일: 2026-08-01
출처DevLog: docs/devlog/2026-08-01-knowledge-capture-stabilization.md
---

## 확인 기준

- 사용자 API는 요청 쿠키 세션 클라이언트를 생성한다.
- 데이터 쿼리는 현재 사용자 ID를 명시한다.
- 비용 유발 write는 direct REST 우회까지 막는 원자 quota 경계를 가진다.
- 멱등·quota를 외부 API 호출보다 먼저 확정해 중복·초과 요청의 외부 비용도 막는다.
- service-role 코드는 worker·관리 RPC 경계 밖에서 호출되지 않는다.
- RLS policy 존재 여부와 별개로 실제 호출 클라이언트의 권한을 테스트한다.
