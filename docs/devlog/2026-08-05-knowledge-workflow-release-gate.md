---
id: focus-feed-knowledge-workflow-release-gate-2026-08-05
date: 2026-08-05
tags: [focus-feed, knowledge, supabase, notebooklm, release-gate]
---

## 2026-08-07 운영 DB 확정 결과

Vercel production의 현재 `sb_secret_` 서버 키로 REST 검증하고, Supabase SQL
Editor에서 읽기 전용 preflight를 실행했다. 확인된 상태는 다음과 같다.

- `knowledge_jobs`는 존재하고 3건(`queued` 2, `action_required` 1)을 보존해야 한다.
- `knowledge_process_requests`는 없으며 P1 `013`은 아직 적용하지 않는다.
- 승인 컬럼 3개와 `approving` 상태가 없다.
- worker queue 인덱스에 선두 `user_id`가 없다.
- `enqueue`와 `enrich`만 최신 exact signature다.
- `claim`/`checkpoint`/`complete`는 owner UUID가 없는 legacy overload만 존재한다.
- approval RPC 2개는 없다.
- 기존 RPC는 `anon`, `authenticated`, `service_role` 모두 EXECUTE 가능하다.
- RLS는 켜져 있고 `select_own`, `insert_own` 정책은 존재한다.

따라서 `012_knowledge_jobs.sql` 전체 재실행은 금지한다. 기존 테이블 때문에 첫
`CREATE TABLE`에서 전체 rollback되고, 함수 인자가 다른 legacy overload도
`CREATE OR REPLACE`로 제거되지 않는다.

사람 승인 후 운영에는 `014_knowledge_jobs_legacy_upgrade.sql`만 먼저 적용한다.
이 SQL은 기존 row를 삭제하지 않고 승인 컬럼·상태·인덱스를 보완하고, 사용자 범위
worker/approval RPC를 만든 뒤 legacy overload 3개를 `CASCADE` 없이 제거한다.
적용 직후 `knowledge_workflow_preflight.sql`과
`npm run verify:supabase:knowledge`를 재실행한다. 성공 기준은 P0 exact signature가
모두 존재하고, legacy overload가 0행이며, user RPC는 authenticated 전용,
worker/approval RPC는 service_role 전용인 것이다.

`014`는 `lock_timeout=5s`, `statement_timeout=60s`로 실행한다. timeout이나
dependency 오류가 나면 transaction 전체가 rollback되므로 즉시 반복 실행하지 말고
활성 worker를 확인한 뒤 preflight부터 다시 수행한다. 성공 후 같은 SQL을 다시 실행해도
legacy 함수 제거 단계는 `IF EXISTS`로 통과하지만, 정상 운영에서는 postflight 증적을
남기고 한 번만 적용한다.

## 2026-08-07 `014` 적용 및 postflight

사용자 승인 후 Focus Feed production 프로젝트
`olacbbfblhwssbcmradm`에 SHA-256
`E45E013FA59CEDE14C7271E8D89463D5DD0CCD7E21AAAC47FC703D1C1E8D0C4E`인
`014_knowledge_jobs_legacy_upgrade.sql`을 한 번 적용했다. SQL Editor는
`Success. No rows returned`를 반환했다.

SQL postflight 결과:

- 기존 row 3건 보존: `queued` 2, `action_required` 1
- 승인 컬럼 3개와 `approving` 상태 정상
- user-scoped worker/approval RPC 5개 정상
- owner UUID가 없는 legacy worker overload 0개
- user RPC는 authenticated 전용, worker/approval RPC는 service_role 전용
- RLS, `select_own`/`insert_own`, authenticated SELECT-only table grant 정상
- worker queue 인덱스의 선두 `user_id` 정상
- `knowledge_process_requests`는 계속 부재하며 P1 `013` 미적용

Vercel production 환경의 `npm run verify:supabase:knowledge`도 `ok: true`,
`serviceContractVerified: true`, `openApiContractVerified: true`를 반환했다.
따라서 다음 게이트는 새 작업을 추가하지 않고 기존 `queued` 1건으로 시작하는
`knowledge process --limit 1` canary다.

## 2026-08-09 통합 기준

운영 이력은 legacy 설치에 `014_knowledge_jobs_legacy_upgrade.sql`을 적용한 뒤 `015_knowledge_job_retry.sql`을 적용한 순서다. `012_knowledge_jobs.sql`은 새 설치용 기준선으로만 유지하고, P1 `013_knowledge_process_requests.sql`은 현재 저장소·운영 이력에 없다. `016_knowledge_job_approval_cas_hardening.sql`과 과거 014의 authenticated 원본 SELECT를 닫는 `017_knowledge_jobs_browser_read_hardening.sql`은 준비만 되었고 아직 적용하지 않았다. 이 항목은 과거 적용 이력의 정리이며 현재 live DB 재검증을 주장하지 않는다.

# 지식 워크플로우 운영 전환 게이트

## 현재 판정

코드·NotebookLM 로그인·운영 P0 DB upgrade와 postflight는 완료됐다. 실제 1→3→10건 canary와 P1 `013`은 아직 완료되지 않았다. 이 문서는 다음 외부 상태를 바꾸기 전 순서와 중단 조건을 고정한다.

## 1. 읽기 전용 DB preflight

Supabase SQL Editor에서 `docs/supabase-migrations/knowledge_workflow_preflight.sql`만 먼저 실행한다.

집 PC에서는 `.env` 파일을 만들지 않고 연결된 Vercel production 환경으로 `vercel env run --environment=production -- npm run verify:supabase:knowledge`를 먼저 실행할 수 있다. 이 REST 검사는 테이블·노출·RPC 가시성을 빠르게 분류하지만 SQL의 exact signature·RLS policy·grant·legacy overload 검증을 대체하지 않는다.

2026-08-06 관측 상태:

- production anon 키는 현재 `publishable` 형식이다.
- `SUPABASE_SERVICE_ROLE_KEY`는 비활성화된 legacy JWT라 server preflight가 401 `Legacy API keys are disabled`로 실패한다. Supabase Dashboard의 현재 `sb_secret_` 값을 같은 server-only 변수에 교체하기 전 worker·migration 적용을 금지한다.
- anon read-only 조회상 `knowledge_jobs`는 존재하지만 permission denied, `knowledge_process_requests`는 schema cache에 없다. 따라서 현재 추정은 `P0 present / P1 absent`다.
- secret 교체 후 REST 검사와 아래 SQL preflight를 모두 다시 실행해 추정을 확정한다.

- 두 테이블과 모든 expected signature가 없으면 fresh install 후보이다.
- expected signature가 모두 있고 legacy overload 결과가 0행이면 이미 최신 계약일 수 있다. RLS·정책·권한까지 대조한 뒤 baseline migration을 다시 실행하지 않는다.
- 테이블 또는 일부 함수만 있거나 legacy overload가 한 행이라도 나오면 즉시 중단한다. `012`/`013`을 재실행하면 안 되며, 관측한 기존 signature를 제거하는 별도 upgrade migration을 먼저 검토한다.
- 특히 owner UUID가 첫 인자인 worker RPC와, `service_role` 이외 실행 권한이 없는지를 확인한다.

## 2. Fresh install 순서

사람이 preflight 결과와 SQL diff를 검토한 뒤에만 다음 순서로 적용한다.

1. `012_knowledge_jobs.sql`
2. PostgREST schema reload 또는 자동 cache 반영 대기
3. preflight 재실행: `knowledge_jobs`, expected 012 함수, RLS·권한 확인
4. 인증된 Focus Feed 계정에서 capture 1건 생성 확인. worker는 아직 실행하지 않는다.
5. P0 수동 경로만 필요하면 여기서 멈춘다.
6. P1 요청 UI는 기존 `013`을 적용하지 않고, claim fencing token을 포함한 신규 migration·계약을 별도 설계하고 사람 승인을 받는다.
7. 신규 P1 migration 후보가 준비된 뒤에만 preflight로 함수·RLS·권한과 legacy overload 0행을 확인한다.

기존 `013`은 fencing token이 없어 적용 금지다. P1 UI·Realtime bridge·Windows 로그인 시작 등록은 10건 P0 canary 이후에도 신규 계약과 별도 사람 게이트를 통과해야 한다.

## 3. 비파괴 롤백

문제가 생기면 테이블이나 작업 기록을 삭제하지 않는다.

1. yohan-mcp worker·bridge를 중지한다.
2. Focus Feed의 집 PC 연동 설정을 끈다.
3. 긴급 DB 동결이 필요하면 SQL Editor에서 현재 exact signature의 `authenticated` capture/request 실행 권한과 `service_role` worker 실행 권한을 `revoke`한다. 실행 전 명령문을 별도 검토하고 결과를 기록한다.
4. 원인 수정 후 같은 exact signature에 필요한 grant만 복구한다.
5. 기존 row는 보존하고 lease 만료·checkpoint·approval intent 상태를 확인한 뒤 재개한다.

테이블 drop, source 삭제, NotebookLM notebook 삭제, Yohan Brain 승인 결과 삭제는 롤백 기본 동작이 아니다. 각각 별도 건별 승인 없이는 실행하지 않는다.

## 4. NotebookLM·canary 순서

1. `uvx --from notebooklm-mcp-cli==0.9.4 nlm login`으로 인증을 복구한다. 이 PC는 `nlm`을 PATH에 전역 설치하지 않으므로 고정 버전 `uvx` 명령을 사용한다. 다른 버전으로 바꾸려면 기능 동등성 검증과 계약 갱신이 먼저다.
2. `uvx --from notebooklm-mcp-cli==0.9.4 nlm doctor`와 yohan-mcp 루트의 `python scripts/knowledge.py inventory --force`가 성공하는지 확인한다. 2026-08-06 실측은 notebook 21개·source 234개·YouTube 193개이며 기존 YouTube URL은 모두 비공개 응답이라 미확인으로 표시됐다.
3. 기존 source와 제목이 겹치지 않는 공개 자막 신규 영상 1건을 capture하고 `knowledge process --limit 1`을 실행한다. exact-title URL 미확인 후보가 있으면 중복 추가하지 않고 identity 확인에서 멈춘다.
4. source ID 재사용, `source get`, `--source-ids`, 품질 점수, `review_required`를 확인한다.
5. Control Tower 승인 후 Brain RESOURCE·SUMMARY가 한 번만 생성되는지 확인한다.
6. 같은 영상 재캡처와 승인 재시도로 중복이 생기지 않는지 확인한다.
7. 성공 증거를 남긴 뒤 3건, 마지막으로 대표 10건으로 확대한다.

인증 만료·자막 없음·한도 도달은 재시도 루프가 아니라 `action_required`로 보여야 한다.
