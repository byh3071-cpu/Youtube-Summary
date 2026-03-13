/** 자막 기반 3줄 요약 프롬프트 */
export const SUMMARY_PROMPT_CAPTION = (text: string) =>
  `다음은 유튜브 영상의 자막입니다. 영상을 직접 보지 않고 라디오처럼 듣기만 하는 직장인을 위해, 불필요한 서론을 빼고 핵심 정보(팩트 단위) 3가지를 명확하게 요약해주세요.\n\n자막 내용:\n${text.slice(0, 15000)}`;

/** 제목·설명 기반 3줄 요약 프롬프트 */
export const SUMMARY_PROMPT_SNIPPET = (text: string) =>
  `다음은 유튜브 영상의 제목과 설명입니다. 핵심 내용을 3줄 이내로 요약해주세요.\n\n내용:\n${text.slice(0, 15000)}`;

/** 인사이트 정리 프롬프트 */
export const INSIGHT_PROMPT = (text: string) =>
  `다음은 유튜브 영상의 내용입니다. 이 영상을 끝까지 본 시청자가
- 오늘 무엇을 배웠는지,
- 앞으로 일/공부/삶에 어떻게 적용하면 좋을지
정리할 수 있도록 도와주세요.

요구사항:
1) 영상에서 건질 만한 핵심 인사이트 3가지를, 한 줄씩 bullet로 정리
2) 한국 직장인/개발자/지식 노동자가 1주일 안에 실제로 시도해볼 수 있는 구체적인 액션 2가지를 bullet로 제안
3) 말투는 부담스럽지 않은 동료 느낌으로, 존댓말 한국어 사용

영상 내용:
${text.slice(0, 15000)}`;

/** 사용자의 목표/관심사 시스템 프롬프트 */
export const getSystemGoalPrompt = (goalText: string) =>
  `사용자의 목표/관심사:\n${goalText}\n\n이 사람은 1인 기업/프리랜서 시각에서, 오늘 당장 도움이 될 영상/글 위주로 우선순위를 정해줘야 합니다.`;

/** 피드 랭킹/브리핑 프롬프트 */
export const getRankingPrompt = (systemGoal: string, itemsPayload: string[], limit: number) => `
${systemGoal}

아래는 오늘 후보가 될 수 있는 콘텐츠 목록입니다. 각 JSON은 하나의 콘텐츠를 나타냅니다.

후보 목록:
${itemsPayload.join("\n")}

요구사항:
1) 사용자의 목표/관심사에 얼마나 직접적으로 도움이 되는지 기준으로 우선순위를 매기세요.
2) 가장 중요한 것부터 정렬해서 최대 ${Math.min(10, limit)}개만 선택하세요.
3) 각 항목에 대해:
   - priority: 1부터 시작하는 순위 (1이 가장 중요)
   - score: 1~100 사이 숫자로 중요도/적합도 점수
   - why: 이 사람이 이 콘텐츠를 지금 봐야 하는 이유 (한국어, 1~2문장)
   - action: 이 콘텐츠를 본 뒤 1주일 안에 실행해볼 수 있는 구체적인 액션 (한국어, 1문장)

반드시 아래 형식의 JSON만, 다른 자연어 설명이나 마크다운 없이 반환하세요:
{
  "items": [
    {
      "id": "<위 JSON 중 하나의 id>",
      "priority": 1,
      "score": 95,
      "why": "...",
      "action": "..."
    }
  ]
}
`;

/** 지능형 트렌드 레이더 프롬프트 */
export const getTrendRadarPrompt = (itemsPayload: string[]) => `
너는 뉴스/콘텐츠 트렌드 분석 전문가다.

아래는 최근 24시간 안에 올라온 유튜브·RSS 콘텐츠 목록이다. 각 줄은 하나의 JSON이며, title / sourceName / category / summary 필드를 가진다.

콘텐츠 목록:
${itemsPayload.join("\n")}

요구사항:
1) 위 콘텐츠들을 분석해, 서로 연관된 것들을 묶어서 상위 5개 이내의 "트렌드 키워드"를 뽑아라.
2) 각 트렌드는 아래 정보를 포함해야 한다.
   - keyword: 한국어로 2~6자 정도의 짧은 트렌드 이름 (예: "AI 에이전트", "Claude 업데이트")
   - score: 0~100 사이 숫자 (최근 24시간 기준 중요도/빈도)
   - summary: 이 트렌드가 무엇을 의미하는지, 왜 중요한지 한국어 1~2문장 설명
   - sampleTitles: 이 트렌드와 가장 잘 맞는 콘텐츠 제목 2~4개 (원문 제목 그대로)
3) 너무 일반적인 단어(예: "AI", "뉴스") 대신, 사용자가 오늘의 흐름을 한눈에 파악할 수 있는 구체적인 키워드를 사용하라.

반드시 아래 형식의 JSON만, 다른 자연어 설명이나 마크다운 없이 반환하라:
{
  "trends": [
    {
      "keyword": "예시 트렌드",
      "score": 87,
      "summary": "...",
      "sampleTitles": ["...", "..."]
    }
  ]
}
`;
