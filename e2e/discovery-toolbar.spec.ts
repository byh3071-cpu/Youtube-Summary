import { expect, test } from "@playwright/test";

test.describe("discovery toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const toolbar = page.getByTestId("discovery-toolbar");
    await expect(toolbar).toBeVisible({ timeout: 30_000 });
    await expect(toolbar).toHaveAttribute("data-hydrated", "true", { timeout: 30_000 });
  });

  test("switches cached source views without a document navigation", async ({ page }) => {
    let documentRequests = 0;
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests += 1;
    });

    for (const view of ["rss", "youtube", "all"] as const) {
      const startedAt = performance.now();
      await page.getByTestId(`view-${view}`).click();
      await expect(page.getByTestId(`view-${view}`)).toHaveAttribute("aria-pressed", "true");
      expect(performance.now() - startedAt).toBeLessThan(1_000);
    }

    expect(documentRequests).toBe(0);
  });

  test("opens a responsive filter surface", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.getByTestId("discovery-filter-trigger").click();
    const sheet = page.getByTestId("discovery-filter-panel");
    await expect(sheet).toBeVisible();
    const mobileBox = await sheet.boundingBox();
    expect(mobileBox).not.toBeNull();
    expect(mobileBox!.width).toBeCloseTo(393, 0);
    expect(mobileBox!.y + mobileBox!.height).toBeCloseTo(852, 0);

    await page.getByRole("button", { name: "닫기" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByTestId("discovery-filter-trigger").click();
    const panel = page.getByTestId("discovery-filter-panel");
    const desktopBox = await panel.boundingBox();
    expect(desktopBox).not.toBeNull();
    expect(desktopBox!.width).toBeCloseTo(400, 0);
    expect(desktopBox!.x + desktopBox!.width).toBeCloseTo(1440, 0);
  });

  test("filters search results without horizontal overflow", async ({ page }) => {
    const cards = page.getByTestId("youtube-card");
    const initialCount = await cards.count();
    await page.getByTestId("feed-search-input").fill("Cloudflare");
    await expect.poll(() => cards.count()).toBeLessThan(initialCount);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
