---
id: focus-feed-devlog-2026-07-27-knowledge-capture-p0
date: 2026-07-27
project: youtube-summary (Focus Feed)
tags: [devlog, knowledge-capture, notebooklm, supabase, pwa, youtube, quality-gate]
---

# Dev Log — Focus Feed 지식 캡처 P0 준비

## 한 줄

Focus Feed에서 보던 YouTube 영상을 바로 지식 대기열로 보낼 수 있게 만들고, yohan-brain이 NotebookLM 근거 확인 후 사람 검토 후보만 생성하도록 연결 계약을 준비했다. 운영 DB·NotebookLM 인증은 아직 적용하지 않았다.

## 산출물

- 피드 카드와 상세 보기의 **지식으로 담기** 버튼, 공유 확인 화면 `/capture`, iPhone 단축어·데스크톱 북마클릿 안내를 추가했다.
- URL을 표준 YouTube watch URL로 정규화하고 제목·채널·설명란의 타임라인·참고 링크만 선별한 소스 가이드를 만든다.
- `knowledge_jobs` migration 012를 추가했다. 사용자별 영상 중복 방지, worker lease, 최대 3건 claim, 상태 전이를 포함한다.
- share target은 기존 `/add`가 아니라 `/capture` 확인 화면으로 향한다. GET 공유 링크가 즉시 DB를 변경하지 않도록 했다.
- yohan-brain worker가 재시도 시 NotebookLM source ID를 이어받을 수 있게 source ID·등록 시각 필드를 대기열에 포함했다.

## 검증

- `npm run test:unit -- src/lib/knowledge-capture.test.ts` — 5개 통과.
- `npx tsc --noEmit` — 통과.
- 변경 파일 ESLint — 경고 0 통과.
- `npm run build` — Next.js 프로덕션 빌드 통과.
- `npm run security:secrets` — 354 파일 통과.
- `npm run vhk:policy` — incident policy 통과.

## 교훈

공유 진입점은 곧바로 적재하면 오발송과 중복이 생긴다. **공유 URL → 확인 화면 → POST**로 분리하면 iPhone 단축어·북마클릿·웹 공유 대상이 같은 안전 경계를 공유한다.

## 남은 사람 게이트

1. Supabase SQL Editor에서 migration 012을 검토·적용한다.
2. P0 canary 계정으로 영상 1건을 접수해 RLS와 중복 응답을 실측한다.
3. NotebookLM 인증과 yohan-brain worker 환경 변수를 별도 승인 뒤 연결한다.
4. 실제 iPhone 공유 시트와 PWA 업데이트 경로를 한 번 실측한다.
