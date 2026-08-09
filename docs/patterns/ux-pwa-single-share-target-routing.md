---
패턴명: 단일 PWA share target의 기존 흐름 대체
카테고리: ux
증상: manifest의 share_target을 새 기능 URL로 바꾸자 이전에 공유로 진입하던 기능이 앱에서 사라지고, 기존 화면 안내와 실제 동작이 어긋난다.
원인: Web App Manifest는 앱당 share_target 진입점을 하나만 제공한다. 새 action으로 단순 교체하면 기존 action이 암묵적으로 제거된다.
해결: 하나의 확인 화면을 공유 라우터로 삼고, 공유된 원문을 보존한 채 사용자가 새 기능과 기존 기능을 선택하게 한다. 기존 화면의 설치·공유 안내도 새 경유 순서로 함께 갱신한다.
적용조건: 한 PWA가 같은 공유 URL로 캡처·저장·구독·채널 추가처럼 두 가지 이상 행동을 제공할 때.
출처프로젝트: focus-feed (youtube-summary)
태그: [pwa, web-share-target, routing, backward-compatibility, affordance]
발견일: 2026-08-01
출처DevLog: docs/devlog/2026-08-01-knowledge-capture-stabilization.md
---

## 확인 기준

- manifest에는 실제로 유지할 단일 action만 있다.
- 공유 확인 화면에서 모든 기존 주요 행동으로 갈 수 있다.
- 공유 입력 URL이 다음 화면까지 손실 없이 전달된다.
- 기존 도움말이 새 경유 흐름과 일치한다.
