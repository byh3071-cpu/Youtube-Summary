import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { getSubscriptionPeriodEnd } from "./route";

// Stripe.Subscription 전체를 만들 필요 없이 조회 대상 필드만 담아 캐스팅한다.
function sub(shape: unknown): Stripe.Subscription {
  return shape as Stripe.Subscription;
}

describe("getSubscriptionPeriodEnd", () => {
  it("subscription item의 current_period_end를 우선 사용한다 (Stripe API 2025 라인)", () => {
    const result = getSubscriptionPeriodEnd(
      sub({ items: { data: [{ current_period_end: 1_800_000_000 }] } }),
    );
    expect(result).toBe(1_800_000_000);
  });

  it("item 값이 없으면 최상위 current_period_end로 폴백한다 (구버전 API 핀)", () => {
    const result = getSubscriptionPeriodEnd(
      sub({ items: { data: [] }, current_period_end: 1_700_000_000 }),
    );
    expect(result).toBe(1_700_000_000);
  });

  it("item과 최상위 값이 모두 없으면 null을 반환한다", () => {
    expect(getSubscriptionPeriodEnd(sub({ items: { data: [] } }))).toBeNull();
    expect(getSubscriptionPeriodEnd(sub({}))).toBeNull();
  });

  it("item 값이 우선이라 최상위 값이 있어도 item을 쓴다", () => {
    const result = getSubscriptionPeriodEnd(
      sub({ items: { data: [{ current_period_end: 1_900_000_000 }] }, current_period_end: 1_700_000_000 }),
    );
    expect(result).toBe(1_900_000_000);
  });
});
