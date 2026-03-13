# [개발 가이드] Cursor를 위한 포커스 피드 고도화 구현 지침서

이 문서는 AI 에이전트(Cursor)가 '포커스 피드' 프로젝트를 고도화할 때, 기존의 기술 패턴을 유지하면서 최적의 효율로 기능을 구현할 수 있도록 돕는 기술 지침서입니다.

---

## 🛠️ 1. 핵심 기술 스택 및 패턴 (Current Patterns)

Cursor가 작업할 때 반드시 준수해야 할 기존 코드의 철학입니다.

-   **Server Actions**: 모든 AI 호출 분석 로직은 `src/app/actions/summarize.ts` 패턴을 따릅니다.
-   **Supabase Caching**: 비용 절감과 속도를 위해 AI 결과를 `summaries` 테이블에 캐싱하는 로직을 최우선으로 적용합니다. (Service Role Key 사용 적극 권장)
-   **UI Consistency**: Notion 스타일의 미니멀한 UI(`src/components/feed/FeedItem.tsx`)를 유지하며, Tailwind CSS 4의 변수 기반 스타일링을 사용합니다.
-   **Safe Fallback**: API 호출 실패 시 사용자 경험이 깨지지 않도록 에러 바운더리와 로딩 상태(`Suspense`)를 철저히 관리합니다.

---

## 📋 2. 단계별 구현 체크리스트 (Implementation Roadmap)

### Phase 1: 지능형 트렌드 및 개인화 (Intelligence)
1.  **AI 트렌드 레이더 API 구축**:
    -   `src/app/actions/trend.ts` 생성.
    -   최근 24시간 내 수집된 모든 피드 제목/요약을 Gemini Flash로 분석하여 상위 5개 키워드와 요약 정보 추출.
    -   결과를 `trend_cache` 테이블에 저장 (1시간 단위 갱신).
2.  **스마트 태깅 엔진**:
    -   피드 수집 시점에 AI가 카테고리를 추론하여 DB에 저장하는 로직 추가.
3.  **키워드 기반 브라우저 알림**:
    -   `Web Push API` 또는 `Simple Notification` 연동하여 사용자의 관심 키워드 매칭 시 알림 발송.

### Phase 2: 대화형 지식 탐색 (Interactive Knowledge)
1.  **피드 데이터 벡터화 (Embedding)**:
    -   `summaries`가 저장될 때 `text-embedding-004` 모델을 사용하여 벡터 생성.
    -   Supabase `pgvector` 확장을 사용하여 벡터 컬럼에 저장.
2.  **RAG 기반 챗봇 컴포넌트**:
    -   `src/components/chat/FeedChat.tsx` 사이드바 컴포넌트 추가.
    -   사용자 질문에 대해 벡터 검색을 수행하고, 관련 피드 내용을 컨텍스트로 Gemini Pro에 전달하여 답변 생성.

### Phase 3: 워크플로우 통합 (Workflow Integration)
1.  **외부 API 연동 모듈**:
    -   `src/lib/integrations/notion.ts`, `todoist.ts` 등 SDK 연동 코드 작성.
2.  **원클릭 전송 버튼**:
    -   `InsightButton.tsx` 옆에 `ActionExportButton` 추가하여 요약본을 즉시 외부로 전송하는 API Route 구축.

---

## 🚀 3. Cursor를 위한 작업 팁 (Efficiency Tips)

-   **타입 정의 우선**: 새로운 테이블이나 기능을 만들 때 `types/feed.ts` 또는 `lib/supabase-server.ts`의 Database 타입을 먼저 선언하면 전체적인 코드 안정성이 올라갑니다.
-   **기존 로직 재사용**: `rankFeedByGoalsAction` 함수(summarize.ts)는 피드 데이터를 AI에 전달하는 가장 효율적인 형식을 갖추고 있습니다. 새로운 AI 기능을 만들 때 이 형식을 참조하세요.
-   **빌드 체크**: 작업 후 반드시 `npm run lint`와 `npm run build`를 실행하여 타입 오류가 없는지 확인하세요.

---

## 🔒 4. 보안 및 성능 고려사항

-   **API Token 절약**: 불필요한 중복 호출을 막기 위해 모든 AI 로직 앞에 `maybeSingle()`을 통한 캐시 조회를 배치하세요.
-   **RLS 적용**: 사용자가 추가한 데이터(`custom_sources`, `bookmarks`)에 대해서는 `auth.uid() = user_id` 정책이 작동하도록 `createServerClient`를 사용하세요.

---

**준비 완료**: Cursor, 이제 이 가이드에 따라 **Phase 1: AI 트렌드 레이더**부터 순차적으로 구현을 시작해도 좋습니다.
