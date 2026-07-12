import { describe, expect, it } from "vitest";
import {
  compactCustomSources,
  filterValidSources,
  getCustomSourcesFromCookie,
  mergeCustomSources,
} from "@/lib/custom-sources-cookie";
import type { FeedSource } from "@/lib/sources";

const src = (id: string, name = `채널-${id}`): FeedSource => ({
  id,
  name,
  type: "YouTube",
  category: "기타",
});

describe("getCustomSourcesFromCookie", () => {
  it("서버가 구운 plain JSON 형식을 파싱한다", () => {
    const list = [src("UCaaaaaaaaaaaaaaaaaaaaaa")];
    expect(getCustomSourcesFromCookie(JSON.stringify(list))).toEqual(list);
  });

  it("구형 클라이언트의 percent-encoded 형식을 파싱한다", () => {
    const list = [src("UCbbbbbbbbbbbbbbbbbbbbbb", "한글 채널")];
    const encoded = encodeURIComponent(JSON.stringify(list));
    expect(getCustomSourcesFromCookie(encoded)).toEqual(list);
  });

  it("이름에 % 문자가 있는 plain JSON도 파싱한다 (decode 실패 → raw 폴백)", () => {
    const list = [src("UCcccccccccccccccccccccc", "100% 개발")];
    expect(getCustomSourcesFromCookie(JSON.stringify(list))).toEqual(list);
  });

  it("빈 값·손상 JSON·빈 배열은 빈 목록을 반환한다", () => {
    expect(getCustomSourcesFromCookie(undefined)).toEqual([]);
    expect(getCustomSourcesFromCookie("")).toEqual([]);
    expect(getCustomSourcesFromCookie("{broken")).toEqual([]);
    expect(getCustomSourcesFromCookie("[]")).toEqual([]);
  });

  it("YouTube 타입이 아닌 항목은 걸러낸다", () => {
    const mixed = [src("UCdddddddddddddddddddddd"), { ...src("x"), type: "RSS" }];
    expect(getCustomSourcesFromCookie(JSON.stringify(mixed))).toEqual([
      src("UCdddddddddddddddddddddd"),
    ]);
  });
});

describe("filterValidSources", () => {
  it("필수 필드가 빠진 항목을 걸러낸다", () => {
    const input = [
      src("UCeeeeeeeeeeeeeeeeeeeeee"),
      { id: "no-name", type: "YouTube", category: "기타" },
      { id: 123, name: "숫자 id", type: "YouTube", category: "기타" },
      null,
      "문자열",
    ];
    expect(filterValidSources(input)).toEqual([src("UCeeeeeeeeeeeeeeeeeeeeee")]);
  });

  it("배열이 아니면 빈 목록", () => {
    expect(filterValidSources({ id: "x" })).toEqual([]);
    expect(filterValidSources(null)).toEqual([]);
  });
});

describe("mergeCustomSources", () => {
  it("id 기준으로 중복을 제거하고 기존 항목을 유지한다", () => {
    const a = src("UCffffffffffffffffffffff", "기존 이름");
    const aDup = src("UCffffffffffffffffffffff", "새 이름");
    const b = src("UCgggggggggggggggggggggg");
    expect(mergeCustomSources([a], [aDup, b])).toEqual([a, b]);
  });

  it("빈 목록끼리 병합해도 안전하다", () => {
    expect(mergeCustomSources([], [])).toEqual([]);
    expect(mergeCustomSources([], [src("UChhhhhhhhhhhhhhhhhhhhhh")])).toEqual([
      src("UChhhhhhhhhhhhhhhhhhhhhh"),
    ]);
  });
});

describe("compactCustomSources", () => {
  it("쿠키 부피를 줄이기 위해 avatarUrl을 제거한다", () => {
    const withAvatar: FeedSource = {
      ...src("UCiiiiiiiiiiiiiiiiiiiiii"),
      avatarUrl: "https://yt3.ggpht.com/very-long-url",
    };
    expect(compactCustomSources([withAvatar])).toEqual([
      { id: withAvatar.id, name: withAvatar.name, type: "YouTube", category: "기타" },
    ]);
  });
});
