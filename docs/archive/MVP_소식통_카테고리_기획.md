# MVP: 소식통 + 카테고리 필터 기획

## 1. MVP 한 문장 (확정)

> **"내가 고른 유튜브 채널과 뉴스/RSS를 최신순으로 한 화면에 보여주고,  
>  소스별(유튜브 | RSS/뉴스)로 소식통처럼 따로따로 올라오는 걸 보여주며,  
>  AI·자기계발 같은 카테고리로 분류해서 필터로 볼 수 있는 앱"**

---

## 2. 현재 코드에서 유튜브/뉴스 불러오는 위치

| 역할 | 파일 | 설명 |
|------|------|------|
| **소스 목록 정의** | `src/lib/sources.ts` | `defaultSources`: 유튜브 채널 ID·이름, RSS URL·이름. 여기에 **카테고리** 추가 예정. |
| **유튜브 API 호출** | `src/lib/youtube.ts` | `fetchYouTubeFeed(channelId, sourceName)` → 채널 최신 영상 목록 → `FeedItem[]`. |
| **RSS 파싱** | `src/lib/rss.ts` | `fetchRssFeed(url, sourceName)` → RSS 항목 → `FeedItem[]`. |
| **병합·정렬** | `src/lib/feed.ts` | `getMergedFeed()`: 유튜브 + RSS 병합, 최신순 정렬, 중복 제거. |
| **키워드 필터** | `src/lib/filter.ts` | `filterFeedByKeywords(items, keywords)`: 제목·요약·출처명 기준 필터. **카테고리 필터**는 여기 또는 새 함수로 추가. |
| **타입** | `src/types/feed.ts` | `FeedItem`, `YouTubeChannel`. `FeedItem`에 `category` 연결은 소스 기준으로 가능. |
| **페이지·데이터** | `src/app/page.tsx` | `getMergedFeed()` 호출, `source` 쿼리로 단일 소스 필터, `FeedClientContainer`에 `initialItems` 전달. |
| **피드 UI** | `src/components/feed/FeedClientContainer.tsx` | 키워드 필터 상태, 필터 UI, `FeedList`에 `filteredItems` 전달. |
| **리스트·아이템** | `src/components/feed/FeedList.tsx`, `FeedItem.tsx` | 한 줄 리스트 렌더. **소식통**은 여기서 섹션/컬럼 분리. |
| **사이드바** | `src/components/layout/Sidebar.tsx` | YouTube / RSS 소스 목록, `?source=id` 링크. **카테고리** 메뉴 추가 가능. |

---

## 3. 구체 작업 리스트 (개발 TODO)

### Phase A: 카테고리 데이터 + 필터

- [x] **A1.** `src/types/feed.ts`  
  - 카테고리 식별자 타입 추가 (예: `export type FeedCategory = "AI" | "자기계발" | "개발" | "뉴스" | "기타";`).
- [x] **A2.** `src/lib/sources.ts`  
  - `FeedSource`에 `category: FeedCategory` 필드 추가.  
  - `defaultSources` 각 항목에 `category` 지정 (예: 노마드 코더·테디노트 → `"개발"`, OpenAI Blog → `"AI"`, GeekNews → `"뉴스"`, 일잘러·드로우앤드류 → `"자기계발"` 등).
- [x] **A3.** `src/types/feed.ts`
  - `FeedItem`에 `category?: FeedCategory` 추가 (소스에서 복사해서 채움).
- [x] **A4.** `src/lib/feed.ts`
  - 병합 시 각 아이템에 `source`의 `category` 할당.
- [x] **A5.** `src/lib/filter.ts`
  - `filterFeedByCategory(items, category)` 추가. 선택된 카테고리만 보여주기.
- [x] **A6.** UI: 카테고리 필터
  - `FeedClientContainer` 또는 상단에 "전체 | AI | 자기계발 | 개발 | 뉴스" 토글/버튼 추가.
  - 선택 시 `filterFeedByCategory` 적용 (기존 키워드 필터와 동시 적용 가능).

### Phase B: 소식통 레이아웃 (소스별로 따로따로)

- [x] **B1.** `src/components/feed/FeedList.tsx` (또는 새 컴포넌트)
  - `items`를 `source` 기준으로 그룹: `YouTube` / `RSS` 두 그룹.
- [x] **B2.** 레이아웃 선택 (택 1 또는 조합)
  - **옵션 1** 적용: 한 페이지에 섹션 2개 — "유튜브 최신" / "RSS·뉴스 최신" 블록을 위아래로.
- [x] **B3.** 각 블록 안에서는 **최신순** 유지 (이미 `getMergedFeed`에서 정렬됨, 그룹만 나누면 됨).
- [x] **B4.** 빈 그룹 처리: 유튜브만 없거나 RSS만 없을 때 빈 상태 메시지.

### Phase C: URL·사이드바와 연동

- [x] **C1.** `src/app/page.tsx`
  - `searchParams`에 `category` 추가 (예: `?category=AI`).
  - `category`가 있으면 초기 필터로 적용.
- [x] **C2.** `src/components/layout/Sidebar.tsx`
  - "카테고리" 섹션 추가: 전체, AI, 자기계발, 개발, 뉴스 링크 (`/?category=AI` 등).
  - 기존 YouTube / RSS 소스 목록은 유지.

### Phase D: 검증·문서

- [ ] **D1.** 브라우저 검증: 소스별 블록에 최신순으로 잘 나오는지, 카테고리 전환 시 필터가 맞는지.
- [x] **D2.** `README.md` 또는 `docs/`에 "소식통 보기" / "카테고리 필터" 사용법 한 줄 추가.
- [x] **D3.** `AI_COLLABORATION.md` 브라우저 체크리스트에 "카테고리 필터", "소식통(유튜브/RSS 분리) 표시" 항목 추가.

---

## 4. 이번에 바로 손대기 좋은 순서 (권장)

1. **A1 → A2 → A3 → A4** (카테고리 타입·소스·아이템·병합)
2. **A5 → A6** (카테고리 필터 로직 + UI)
3. **B1 → B2** (소스별 그룹 + 소식통 레이아웃)
4. **B3, B4** (정렬·빈 상태)
5. **C1, C2** (URL·사이드바)
6. **D1 ~ D3** (검증·문서)

원하면 Phase A부터 바로 코드 수정 들어갈 수 있음.
