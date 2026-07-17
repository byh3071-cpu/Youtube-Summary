---
id: focus-feed-m11-execution-plan
date: 2026-07-16
tags: [focus-feed, m11, ui, ux, execution, qa]
---

# M11 디자인 시스템·영상/플레이어 재구성 실행 현황

## 문서 역할

이 문서는 M11의 단일 활성 작업대장이다. 우선순위와 마일스톤 완료 여부는
`docs/MILESTONES.md`, 제품 동작은 `docs/PRD.md`, 세부 구현·검증 상태는 본 문서를
따른다.

상태는 아래 여섯 값만 사용한다.

- `planned`: 범위와 완료 조건이 확정됨
- `active`: 현재 구현 또는 검증 중
- `browser-verified`: 로컬 브라우저와 자동 게이트 통과
- `preview-verified`: Preview 인증·외부 연동까지 통과
- `approved`: 사용자 검수까지 완료
- `blocked`: 외부 권한 또는 재현 가능한 차단 사유가 기록됨

## 운영 계약

- 작업 브랜치: `design/ui-03-app-shell`
- 로컬 Phase 커밋은 허용한다.
- 사용자 별도 승인 전까지 push, PR, production 배포, main 병합은 금지한다.
- 롱폼 상세 URL은 M11에서 `/?viewMode=longform&watch={videoId}`를 유지한다.
- 라디오 큐는 페이지 이동 중 유지하되 브라우저 새로고침 영속화는 M11 범위 밖이다.
- 각 Phase 종료 시 lint, unit, build, secret scan, VHK와 해당 범위의 브라우저 검증 결과를 기록한다.

## Phase 현황

| Phase | 목표 | 상태 | 종료 조건 |
|---|---|---|---|
| P0 | 검증된 기준선 고정·최신 main 동기화 | approved | allowlist 커밋, main merge, 전체 게이트 통과 |
| P1 | 영구 Phase/Task 관리 정상화 | approved | 본 문서·MILESTONES·PRD 동기화 커밋 |
| P2 | 롱폼·숏폼·라이브·AI 상태 완료 | browser-verified | Preview 로그인·Gemini 실생성 제외 로컬 수용 기준 통과 |
| P3 | Preview 인증·Gemini 실검증 | blocked | Google OAuth, 상세 복귀, 실제 요약·사용량·캐시 확인 |
| P4 | 라디오 큐 재정렬·재생 인스턴스 검증 | browser-verified | 재정렬 불변식, 동일 iframe 노드, 반응형 검증 |
| P5 | 홈·앱 셸·전 화면 접근성 완료 | browser-verified | 5개 viewport·라이트/다크·핵심 라우트 감사 통과 |
| P6 | 다중 검수·병합 준비 | planned | 디자인·기능·코드 검수와 전체 게이트 완료 |

## Task 현황

| ID | Task | 상태 | 현재 증거·남은 조건 |
|---|---|---|---|
| GOV-01 | 현재 UI 변경 allowlist 기준선 고정 | approved | `ad783a7`, 38개 경로만 stage, unit 174개·build 통과 |
| GOV-02 | 최신 main을 feature 브랜치에 병합 | approved | `f44fd60`, 충돌 0, 병합 후 unit 178개·build 통과 |
| DOC-01 | M11 작업대장·공식 문서 동기화 | approved | MILESTONES·PRD와 구현 상태·잔여 Task 동기화 |
| HOME-01 | YouTube식 16:9 카드·2줄 제목·메타 | browser-verified | 393/768/1440px 비율·overflow 확인 |
| HOME-02 | 카드 액션 우선순위·AI CTA 정렬 | browser-verified | 카드 하단 정렬·기존 기능 유지 확인 |
| VIDEO-01 | 롱폼 목록·상세·관련 영상·스크롤 복원 | browser-verified | `600px → 상세 → 600px`, autoplay off |
| VIDEO-02 | 롱폼 외부 AI 패널 상태 연결 | browser-verified | idle/loading/auth/error/success/cache, Preview 실생성 남음 |
| VIDEO-03 | 숏폼 9:16·라이브 16:9 정책 분리 | browser-verified | 숏폼 자동 다음, 라이브 자동 다음 없음, 자막 충돌 수정 |
| RADIO-01 | 미니·확장 플레이어·큐·AI 외부 패널 | browser-verified | 393/768/1440px safe area·hover chrome 확인 |
| RADIO-02 | 큐 재정렬과 currentIndex 불변식 | browser-verified | drag·44px 이동 버튼·동일 현재 항목·확장 미리보기의 이전/현재/다음 탐색·overflow 검증 완료 |
| RADIO-03 | 미니↔확장 전환 재생 인스턴스 유지 | browser-verified | 동일 iframe `isSameNode`·src·320px↔100% 전환 통과 |
| RADIO-04 | 미니 영상 오류 복구·반응형 경계 | browser-verified | 직접 닫기·44px·393/768/1440px·16:9 통과 |
| SHELL-01 | Apple식 사이드바·모바일 드로어·고정 챗봇 | browser-verified | 드로어 전후 카드·챗봇 위치 검증 완료 |
| SHELL-02 | 전 화면 반응형·접근성 최종 감사 | browser-verified | 360/393/768/1024/1440, 라이트·다크, 익명 핵심 라우트 통과. 인증 화면은 PREVIEW-01에서 검증 |
| SHELL-03 | 모달 scroll-lock fixed UI 위치 유지 | browser-verified | 대기열·AI·필터 전후 하단 버튼 좌표·전체화면 폭 통과 |
| SHELL-04 | 채널 상세 상단을 홈 탐색 계층과 통일 | browser-verified | 새로고침·중복 필터 카드 제거, 아바타형 채널 헤더와 검색·트렌드·필터 통합, 360/1440px overflow 0 |
| PREVIEW-01 | Vercel Preview OAuth·Gemini 실검증 | blocked | Vercel CLI·인증·프로젝트 link와 Supabase redirect 필요 |
| QA-01 | 디자인·기능·코드 3단계 검수 | active | 디자인 시각 검수 완료. 기능·코드 검수와 CI Playwright는 잔여 |
| QA-01-1 | 주요 화면 디자인 시각 검수 | browser-verified | 홈·채널·롱폼·숏폼·라이브·확장 라디오 393/1440px 캡처, 숏폼 포스터·외부 메타 보완 |
| QA-01-2 | 핵심 기능 상호작용 회귀 검수 | browser-verified | 검색·필터·소스·모달·라디오·반응형 셸 38개와 모바일 UX 5개 통과. 홈·숏폼 위치 복원 경합 수정 |

## 검증 기록

| 날짜 | 범위 | 결과 |
|---|---|---|
| 2026-07-16 | M11 기준선 | lint 오류 0(기존 경고 1), unit 174, build, secret scan, VHK 통과 |
| 2026-07-16 | main 병합 후 | lint 오류 0(기존 경고 1), unit 178, build, secret scan, VHK 통과 |
| 2026-07-16 | 롱폼 AI | 393/1440px 라이트·다크 Axe 0, overflow 0, 로그인 복귀 URL·캐시 복원 확인 |
| 2026-07-16 | 라디오 큐 재정렬 | 순수 함수 5개, E2E 4개, 393/1440px 시각 검수, 현재 항목·44px·overflow 통과 |
| 2026-07-16 | 라디오 재생 인스턴스 | 확장 플레이어 E2E 8개, 동일 iframe 노드·src·크기 전환, hover/focus 회귀 통과 |
| 2026-07-16 | 미니 복구·fixed UI | 라디오 E2E 16개, 3개 viewport 직접 닫기·16:9, 대기열·AI·필터 좌표·전체화면 폭 통과 |
| 2026-07-17 | 셸 최종 감사·채널 상세 | 홈 360/393/768/1024/1440px, 라이트·다크 393/1440px, 롱폼·숏폼·라이브 360/1440px overflow 0·핵심 44px 통과. 채널 상세 360/1440px 시각 검수 |
| 2026-07-17 | 확장 대기열 탐색 | 마지막 항목 2/2 재생 후에도 이전 항목 노출·재선택, 현재 항목 표시, 자동 숨김 유지 확인 |
| 2026-07-17 | QA 디자인 시각 검수 | 홈·채널·롱폼·숏폼·라이브·확장 라디오 9개 상태 캡처. 숏폼 로딩 포스터와 자막 비충돌 메타 영역 추가 후 393/1440px 재검증 |
| 2026-07-18 | QA 핵심 상호작용 검수 | production build 기준 데스크톱·반응형 E2E 38개와 모바일 E2E 5개 통과. 검색·필터·소스 전환, 대기열 선택·삭제·재정렬, 미니↔확장 동일 iframe, 모달 포커스·ESC, 44px·overflow 및 홈·숏폼 위치 복원 확인 |

## 현재 blocker와 다음 Task

- Preview: Vercel CLI, 로그인 세션, project link가 아직 없다. production으로 우회하지 않는다.
- 로컬 Playwright test runner: Windows 프로세스 종료 문제가 재현될 수 있어 직접 Chromium
  검증을 병행한다. push 승인 후 CI Playwright를 release-ready 게이트로 사용한다.
- 외부 blocker가 해소되기 전 다음 Task는 `QA-01-3` 코드·접근성 최종 감사다. push 승인 후
  CI Playwright를 실행하고, Preview 준비가 완료되는 즉시 `PREVIEW-01`을 재개한다.
