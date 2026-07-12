# 포커스피드 기능 단위 전면 감사 — 2026-07-12

기준 커밋: `62c225d` (main HEAD) · 감사 브랜치: `fix/audit-2026-07` (별도 워크트리)
범위: 6개 도메인 배치 × 보안·네트워크·코드품질·최적화 4관점. M10(검색 툴바) 미커밋 변경은 다른 세션 소유이므로 제외, 커밋된 HEAD 코드만 감사.

## 요약

- Critical 없음. **확정 High 4건** + Medium/Low 다수.
- 이번 브랜치에서 **5개 결함 수정(4커밋)**. 나머지는 아래 백로그로 이관(리포트만).
- 수정 선정 기준: 적대적 재검증을 통과한 확정 결함 중 저비용·저회귀. 사용량 한도 원자화(DB RPC), CSP, 분산 rate-limit, zod 전면화 같은 프로젝트급 변경은 스코프 밖.

## 기능 × 관점 매트릭스 (심각도별 건수)

| 도메인 | 보안 | 네트워크 | 코드품질 | 최적화 |
|---|---|---|---|---|
| 결제/플랜 | H1 · L2 | L1 | — | — |
| 인증/경계 | M1 · L2 | — | — | — |
| 사용량 한도 | H1 · M2 | — | — | — |
| 팀 | M1 · L1 | — | — | — |
| 외부 네트워크 I/O | L2 | H1 · M4 | L3 | L2 |
| 디제스트/요약 | M2 · L3 | M1 | L4 | L1 |
| 피드/트렌드(FE) | L2 | — | M4 · L4 | M2 |
| 라디오/PWA | — | L1 | H1 · M2 | M1 · L2 |
| 인프라/문서 | — | — | M1 · L1 | — |

(H=High, M=Medium, L=Low, 숫자=건수. 크로스커팅 중복은 대표 도메인에 1회 집계.)

## 수정 완료 (fix/audit-2026-07)

커밋: `d36cd47`(1-1) · `1056c8d`(3-1·3-2·3-5·4-5) · `ea99972`(6-1) · `0c0160a`(6-3)

| ID | 도메인 | 심각도 | 파일 | 결함 → 수정 | 검증 |
|---|---|---|---|---|---|
| 1-1 | 결제 | High | `api/stripe/webhook/route.ts` | SDK 20.x에서 `current_period_end`가 subscription item으로 이동 → 최상위 캐스팅이 항상 `undefined` → `expires_at=null` → `plan.ts`가 무기한 Pro로 해석(매출 누수). item→최상위 폴백 헬퍼 `getSubscriptionPeriodEnd`로 2곳(checkout·subscription.updated) 교체 | 단위테스트 4케이스 |
| 3-1·3-2·3-5·4-5 | 네트워크 | High(RSS)~Med | `lib/rss.ts`, `lib/youtube.ts`(5곳), `lib/gemini.ts` | 외부 fetch에 타임아웃 전무 → 피드 호스트 slow-drip이 홈 SSR 전체를 수분 블로킹. `AbortSignal`은 Next 데이터 캐시를 깨므로 캐시 유지형 `fetchWithTimeout`(Promise.race) 신설·적용, Gemini는 SDK `httpOptions.timeout` | tsc·build |
| 6-1 | 라디오 | High | `components/player/FloatingRadioPlayer.tsx` | 이펙트 deps에 `isPlaying` → 재생/일시정지 토글마다 `loadVideoById` 재호출 → 영상이 처음부터 재생(시청 위치 유실). deps에서 제거, 재생 토글은 기존 별도 이펙트가 전담 | tsc·build. **⚠ 런타임 미검증**(env 정책 차단) — 정적 분석·빌드로만 확정. 배포 전 일시정지→재생 위치 유지 스팟체크 필요 |
| 6-3 | 인프라 | Medium | `.github/workflows/ci.yml` | CI에 tsc 게이트 부재 → e2e/스크립트/테스트의 타입 오류가 main에 유입. `tsc --noEmit` 스텝 추가 | — |

**[1-2] revalidate origin/referer** → ✅ **해결**(후속): 인앱 새로고침을 서버 액션(`revalidateHomeAction`, Next 내장 same-origin CSRF)으로 옮기고, `/api/revalidate` 라우트는 외부 자동화 전용으로 남기되 origin/referer 폴백을 제거해 시크릿 인증만 남겼다(fail-closed). 인앱 버튼은 서버 액션을 쓰므로 이전 revert 사유(버튼 401)가 사라진다. 외부 크론 계약(`x-revalidate-secret`)은 그대로 유지.

## 백로그 (미수정 — 사유·권장)

### 보안 — 우선 검토 권장 (라벨보다 실질 위험 높음)
- **[2-1] 팀 admin이 owner 제거 가능** (`api/teams/[teamId]/members/route.ts:90-122`): 유일-owner 보호가 자기제거에만 걸려, admin이 owner를 지우면 팀이 owner 없이 영구 락아웃. 대상이 owner면 요청자도 owner일 때만 허용 + 남은 owner 수 카운트 필요.
- **[4-2] 무인증 트랜스크립트 액션** (`actions/digest.ts` `getVideoTranscriptAction`): 인증·rate-limit·비용가드 0. 익명이 임의 videoId 루프로 YouTube 아웃바운드 + 무제한 DB 적재. `takeToken` IP 리밋 + 자막 크기 상한 필요. → ✅ **해결**: IP 레이트리밋(30/분) + `clampTranscript` 크기 상한(6000줄/40만자) 적용. XFF 스푸핑 우회는 전역 [2-2]/[3-9]에 종속(별도).
- ~~[1-2] revalidate 인가 위조 가능~~ → 위 "수정 완료" 참조(서버 액션 전환 + 시크릿-only route로 해결).

### 사용량 한도 클러스터 (근본: 비원자적 read-modify-write)
- **[1-5·4-1] check→increment TOCTOU**: 병렬 요청이 한도를 초과하고 증가분이 유실. 올바른 수정은 Postgres RPC 원자적 증가(마이그레이션 필요) → 스코프상 별도 작업.
- **[1-4·4-14] fail-open**: service-role 클라이언트 null 또는 DB select 오류 시 `{allowed:true}`. 인프라 부재 시 fail-closed로 전환 + `SUPABASE_SERVICE_ROLE_KEY` required 승격 검토.
- **[1-1 연장] plan.ts fail-open + 백필**: `if(!expires_at) return "pro"`라 웹훅 수정은 신규 구독만 커버. 기존 `expires_at=null` 행은 그대로 무기한 Pro. plan.ts를 조이려면 결제중 사용자 백필이 선행돼야 하므로 분리 처리.

### 네트워크 복원력
- [3-3] 자막 fetch 타임아웃, [3-4] Innertube rejected-promise 영구 캐시(최초 실패가 폴백을 영구 차단), [4-4] 영상이해 호출 타임아웃, [3-7] channels.list 파라미터 순서 차이로 캐시 키 분리 → 동일 채널 2회 fetch, [3-8] channelId 미검증(가짜 소스가 매 SSR마다 실패 API 콜), [3-10] 기본 피드 1개 평문 HTTP, [2-2]/[3-9] XFF 최좌측 스푸핑으로 IP rate-limit 우회.

### 프론트 성능·버그
- [5-1] ReelView YT.Player 미destroy 누수, [5-2] 필터 체인 비메모·키워드 RegExp 매 렌더 재컴파일, [5-3] 카드마다 매 렌더 localStorage 파싱, [5-4] 소스 전환 시 Q&A 스레드 컨텍스트 오염, [6-2] 큐 인덱스 이중 보정으로 재생 곡 변경, [6-4] 재생 위치 broadcast가 큐 컨텍스트 통째 갱신 → 소비자 매초 재렌더, [6-5] 플레이리스트 items 검증·rate-limit 부재, [5-5] `FeedItem` 요약 재살균 정규식이 `x < 10` 리터럴 꺾쇠 파괴.

### 코드품질·문서 (저위험)
- [1-6] checkout `payment_status` 미확인, [1-8] notion/health 무인증 정보노출, [2-3] PATCH 마지막 owner 강등, [2-5] custom-sources PUT N+1, [3-11]~[3-14] 에러 삼킴·warnedKeys 누적·notion TOCTOU·decodeURIComponent URIError, [4-6]~[4-16] callGemini 미abort 재시도·캐시 저장실패 시 증가·goals 길이무제한·videoId 미검증 등, [5-6]~[5-14], [6-6] VHK 버전 문서 드리프트(`VHK_ADOPTION.md` 2.6.0/file: vs 실제 2.5.1), [6-7] `supabase-server-cookies.ts:30` 존재하지 않는 middleware.ts 주석(실제 proxy.ts), [6-8]~[6-12].

### 의도적 보류 (수정 안 함)
- [1-9] CSP 미설정 — `next.config.ts` 주석에 report-only 관찰 후 도입 명시.
- [1-3] rate-limit 인메모리 — 분산 저장소(Upstash/Redis) 도입은 인프라 프로젝트.

## 반증되어 무발견 처리된 후보 (오탐 방지)
- SSRF: RSS URL은 하드코딩 목록 전용, YouTube는 호스트 고정+값 인코딩. 사용자 임의 호스트 주입 경로 없음.
- XSS: `src` 전역 `dangerouslySetInnerHTML` 0건. 전 구간 React 텍스트 렌더로 이스케이프.
- ReDoS: `filter.ts` 키워드는 `^[a-zA-Z0-9 ]+$` 통과분만 이스케이프 후 정규식화.
- Stripe 웹훅 서명 검증·briefing prod fail-closed·proxy 세션 재검증·service-role 라우트의 user.id 재필터: 모두 정상.
