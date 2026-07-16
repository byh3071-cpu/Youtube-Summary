import { describe, it, expect } from "vitest";
import { evaluateUsageLimit } from "./usage-limits";

describe("evaluateUsageLimit", () => {
  it("DB 오류면 fail-closed로 차단한다(ok:false) — 조회 실패가 무제한 허용으로 새지 않게", () => {
    // count가 한도 미만이어도 dbError면 차단
    expect(evaluateUsageLimit(0, 5, true)).toEqual({ ok: false });
  });

  it("한도 미만이면 허용(over:false)", () => {
    expect(evaluateUsageLimit(3, 5, false)).toEqual({ ok: true, over: false });
  });

  it("한도 도달/초과면 over:true", () => {
    expect(evaluateUsageLimit(5, 5, false)).toEqual({ ok: true, over: true });
    expect(evaluateUsageLimit(6, 5, false)).toEqual({ ok: true, over: true });
  });

  it("주간 브리핑처럼 한도 1도 정확히 판정", () => {
    expect(evaluateUsageLimit(0, 1, false)).toEqual({ ok: true, over: false });
    expect(evaluateUsageLimit(1, 1, false)).toEqual({ ok: true, over: true });
  });
});
