# Antigravity가 하는 동안 Cursor가 할 수 있는 작업

Antigravity가 기획·우선순위·완료 기준 정리나 브라우저 QA를 진행하는 동안, **Cursor**가 기획 결과를 기다리지 않고 바로 할 수 있는 작업 목록입니다. 코드·빌드·보안·문서 위주입니다.

---

## 1. 코드 품질·검증 (Antigravity 결과 불필요)

- [x] **lint 실행** — 규칙 위반·경고 수정 완료
- [x] **빌드 검증** — `npm run build` 통과
- [x] **미사용 코드 정리** — setState in effect → queueMicrotask, catch(e: unknown) 등 적용
- [x] **타입 보강** — summarize.ts catch(e: unknown), 동작 유지

---

## 2. 보안·설정 점검 (AI 협업 Playbook “보안” 우선)

- [x] **환경 변수 노출 여부** — `.env.example` 플레이스홀더만 사용
- [x] **API 키 사용 방식** — process.env만 사용 확인
- [x] **`.gitignore`** — `.env*` 무시 확인
- [x] **의존성 점검** — `npm audit` 0 vulnerabilities

---

## 3. 안정성·에러 처리

- [ ] **서버/클라이언트 에러 메시지** — 사용자에게 보이는 문구가 명확한지, 과도한 기술 용어 제거
- [ ] **빈 상태·로딩 상태** — API 실패·데이터 없을 때 UI가 깨지지 않는지 확인
- [ ] **라디오 플레이어** — YouTube API 로드 실패·영상 비공개 시 플레이어가 안전하게 실패하는지 확인

---

## 4. 문서화 (Cursor 역할)

- [x] **README** — 라디오 모드, AI 요약, GEMINI_API_KEY, 프로젝트 구조(contexts) 반영
- [x] **`.env.example`** — YOUTUBE_API_KEY, GEMINI_API_KEY, REVALIDATE_SECRET 플레이스홀더·주석
- [x] **변경 사항·리스크 정리** — CURSOR_PARALLEL_TASKS 체크리스트 및 AI_COLLABORATION 라디오 항목 추가
- [x] **주요 파일 주석** — RadioQueueContext, FloatingRadioPlayer, feed.ts 상단 요약 주석 추가

---

## 5. 접근성·UX (기능 변경 최소화)

- [ ] **버튼/링크 `aria-label`** — “라디오에 추가”, “재생”, “다음” 등 이미 있으면 확인, 없으면 추가
- [ ] **포커스 순서** — 키보드만으로 플로팅 플레이어 조작 가능한지 확인
- [ ] **에러 메시지** — 스크린 리더에 읽히기 좋게 짧고 명확한 문구인지 확인

---

## 6. 다음 Phase 대비 (기능 구현은 하지 않음)

- [x] **폴더/파일 구조** — contexts, components/player, lib 구조로 Phase 5 확장 가능
- [x] **공통 타입·상수** — `src/types/feed.ts`, FeedCategory 등 정리됨
- [x] **테스트 스크립트** — `package.json`에 `test` 스크립트 추가 (실제 테스트는 기획 후)

---

## 참고

- **Antigravity**: 기획, 우선순위, 완료 기준, 브라우저 QA, 사용자 안내  
- **Cursor**: 코드 수정, lint/build, 보안·안정성, 문서화  
- Antigravity가 “이번 사이클 목표·완료 기준”을 주면, Cursor는 그에 맞춰 구현·수정을 이어가면 됨.
