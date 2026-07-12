---
id: focus-feed-devlog-2026-07-12-channel-storage-diagnosis
date: 2026-07-12
project: youtube-summary (Focus Feed)
pr: "PR1 (fix/channel-source-reliability)"
tags: [devlog, diagnosis, custom-sources, cookie, session, sync]
---

# Dev Log — 채널 저장 파이프라인 진단 + 신뢰성 수정 (Phase 0~1)

## 한 줄
"첫 로드에 추가 채널이 안 보이다가 클릭하면 나타난다"는 보고에서 출발 → 원인 후보를 좁히는 진단(Phase 0)과, 원인 여부와 무관하게 실재하는 저장 결함 3건 수정(Phase 1). 전체 로드맵: `~/.claude/plans/phaze-abundant-moore.md`.

## 진단표 (Phase 0, 2026-07-12)

| 항목 | 결과 |
|---|---|
| 세션 갱신 미들웨어 | `src/proxy.ts`로 **존재·정상**(Next 16의 middleware=proxy, `b44347d` 2026-06-11). "미들웨어 부재" 가설 기각 |
| 프로덕션 배포 | 최신 배포 = `62c225d`(main HEAD) — proxy 포함. 배포 누락 가설 기각 |
| 비로그인 경로 실측 | 프로덕션(`youtube-summary-lac.vercel.app`)에서 ASCII 채널 추가 → 재방문 **첫 페인트부터 표시됨. 정상** (테스트 후 원복) |
| 진단 브라우저 상태 | 해당 Chrome 프로필엔 `focus_feed_sources`·sb-auth 쿠키·localStorage 백업 전무 → **보고된 증상의 재현 환경이 아님** |
| 미확정 | 사용자 실사용 환경(다른 프로필/PWA/로컬/폰)과 로그인 경로 재현 — 사용자 확인 필요 |

## 확정 결함 (원인 여부와 무관하게 실재 — Phase 1에서 수정)

- **결함 A (쿠키 조용한 유실)**: `setCustomSourcesCookie`의 3800자 예산이 *인코딩 전* 길이 기준. Set-Cookie는 percent-encoding으로 저장하므로(실측: `[]` → `%5B%5D`) 한글 이름은 글자당 최대 9B로 팽창 — 브라우저 4096B 한도 초과 시 Set-Cookie가 통째로 버려지는데 API는 `ok:true`를 반환했다.
- **결함 B (삭제 부활)**: `mergeCustomSources`/`syncCustomSourcesWithDb`/PUT이 전부 union-only — 기기 A에서 삭제해도 기기 B의 낡은 쿠키가 DB에 재삽입. **Phase 2(동기화 모델 통일)에서 수정 예정.**
- **결함 C (계정 전환 오염)**: `SIGNED_OUT` 처리가 없어 로그아웃 후에도 쿠키·백업이 남음 → 같은 브라우저의 다음 계정 동기화가 이전 계정 채널을 자기 DB로 push.

## 한 일 (Phase 1)

- `route.ts`: 쿠키 예산을 `이름 + encodeURIComponent(값)` 바이트 기준(4000B)으로 교정. DELETE가 쿠키 저장 실패를 무시하던 것 → 비로그인이면 413 명시 실패.
- `AddChannelModal`: `cookieStored:false && saved`(계정에만 저장) 케이스를 사용자에게 안내.
- `CustomSourcesSync`: `SIGNED_OUT`에서 쿠키·localStorage 백업·sessionStorage 플래그 클리어 (결함 C).
- 테스트 신설: `custom-sources-cookie.test.ts`(10) · `youtube-channel-parse.test.ts`(10, Phase 3 대비 회귀 가드 포함) · `custom-sources/route.test.ts`(6, 한글 팽창 경계 포함).

## 에러·교훈
- **증상 시그니처로 원인을 가르라**: "안 보이다가 클릭하면 나타남"은 유실(결함 A)이 아니라 렌더/동기화 타이밍 시그니처. 결함 A만 고치고 "버그 픽스 완료"라 선언했으면 거짓 완료가 됐을 것. 판별 테스트(ASCII 소량 채널)를 Phase 0에 명시한 이유.
- **union 동기화는 삭제와 양립 불가**: "기존 유지 + 새 항목 추가" 병합은 삭제 전파를 원리적으로 못 한다. 다중 저장소(쿠키·DB) 동기화에는 단일 진실 + 미러 or 타임스탬프가 필요.
