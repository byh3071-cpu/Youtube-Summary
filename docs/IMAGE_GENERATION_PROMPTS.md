# Focus Feed 이미지 생성 프롬프트 (4종)

Gemini Pro 이미지 생성, DALL·E, Midjourney 등에 그대로 복사해 사용하세요.  
영어 프롬프트는 모델 호환용, 한글은 참고/수정용입니다.

---

## A. OG 이미지 (1200×630)

**용도:** SNS·메신저 공유 시 썸네일 (Open Graph)

**영어 프롬프트:**
```
Social share card image, 1200x630 pixels, 16:9 horizontal layout. Center: minimal app logo mark, similar to the existing Focus Feed logo: horizontal list lines on the left, 2–3 sound wave arcs in the middle, and a play triangle on the right, in mint green and dark gray on transparent. Below it, short tagline in clean sans-serif: "YouTube & RSS in one feed". Soft gradient background: light gray to very light mint or white, no harsh edges. No people, no photos. Flat design, high contrast for readability on mobile. Professional, calm, productivity app vibe.
```

**한글 참고:**  
중앙에 로고(왼쪽 리스트 라인, 가운데 음파, 오른쪽 플레이 삼각형, 민트/다크 그레이), 아래 짧은 카피 "유튜브·RSS를 한 곳에서". 배경은 연한 그라데이션(회색→민트/흰색). 플랫, 단정한 느낌.

**권장 설정:** 비율 1.91:1 또는 1200×630 지정.

---

## B. 랜딩/온보딩 히어로 (와이어프레임 일러스트)

**용도:** 메인/랜딩 상단 또는 온보딩 첫 화면

**영어 프롬프트:**
```
Product illustration for a feed reader app, wireframe style, isometric or flat 2D. Left side: 2–3 rounded rectangle cards stacked like a feed list, with simple line icons (play, document, calendar). Right side: a minimal "radio player" bar with waveform and play button, visually echoing the app logo (horizontal list lines on the left, sound wave arcs, play triangle on the right). Color: monochrome dark gray lines on very light gray or white background, with one accent color (mint green or soft blue) only on the play button and one card border. No text, no people. Clean, modern SaaS onboarding illustration, 16:9 or 4:3.
```

**한글 참고:**  
피드 카드 2~3개(라인 아이콘) + 오른쪽 미니 라디오 플레이어(왼쪽 리스트 느낌의 라인, 가운데 파형, 오른쪽 재생 버튼으로 로고를 떠올리게). 와이어프레임/라인 일러스트, 배경 연한 회색/흰색, 포인트 컬러는 민트 또는 블루만.

**권장 설정:** 가로형, 해상도 1200×675 또는 1600×900.

---

## C-1. Empty State – "콘텐츠 없음"

**용도:** 북마크/플레이리스트가 비었을 때

**영어 프롬프트:**
```
Empty state illustration for a reading or bookmark app. A single character or object: an open book with a small magnifying glass, or a minimal bookmark icon with a soft question mark. Line art style, thin strokes, monochrome dark gray on light gray or white background. One small accent in mint green. Friendly, calm, not sad. No text in the image. Centered composition, square or 4:3 format, plenty of negative space.
```

**한글 참고:**  
빈 책/북마크/돋보기 등 단일 오브젝트, 라인 아트, 연한 배경+포인트 컬러. 텍스트 없음, 여백 많게.

---

## C-2. Empty State – "필터 결과 없음"

**용도:** 키워드/필터 적용 시 해당하는 피드가 없을 때

**영어 프롬프트:**
```
Empty state illustration for a filter or search result. A funnel or filter icon with a soft "zero" or empty magnifying glass beside it. Minimal line art, thin dark gray strokes on light gray background, one mint or blue accent. Neutral, helpful mood. No text in the image. Centered, square or 4:3, lots of whitespace for UI text below.
```

**한글 참고:**  
필터/깔때기 또는 검색 아이콘 + 비어 있다는 느낌(빈 돋보기 등). 라인 아트, 여백 많게.

**권장 설정:** C-1, C-2 모두 512×512 또는 600×600 (카드 안에 넣기 좋음).

---

## D. 라디오/AI 아이콘 세트 (3~5개, 단색 라인/플랫)

**용도:** 라디오 플레이어, AI 요약, 브리핑 등 UI 아이콘

아래 5개를 **각각 한 장씩** 생성한 뒤, SVG 또는 PNG로 사용하세요.  
공통 스타일: `Line icon, single weight stroke, dark gray on transparent or white, 512x512, centered, no text.`

| 번호 | 아이콘 설명 | 영어 프롬프트 |
|------|-------------|----------------|
| D-1 | **라디오 재생 (로고 계열)** | `Line icon, single stroke, 512x512. A minimal \"radio\" or \"broadcast\" symbol similar to the Focus Feed logo: three horizontal list lines on the left, 2–3 sound wave arcs in the middle, and a play triangle on the right. Dark gray on white, centered, flat.` |
| D-2 | **AI/요약** | `Line icon, single stroke, 512x512. A lightbulb with a document or list lines inside, or a sparkle next to a paragraph symbol. Represents AI summary or insight. Dark gray on white, centered, flat.` |
| D-3 | **피드/리스트** | `Line icon, single stroke, 512x512. Stack of 3 horizontal lines (like a list or feed), with a small play or bookmark on the right. Dark gray on white, centered, flat.` |
| D-4 | **브리핑/요약** | `Line icon, single stroke, 512x512. A document or card with 2–3 short horizontal lines and a small check or star. Represents daily brief or summary. Dark gray on white, centered, flat.` |
| D-5 | **연결/동기화** | `Line icon, single stroke, 512x512. Two overlapping circles or two cards with a small link/chain icon between them. Represents sync or connection. Dark gray on white, centered, flat.` |

**공통 옵션:**  
생성 후 배경 제거(투명 PNG)하거나, 다크 모드용으로 흰색 라인 버전을 따로 만들면 좋습니다.

---

## 사용 팁 (실제 적용 경로)

- **OG 이미지(A):** `public/images/og/og-image.png` → `layout.tsx`의 `openGraph.images`에서 참조 중.
- **히어로(B):** `public/images/hero/hero-illustration3.png`, `hero-illustration_dark4.png` → `FeedHeader`에서 라이트/다크 전환.
- **Empty(C-1, C-2):**  
  - 북마크: `public/images/empty/Empty-bookmarks.png`, `Empty-bookmarks_dark.png` → `BookmarksClient`.  
  - 플레이리스트: `public/images/empty/Empty-playlists.png`, `Empty-playlists_dark.png` → `PlaylistsClient`.  
  - 필터 결과 없음: `public/images/empty/Empty-filter.png` → `FeedList` (필터 적용 시 결과 없을 때).
- **아이콘(D) – 적용 경로 및 사용처:** `ThemeIcon` 컴포넌트(`src/components/ui/ThemeIcon.tsx`)에서 `/images/icons/` 경로 사용.
  - **파일:** `Feed_List.png` · `Feed_List_dark.png` / `Play_the_radio.png` · `Play_the_radio_dark.png` / `AI_summary.png` · `AI_summary__dark.png` / `Connect_Sync.png` · `Connect_Sync_dark.png` / `a_briefing_summary.png`
  - **적용:** 라디오 푸터(재생·재생목록·AI요약) → Play_the_radio, Feed_List, AI_summary / 사이드바·모바일 메뉴 "전체 피드" → Feed_List / AI 3줄 요약·인사이트 버튼 → AI_summary / 라디오에 추가 버튼 → Play_the_radio

필요하면 프롬프트를 서비스 톤(예: 더 차갑게/따뜻하게)에 맞춰 한두 문장만 수정해 쓰시면 됩니다.
