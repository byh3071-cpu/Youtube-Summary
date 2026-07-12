import { describe, it, expect } from "vitest";
import { clampTranscript, MAX_TRANSCRIPT_LINES, MAX_TRANSCRIPT_CHARS } from "./store";
import type { TranscriptLine } from "../video-transcript";

function lines(count: number, textLen = 10): TranscriptLine[] {
  return Array.from({ length: count }, (_, i) => ({ text: "x".repeat(textLen), offset: i }));
}

describe("clampTranscript", () => {
  it("상한 이하면 그대로 두고 joined를 재계산한다", () => {
    const input: TranscriptLine[] = [
      { text: "hello", offset: 0 },
      { text: "world", offset: 1 },
    ];
    const r = clampTranscript(input);
    expect(r.lines).toHaveLength(2);
    expect(r.joined).toBe("hello world");
  });

  it("라인 수 상한을 초과하면 잘라낸다", () => {
    const r = clampTranscript(lines(MAX_TRANSCRIPT_LINES + 500, 1));
    expect(r.lines.length).toBe(MAX_TRANSCRIPT_LINES);
  });

  it("총 글자 수 상한을 초과하면 그 지점에서 멈춘다", () => {
    // 라인당 1000자 → MAX_TRANSCRIPT_CHARS 넘기 전까지만 수용
    const r = clampTranscript(lines(MAX_TRANSCRIPT_LINES, 1000));
    const totalChars = r.lines.reduce((s, l) => s + l.text.length, 0);
    expect(totalChars).toBeLessThanOrEqual(MAX_TRANSCRIPT_CHARS);
    expect(r.lines.length).toBeLessThan(MAX_TRANSCRIPT_LINES); // char 상한이 먼저 걸림
  });

  it("빈 입력은 빈 결과", () => {
    expect(clampTranscript([])).toEqual({ lines: [], joined: "" });
  });
});
