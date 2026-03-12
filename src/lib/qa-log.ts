/**
 * Antigravity QA 확인용 로그. 브라우저 콘솔에서 [FocusFeed]로 필터하면 됨.
 * 개발/검증 시 동작 추적용.
 */
const PREFIX = "[FocusFeed]";

export const qaLog = {
  radio: {
    queueAdded: (videoId: string, title: string, hasSummary: boolean) => {
      console.log(`${PREFIX} [Radio] 라디오에 추가`, { videoId, title: title.slice(0, 30), hasSummary });
    },
    queueRemoved: (index: number, videoId: string) => {
      console.log(`${PREFIX} [Radio] 큐에서 제거`, { index, videoId });
    },
    currentIndexChanged: (index: number, title: string) => {
      console.log(`${PREFIX} [Radio] 재생 위치 변경`, { index, title: title.slice(0, 30) });
    },
    summaryUpdated: (videoId: string) => {
      console.log(`${PREFIX} [Radio] AI 요약 저장됨`, { videoId });
    },
    playerClosed: (queueLength: number) => {
      console.log(`${PREFIX} [Radio] 플레이어 닫힘 (큐 비움)`, { queueLength });
    },
    playlistDrawerOpen: (queueLength: number) => {
      console.log(`${PREFIX} [Radio] 플레이리스트 서랍 열림`, { queueLength });
    },
    playlistDrawerClose: () => {
      console.log(`${PREFIX} [Radio] 플레이리스트 서랍 닫힘`);
    },
    lyricsViewOpen: (hasSummary: boolean) => {
      console.log(`${PREFIX} [Radio] AI 요약 가사 뷰 열림`, { hasSummary });
    },
    lyricsViewClose: () => {
      console.log(`${PREFIX} [Radio] AI 요약 가사 뷰 닫힘`);
    },
    summaryFetchStart: (videoId: string) => {
      console.log(`${PREFIX} [Radio] 요약 불러오기 시작`, { videoId });
    },
    summaryFetchSuccess: (videoId: string) => {
      console.log(`${PREFIX} [Radio] 요약 불러오기 완료`, { videoId });
    },
    summaryFetchError: (videoId: string, message: string) => {
      console.warn(`${PREFIX} [Radio] 요약 불러오기 실패`, { videoId, message });
    },
    videoExpandOn: () => {
      console.log(`${PREFIX} [Radio] 미니 영상 켜짐 (인앱 시청)`);
    },
    videoExpandOff: () => {
      console.log(`${PREFIX} [Radio] 미니 영상 꺼짐`);
    },
    fullPlayerOpen: () => {
      console.log(`${PREFIX} [Radio] 전체 화면 영상 열림`);
    },
    fullPlayerClose: () => {
      console.log(`${PREFIX} [Radio] 전체 화면 영상 닫힘`);
    },
    playlistSaved: (queueLength: number) => {
      console.log(`${PREFIX} [Radio] 플레이리스트 저장됨`, { queueLength });
    },
  },
};
