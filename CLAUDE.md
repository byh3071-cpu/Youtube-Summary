---

## id: focus-feed-claude-md

date: 2026-05-17
tags: [focus-feed, claude, context]

# Focus Feed — Claude 세션용 컨텍스트

Claude Code·CLI 등 **저장소 밖의 Claude**가 이 프로젝트를 이해할 때 읽는 짧은 앵커 문서다.

## 무엇을 만드는가

- **Focus Feed**: YouTube + RSS 통합 피드, 키워드·카테고리 필터, **라디오 큐(백그라운드 재생)**, **Gemini AI 요약/인사이트/팀 브리핑**.
- **스택**: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase Auth·DB, Stripe(Pro), PWA(`app.webmanifest`).

## 어디를 보나


| 목적              | 경로                            |
| --------------- | ----------------------------- |
| 제품 범위·플랜        | `docs/PRD.md`                 |
| 로컬 실행·환경 변수     | `README.md`, `.env.example`   |
| 에이전트 규칙(Cursor) | `AGENTS.md`, `.cursor/rules/` |
| AI 역할 분담 템플릿    | `AI_COLLABORATION.md`         |
| 공통 작업 헌법·VHK 정책 | `RULES.md`, `docs/VHK_ADOPTION.md` |


## 코딩 시 주의

- 시크릿·API 키를 코드에 넣지 말 것.
- 서버 전용: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `GEMINI_API_KEY`, `YOUTUBE_API_KEY` 등.
- 배포: `NEXT_PUBLIC_SITE_URL` OAuth/결제 리다이렉트에 필요.
- 플랜·한도: `src/lib/plan.ts`, `src/lib/usage-limits.ts`.

## 검증

```bash
npm run verify:focus-feed
npm run vhk:policy
```

상세 제품 요구는 `**docs/PRD.md**` 를 갱신된 기준으로 따른다.

## VHK

- VHK는 반드시 `npm run vhk -- <command>`로 실행한다.
- 확인된 VHK 자체 결함은 `npm run vhk:incident -- ...`와 `npm run vhk:draft -- <id>`로 기록한다.
- draft를 사용자에게 보여주고 외부 공개 승인을 받은 뒤 `npm run vhk:report -- <id> --approved`로 upstream 이슈를 등록한다.
- 이슈 URL이 연결되지 않은 VHK 결함이 있으면 완료로 선언하지 않는다.
- 사용자 승인 없이 `vhk sync`, Git 자동화, 배포·배포 관련 명령을 실행하지 않는다.

<!-- YOHAN-ROSTER-CARD:BEGIN (managed by yohan-brain ops/propagation — SoT를 고쳐라, 직접수정 금지) -->
## 상시 지휘자 — 라우팅 카드 (yohan ecosystem)

> SoT: yohan-brain `memory/core/agent-roster.yaml` `conductor_always_on` (v0.4+, status=active면 obey).
> 이 레포 자체 규칙(RULES/CLAUDE LIVE)이 있으면 그게 우선(precedence).

- 모든 태스크: 해법 구상 **전에** 크기 판정 → `라우팅: S|M|L — 계획 1줄 (근거: 파일수/신규설계/리스크)` 선언 후 진행. 키워드("풀개발") 불필요, 항상.
- **판정법(감 금지)**: ①하드 트리거 먼저 → 해당 시 즉시 확정 · ②없으면 예상 수정 파일 수를 먼저 세고 구간 매핑(≤2=S·3~6=M·≥7/다레포=L). LLM 자유분류는 불안정(실측 33~56%) — 파일수 결정론이 정답.
- **S**(≤2파일·신규설계 없음·≤15분): 지휘자 단독. 서브에이전트·orca 금지(오버헤드).
- **M**(3~6파일·부분 신규): 서브에이전트 티어링 — 탐색 haiku → 계획 opus(승인) → 구현 sonnet → 적대검증 opus/fable 루프.
- **L**(≥7파일·신규 모듈·다레포·릴리즈급): /goal orca 풀파이프라인 — Scout→Plan승인★→worktree fanout→타벤더 적대검증→머지게이트★. "풀개발"=L 강제.
- 하드 트리거(분류 생략): 스키마 마이그레이션·인증/결제/보안·크로스레포·릴리즈 = 무조건 **L** · 오타·문서/주석만 = **S**.
- 애매하면 작은 쪽 시작 → 검증 실패(테스트/tsc/critic) 시 **재선언 후 승급**(몰래 계속 금지).
- 동시 작업 = worktree만. 같은 레포·같은 브랜치 2에이전트 금지.
- Antigravity(agy) = 보조·초안 전용(메인 지휘 금지) — 산출물은 상위 티어 검증 필수.
- 배포·시크릿·npm publish·main 직push = 사람 게이트(불변).
<!-- YOHAN-ROSTER-CARD:END -->
