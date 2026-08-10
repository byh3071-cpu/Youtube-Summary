---
패턴명: Supabase 수동 Database 타입의 mutation never 추론
카테고리: build
증상: select는 컴파일되지만 insert·update에 정상 행 타입을 넘겨도 "argument is not assignable to parameter of type never" 오류가 난다.
원인: 수동으로 작성한 Supabase Database 타입이 PostgREST GenericSchema 계약을 완성하지 않았다. 각 테이블의 Relationships 또는 스키마의 Views·Functions가 빠지면 최신 supabase-js가 스키마를 GenericSchema로 인정하지 않아 mutation 타입을 never로 축소한다.
해결: 각 테이블에 Relationships 배열을 선언하고 public 스키마에 Views와 Functions를 포함한다. 생성 타입을 쓸 수 있으면 Supabase CLI 생성 타입을 정본으로 삼는다. any·never 캐스트나 service-role 전용 mutation helper로 증상을 덮지 않는다.
적용조건: Supabase 생성 타입 대신 최소 Database 타입을 직접 유지하며 supabase-js·postgrest-js를 업데이트하는 TypeScript 프로젝트.
출처프로젝트: focus-feed (youtube-summary)
태그: [supabase-js, postgrest, typescript, genericschema, never, mutation]
발견일: 2026-08-01
출처DevLog: docs/devlog/2026-08-01-knowledge-capture-stabilization.md
---

## 확인 순서

1. 설치된 postgrest-js의 GenericTable·GenericSchema 정의를 확인한다.
2. 모든 Table에 Row·Insert·Update·Relationships가 있는지 확인한다.
3. 스키마에 Tables·Views·Functions가 있는지 확인한다.
4. 타입 검사와 실제 insert 경로의 API 테스트를 함께 실행한다.
