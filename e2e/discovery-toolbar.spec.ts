import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function openDiscovery(page: Page) {
  // 트렌드 서버 컴포넌트는 외부 분석 결과를 스트리밍할 수 있어 전체 load 이벤트를 기다리지 않는다.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "피드 탐색" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("피드 검색")).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test.describe("search-first discovery toolbar", () => {
  test("desktop keeps search, trends and filters in one ordered panel", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openDiscovery(page);

    const panel = page.getByRole("region", { name: "피드 탐색" });
    const search = page.getByLabel("피드 검색");
    const trends = page.getByText("요즘 뜨는 키워드", { exact: true });
    const sourceSwitch = page.getByRole("button", { name: "전체(최신순)" });

    const [panelBox, searchBox, sourceBox] = await Promise.all([
      panel.boundingBox(),
      search.boundingBox(),
      sourceSwitch.boundingBox(),
    ]);
    expect(panelBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(sourceBox).not.toBeNull();
    expect(searchBox!.y).toBeLessThan(sourceBox!.y);
    expect(searchBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
    expect(searchBox!.x + searchBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);

    // 트렌드는 외부 분석 스트림이라 늦게 도착할 수 있다. 렌더된 경우 검색과 보기 전환 사이인지 확인한다.
    if (await trends.count()) {
      const trendsBox = await trends.boundingBox();
      expect(trendsBox).not.toBeNull();
      expect(searchBox!.y).toBeLessThan(trendsBox!.y);
      expect(trendsBox!.y).toBeLessThan(sourceBox!.y);
    }

    // 삭제 요청된 글로벌 카운트·수동 새로고침 헤더는 더 이상 노출하지 않는다.
    await expect(page.getByText(/^총 \d+개$/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "새로고침" })).toHaveCount(0);

    const startedAt = Date.now();
    await page.getByRole("button", { name: "유튜브", exact: true }).click();
    await expect(page.getByRole("button", { name: "유튜브", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(Date.now() - startedAt).toBeLessThan(1_000);

    await capture(page, testInfo, "discovery-desktop");
  });

  test("393px mobile has no page-level horizontal overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await openDiscovery(page);

    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);

    await expect(page.getByRole("button", { name: "전체(최신순)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "필터 패널 열기" })).toBeVisible();
    await capture(page, testInfo, "discovery-mobile-393");
  });
});
