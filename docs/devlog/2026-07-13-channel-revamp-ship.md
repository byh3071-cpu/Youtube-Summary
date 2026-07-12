---
id: focus-feed-devlog-2026-07-13-channel-revamp-ship
date: 2026-07-13
project: youtube-summary (Focus Feed)
pr: "#20 #21 #22 #23 #25 #27"
tags: [devlog, custom-sources, hidden-list, sync, share-target, pwa, webapk, deeplink, emulator-verification]
---

# Dev Log — 채널 관리 개편 출하 (숨김 목록·영상 링크·/add 공유 + 가상폰 검증)

## 한 줄
"첫 로드에 추가 채널이 안 보인다" 진단(devlog 2026-07-12)에서 출발한 채널 관리 개편 전체를 PR 6개로 출하하고, 안드로이드 에뮬레이터를 구축해 유튜브 공유시트 → /add → 채널 추가까지 엔드투엔드로 실증. 플랜 원본: `~/.claude/plans/phaze-abundant-moore.md`.

## 산출물 포인터
- PR #20 (fix): 쿠키 인코딩 유실·DELETE 실패 무시·SIGNED_OUT 계정 오염 — 상세는 devlog 2026-07-12
- PR #21 (feat): 기본 채널 숨김 목록 + 동기화 DB 단일 진실 통일 — `hidden_default_sources` 마이그레이션 010(적용 완료), `/api/custom-sources/sync` 신설, 소유자 마커 쿠키
- PR #22 (feat): 영상 링크(watch·youtu.be·shorts·live·embed) → videos.list 역해석으로 채널 추가
- PR #23 (feat): `/add` 딥링크(확인 화면) + manifest share_target + 북마클릿
- PR #25 (fix): 마지막 채널 삭제가 localStorage 백업 복원으로 되돌아가던 문제 (프로덕션 실검증에서 발견)
- PR #27 (fix): SW 프리캐시가 옛 manifest를 얼려 share_target이 기존 방문자에게 무시되던 문제 (v4 범프, 폰 검증에서 발견)
- 검증 인프라: `C:\Android` (SDK + Pixel 7/Android 14 AVD `ffphone2`) — 재사용 가능

## 검증
- 매 PR `verify:focus-feed` 올그린 (vitest 100→157), 프로덕션 실측: 숨김/복원·기기 간 시나리오·영상 링크 해석·/add 상태 분기.
- **가상폰 E2E**: WebAPK 발급(`org.chromium.webapk.*`) → APK 내 ShareActivity(SEND·text/plain) 등록 확인 → 시스템 공유시트에 FocusFeed 노출 → 유튜브 링크 공유 → Rick Astley 채널 확인 화면 → 추가 완료.

## 에러·교훈
- **교훈 1 (SW 프리캐시에 가변 자산 금지)**: 프리캐시는 SW 버전 범프 때만 갱신된다. `app.webmanifest`를 프리캐시에 넣은 탓에 share_target을 배포해도 기존 방문자는 영원히 옛 manifest를 받았다. manifest처럼 배포로 바뀌는 파일은 네트워크 직행으로.
- **교훈 2 (union 동기화는 삭제와 양립 불가)**: "기존 유지+새 항목 추가" 병합은 삭제 전파를 원리적으로 못 한다. 다중 저장소(쿠키·DB) 동기화는 단일 진실 + 미러 + 소유자 마커로. 같은 원리로, 빈 목록("전부 삭제")과 저장소 유실을 구분 못 하면 백업 복원이 삭제를 되돌린다(PR #25).
- **교훈 3 (에뮬레이터 WebAPK는 Play 로그인 필수)**: 비로그인 에뮬레이터에서 Chrome은 WebAPK 민팅을 시도조차 없이 숏컷으로 조용히 폴백한다(`chrome://webapks` 빈 페이지로 판별). share_target 검증은 Play 로그인 후에만 유효.
- **교훈 4 (QEMU는 비ASCII 경로에서 죽는다)**: SDK·AVD가 `C:\Users\백요한\...` 아래 있으면 에뮬레이터가 부팅 직후 조용히 종료(파일 쓰기 실패). ASCII 경로(`C:\Android`)로 이전해 해결.
- **교훈 5 (검증이 곧 발견)**: 출하 후 프로덕션·폰 실검증에서만 드러난 버그가 2건(PR #25, #27). 로컬 게이트·CI 통과와 "실사용 경로에서 동작"은 다른 명제다.
