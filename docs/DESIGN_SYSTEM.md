---
id: focus-feed-design-system
date: 2026-07-12
tags: [focus-feed, design-system, ui, ux, tokens]
---

# Focus Feed 디자인 시스템 계약

## 1. 목적

Focus Feed는 다른 제품의 브랜드 외형을 복제하지 않는다. 각 제품이 잘 해결한 정보 구조와 상호작용 원칙을 가져와 Focus Feed의 콘텐츠 선별·라디오·AI 경험으로 재구성한다.

이 문서는 신규 UI와 리팩터링의 코드 리뷰 기준이다. 실제 시각 결정은 `docs/FOCUS_FEED_DESIGN_DECISION.html`, 근거 화면은 `docs/FOCUS_FEED_REFERENCE_BOARD.html`을 따른다.

## 2. 제품별 역할

| 영역 | 기준 제품 | 채택할 원칙 | 채택하지 않을 것 |
|---|---|---|---|
| 전체 앱 셸 | Apple | 여백, 정렬, 텍스트 계층, 조용한 사이드바 | 브랜드 자산, 과도한 glass |
| 홈 영상 | YouTube | 16:9 무테 카드, 2줄 제목, 채널·시간 메타 | 빨간 브랜드 CTA, 광고 구조 |
| 롱폼 | YouTube | 카드 탐색 → URL이 있는 상세 재생 | 세로 Reel 자동 넘김 |
| 숏폼 | YouTube Shorts | 9:16, 세로 스냅, 우측 액션 | 데스크톱 전체 폭 확대 |
| 라디오 | Spotify | 지속 플레이어, 큐, 현재 재생 중심 | Spotify 초록색·앨범 정보 모델 |
| AI 기능 | Focus Feed | 보라색 보조 행동, 선택 시 강조 | 콘텐츠보다 강한 기본 CTA |
| 재생 상태 | Focus Feed | 민트색 단일 의미 | 장식 목적의 민트 사용 |

## 3. 색상 토큰

신규 코드는 의미 기반 토큰을 사용한다. `--notion-*`은 기존 코드 이관을 위한 호환 별칭이며 새 컴포넌트에서 추가하지 않는다.

| 토큰 | 역할 |
|---|---|
| `--surface-canvas` | 페이지와 기본 콘텐츠 배경 |
| `--surface-raised` | 팝오버·플레이어·떠 있는 기능 레이어 |
| `--surface-subtle` | 조용한 구획·사이드바·비활성 배경 |
| `--surface-hover` | hover·선택 전 피드백 |
| `--text-primary` | 제목·핵심 정보 |
| `--text-secondary` | 메타·설명·보조 정보 |
| `--border-subtle` | 구획을 위한 최소 경계 |
| `--ai-accent` | AI 요약·인사이트 |
| `--playback-accent` | 재생·현재 항목·진행 상태 |
| `--youtube-accent` | YouTube 소스 구분 |
| `--rss-accent` | RSS 소스 구분 |

색상은 역할을 겸용하지 않는다. `ai-accent`를 일반 선택 상태나 장식 배경에 사용하지 않고, `playback-accent`를 성공 메시지에 사용하지 않는다.

## 4. 간격과 크기

- 기본 단위는 4px다.
- 화면 구조와 컴포넌트 간격은 8px 배수를 우선한다.
- 허용 토큰: `--space-1/2/3/4/6/8/12`.
- 포인터가 필요한 핵심 조작의 터치 영역은 최소 44×44px다.
- 텍스트와 아이콘만 있는 작은 시각 요소는 투명 hit area로 44px을 충족할 수 있다.

## 5. Radius

| 토큰 | 사용처 |
|---|---|
| `--radius-sm` (8px) | 썸네일 내부 배지·작은 제어 |
| `--radius-md` (12px) | 검색 입력·작은 카드 |
| `--radius-lg` (16px) | 패널·썸네일 |
| `--radius-xl` (24px) | 플레이어·큰 기능 레이어 |
| `--radius-full` | 칩·원형 버튼 |

콘텐츠 리스트를 모두 떠 있는 카드로 만들지 않는다. RSS는 플랫 행, YouTube는 무테 그리드를 기본으로 한다.

## 6. 텍스트 계층

한 화면에서 네 단계만 사용한다.

1. Display/Page: 페이지의 단일 대표 제목
2. Section: 콘텐츠 구역 제목
3. Content: 영상·기사 제목
4. Metadata: 채널, 날짜, 형식, 상태

콘텐츠 제목보다 버튼 라벨이 크거나 굵어서는 안 된다. 영상 제목은 최대 2줄, 메타는 1줄 truncate를 기본으로 한다.

## 7. 버튼 우선순위

1. Primary: 화면당 하나의 핵심 완료 행동
2. Secondary: 라디오 추가·저장 등 빈번한 보조 행동
3. Tertiary/Icon: 더보기·공유·상태
4. Contextual: hover·선택·패널 확장 때만 표시

AI 요약은 홈 카드에서 Secondary 또는 Contextual이다. 영상 콘텐츠보다 강한 전체 폭 Primary CTA로 사용하지 않는다.

## 8. 모션

| 토큰 | 용도 |
|---|---|
| `--motion-fast` (120ms) | hover·pressed |
| `--motion-standard` (180ms) | 패널·상태 전환 |
| `--motion-slow` (280ms) | 플레이어 확장·화면 문맥 변화 |

`prefers-reduced-motion: reduce`에서는 위치·스케일 모션을 제거하고 불투명도 변화도 최소화한다. 재생 진행률에는 transition을 사용하지 않는다.

## 9. 모드별 계약

- 홈: YouTube식 16:9 카드. 데스크톱 3~5열, 모바일 1열 기본.
- 롱폼: 목록에서 `/watch/[videoId]`로 진입. 자동재생과 세로 스냅 없음.
- 숏폼: 9:16 단일 캔버스, 세로 스냅, 우측 행동 레일.
- 라디오: 데스크톱 3구역 하단 바, 모바일 미니 바, 큐·확장 간 재생 상태 지속.
- RSS: 단일 소스 아이콘과 플랫 행. 중복 소스 라벨 없음.

## 10. 완료 게이트

각 UI 단위는 다음을 모두 충족해야 한다.

- `npm run lint`, `npm run test:unit`, `npm run build`, `npm run vhk:policy` 통과
- 라이트·다크 대비와 시스템 테마 불일치 조합 확인
- 360 / 393 / 768 / 1024 / 1440px에서 페이지 가로 오버플로 0px
- 키보드 focus-visible과 스크린리더 이름 확인
- 핵심 터치 타깃 44px 이상
- 변경 전후 Playwright 캡처 비교
- 기능·재생 상태 회귀 없음
