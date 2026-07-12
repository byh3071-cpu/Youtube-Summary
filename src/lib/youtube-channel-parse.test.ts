import { describe, expect, it } from "vitest";
import { parseYouTubeChannelInput } from "@/lib/youtube-channel-parse";

const UC_ID = "UCUpJs89fSBXNolQGOYKn0YQ"; // UC + 22자

describe("parseYouTubeChannelInput — 채널 ID", () => {
  it("UC 형식 채널 ID를 그대로 인식한다", () => {
    expect(parseYouTubeChannelInput(UC_ID)).toEqual({ type: "channelId", channelId: UC_ID });
  });

  it("/channel/ URL에서 채널 ID를 추출한다", () => {
    expect(parseYouTubeChannelInput(`https://www.youtube.com/channel/${UC_ID}`)).toEqual({
      type: "channelId",
      channelId: UC_ID,
    });
  });

  it("채널 탭 URL(/channel/UC…/streams)도 채널 ID로 인식한다 — Phase 3 회귀 가드", () => {
    expect(parseYouTubeChannelInput(`https://www.youtube.com/channel/${UC_ID}/streams`)).toEqual({
      type: "channelId",
      channelId: UC_ID,
    });
  });
});

describe("parseYouTubeChannelInput — 핸들", () => {
  it("/@handle URL에서 핸들을 추출한다", () => {
    expect(parseYouTubeChannelInput("https://www.youtube.com/@jocoding")).toEqual({
      type: "handle",
      handle: "jocoding",
    });
  });

  it("핸들 탭 URL(/@handle/live, /@handle/videos)은 핸들로 인식한다 — Phase 3 회귀 가드", () => {
    expect(parseYouTubeChannelInput("https://www.youtube.com/@jocoding/live")).toEqual({
      type: "handle",
      handle: "jocoding",
    });
    expect(parseYouTubeChannelInput("https://www.youtube.com/@jocoding/videos")).toEqual({
      type: "handle",
      handle: "jocoding",
    });
  });

  it("퍼센트 인코딩된 한글 핸들 URL을 디코딩한다", () => {
    const encoded = encodeURIComponent("조코딩");
    expect(parseYouTubeChannelInput(`https://www.youtube.com/@${encoded}`)).toEqual({
      type: "handle",
      handle: "조코딩",
    });
  });

  it("@접두사 유무와 무관하게 단독 핸들을 인식한다", () => {
    expect(parseYouTubeChannelInput("@jocoding")).toEqual({ type: "handle", handle: "jocoding" });
    expect(parseYouTubeChannelInput("jocoding")).toEqual({ type: "handle", handle: "jocoding" });
    expect(parseYouTubeChannelInput("@조코딩")).toEqual({ type: "handle", handle: "조코딩" });
  });
});

describe("parseYouTubeChannelInput — 영상 URL", () => {
  const VIDEO = { type: "videoId", videoId: "dQw4w9WgXcQ" };

  it("watch·youtu.be·shorts·live·embed 링크에서 영상 ID를 추출한다", () => {
    expect(parseYouTubeChannelInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(VIDEO);
    expect(parseYouTubeChannelInput("https://youtu.be/dQw4w9WgXcQ")).toEqual(VIDEO);
    expect(parseYouTubeChannelInput("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual(VIDEO);
    expect(parseYouTubeChannelInput("https://www.youtube.com/live/dQw4w9WgXcQ")).toEqual(VIDEO);
    expect(parseYouTubeChannelInput("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual(VIDEO);
  });

  it("모바일·추가 파라미터·타임스탬프 붙은 링크도 처리한다", () => {
    expect(
      parseYouTubeChannelInput("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx"),
    ).toEqual(VIDEO);
    expect(
      parseYouTubeChannelInput("https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ"),
    ).toEqual(VIDEO);
    expect(parseYouTubeChannelInput("https://youtu.be/dQw4w9WgXcQ?t=42")).toEqual(VIDEO);
  });

  it("채널 URL이 영상보다 우선한다 — /channel/UC…/streams, /@handle/live는 채널", () => {
    const UC = "UCUpJs89fSBXNolQGOYKn0YQ";
    expect(parseYouTubeChannelInput(`https://www.youtube.com/channel/${UC}/streams`)).toEqual({
      type: "channelId",
      channelId: UC,
    });
    expect(parseYouTubeChannelInput("https://www.youtube.com/@jocoding/live")).toEqual({
      type: "handle",
      handle: "jocoding",
    });
  });

  it("11자 ID 검증 — 잘못된 길이는 영상으로 취급하지 않는다", () => {
    expect(parseYouTubeChannelInput("https://www.youtube.com/shorts/short")).toBeNull();
    expect(parseYouTubeChannelInput("https://youtu.be/toolongvideoid00")).toBeNull();
  });
});

describe("parseYouTubeChannelInput — 알려진 한계 (백로그)", () => {
  it("슬래시 없는 watch?v= 조각은 핸들로 오인된다 (문서화용 특성 테스트)", () => {
    expect(parseYouTubeChannelInput("watch?v=dQw4w9WgXcQ")).toEqual({
      type: "handle",
      handle: "watch?v=dQw4w9WgXcQ",
    });
  });
});

describe("parseYouTubeChannelInput — 무효 입력", () => {
  it("빈 문자열·공백·한 글자는 null", () => {
    expect(parseYouTubeChannelInput("")).toBeNull();
    expect(parseYouTubeChannelInput("   ")).toBeNull();
    expect(parseYouTubeChannelInput("a")).toBeNull();
  });
});
