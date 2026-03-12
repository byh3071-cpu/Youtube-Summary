# Focus Feed 전체 점검 체크리스트 (우선순위별)

> **우선순위**: P0(긴급) → P1(높음) → P2(중간) → P3(낮음) 순으로 처리하세요.  
> 점검일 기준으로 상태를 갱신해 두면 다음 점검 시 참고하기 좋습니다.

---

## P0 — 긴급 (배포·보안에 직결, 먼저 해결)

배포 전 반드시 확인할 항목. 미해결 시 보안·배포 실패 위험.

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| P0-1 | `.env.example`에 **실제 API 키/비밀값 없음** (placeholder만 사용) | ✅ | `your_..._here` 형태로 이미 교체됨. 커밋 전 재확인 권장 |
| P0-2 | `.env.local` 등 실제 키 파일이 `.gitignore`에 포함됨 | ✅ | `.env*` 제외, `!.env.example`만 커밋 |
| P0-3 | **`npm run build`** 성공 | ✅ | 2025-03 점검: TypeScript·Supabase 타입 수정 후 통과 |
| P0-4 | 프로덕션 환경 변수 설정 (Vercel 등: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`) | ⬜ | 배포 플랫폼 대시보드에서 설정 |
| P0-5 | 재검증 API(`/api/revalidate`) 프로덕션에서 인증 사용 | ✅ | `REVALIDATE_SECRET` 또는 same-origin 체크 |
| P0-6 | 프로덕션에서 revalidate 무인증 허용 없음 | ✅ | `NODE_ENV === 'production'`일 때만 인증 적용 |

---

## P1 — 높음 (배포 직전·운영 안정성)

배포 직전 또는 운영 안정성을 위해 해두면 좋은 항목.

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| P1-1 | **`npm run lint`** 에러 없음 | ✅ | 2025-03 점검: 에러 0건. 경고 정리·타입 수정 반영 |
| P1-2 | **`npm run start`**로 프로덕션 빌드 실행 검증 | ✅ | `next build` 산출물로 start 정상. 포트 3000 비었을 때 실행 |
| P1-3 | 재검증 웹훅/크론 사용 시 **`REVALIDATE_SECRET`** 설정 | ⬜ | 외부에서 revalidate 호출할 때만 |
| P1-4 | API 키는 **서버 측에서만** 사용 (클라이언트 노출 없음) | ✅ | YouTube/Gemini는 서버 액션·API 등에서만 사용 |
| P1-5 | 브리핑 Cron 사용 시 **`BRIEFING_CRON_SECRET`** 설정 | ⬜ | `/api/briefing` 외부 호출 시 필요 |

---

## P2 — 중간 (품질·유지보수·점진 개선)

서비스는 동작하지만, 시간 날 때 단계적으로 손보면 좋은 항목.

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| P2-1 | TypeScript 빌드 에러 없음 | ✅ | P0-3 빌드 통과로 함께 충족 |
| P2-2 | `eslint-disable` 최소화·사유 주석 명시 | ⬜ | 일부에 사유 주석 추가됨. 전반 점검 권장 |
| P2-3 | `as any` 사용 최소화 (타입 보강) | ⬜ | playlists insert 등 Supabase 한계로 일부 유지. YT Player는 타입 보강함 |
| P2-4 | 버튼/링크 **`aria-label`** 등 접근성 속성 보강 | ⬜ | 일부만 적용됨. 전반 점검 권장 |
| P2-5 | 이미지 **`alt`** 텍스트 누락 여부 확인 | ⬜ | Next/Image 사용 시 alt 필수 |
| P2-6 | 키보드만으로 주요 동작 가능 여부 확인 | ⬜ | 모달·플레이어·필터 등 |

---

## P3 — 낮음 (선택·장기)

당장 필수는 아니고, 여유 있을 때 또는 장기 로드맵으로 다룰 항목.

| # | 항목 | 상태 | 비고 |
|---|------|:----:|------|
| P3-1 | 단위/통합 테스트 도입 (`npm run test` 실제 동작) | ⬜ | 현재 "No tests yet". Jest/Vitest 등 검토 |
| P3-2 | 핵심 로직(필터, 병합, YouTube/Gemini) 테스트 작성 | ⬜ | 테스트 도입 후 우선 대상 |
| P3-3 | 중복/데드 코드 정리 | ⬜ | `src\`/`src/` 표기 차이는 동일 파일 |
| P3-4 | Supabase Auth·DB·구독 관리 (Phase 1~4) | ⬜ | docs/NEXT_STEPS_SUPABASE.md 참고 |

---

## 참고: 이미 충족된 항목 (유지만 하면 됨)

| 항목 | 비고 |
|------|------|
| `npm run dev` 정상 기동 | Turbopack 비활성화(`--webpack`)로 안정화 |
| 환경 변수 문서화 | README, .env.example에 YOUTUBE/GEMINI/REVALIDATE/Supabase |
| TODO/FIXME 정리 | 코드 내 검색 결과 없음 |
| 다크/라이트 테마 | next-themes 적용 |
| README·NEXT_STEPS·CURSOR_HANDOFF·AI_COLLABORATION | 문서 존재 및 정합성 |

---

## 권장 진행 순서 (한 줄 요약)

1. **P0** 전부 확인 → 특히 **P0-3 (build)**, **P0-4 (프로덕션 env)**  
2. **P1** 중 배포에 쓰는 것만 먼저 (lint, start 검증, REVALIDATE_SECRET)  
3. 배포 후 **P2**를 여유 있을 때 (린트/타입/접근성)  
4. **P3**는 테스트·Supabase 등 장기 로드맵으로

---

- **범례**: ✅ 완료/적합, ⬜ 미확인 또는 필요 시 조치  
- 파일 위치: `docs/CHECKLIST.md`
