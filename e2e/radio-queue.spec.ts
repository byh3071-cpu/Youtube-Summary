import { expect, test, type Page } from "@playwright/test";

async function setupQueue(page: Page, count = 3) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]').waitFor({ state: "visible", timeout: 30_000 });
  for (let index = 0; index < count; index += 1) {
    await page.locator('button[aria-label="라디오에 추가"]:visible').first().click();
  }
  await expect(page.getByTestId("radio-player")).toBeVisible();
}

async function openQueue(page: Page, mobile = false) {
  const player = page.getByTestId("radio-player");
  await player.locator(`button[aria-label="${mobile ? "재생 대기열 열기" : "재생 목록"}"]:visible`).first().click();
  const panel = page.getByTestId("radio-queue-panel");
  await expect(panel).toBeVisible();
  await expect
    .poll(() =>
      panel.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none" ? 0 : Math.abs(new DOMMatrix(transform).m42);
      })
    )
    .toBeLessThan(1);
  return panel;
}

test.describe("radio queue", () => {
  test("opening the queue does not shift fixed player controls", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupQueue(page, 1);
    const labels = ["이전 곡", "일시정지", "다음 곡", "재생 목록", "AI 요약 보기", "미니 영상 켜기", "전체 화면 영상", "플레이어 닫기"];
    const controls = labels.map((label) => page.getByRole("button", { name: label, exact: true }));
    const centers = async () =>
      Promise.all(
        controls.map(async (control) => {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
        })
      );

    const before = await centers();
    const beforeScrollbarGap = await page.evaluate(
      () => Math.max(0, window.innerWidth - document.documentElement.clientWidth)
    );
    await openQueue(page);
    const after = await centers();

    const lockMetrics = await page.evaluate(() => ({
      bodyPaddingRight: document.body.style.paddingRight,
      fixedGap: getComputedStyle(document.body).getPropertyValue("--scrollbar-lock-gap").trim(),
    }));
    expect(lockMetrics.bodyPaddingRight).toBe(`${beforeScrollbarGap}px`);
    expect(lockMetrics.fixedGap).toBe(`${beforeScrollbarGap}px`);

    after.forEach((center, index) => {
      expect(center.x).toBeCloseTo(before[index].x, 0);
      expect(center.y).toBeCloseTo(before[index].y, 0);
    });

    await page.getByRole("button", { name: "대기열 닫기" }).click();
    await expect(page.getByTestId("radio-queue-panel")).toHaveCount(0);
    await page.getByRole("button", { name: "AI 요약 보기" }).click();
    await expect(page.getByRole("dialog", { name: "AI 요약" })).toBeVisible();
    const afterSummary = await centers();
    afterSummary.forEach((center, index) => {
      expect(center.x).toBeCloseTo(before[index].x, 0);
      expect(center.y).toBeCloseTo(before[index].y, 0);
    });

    await page.getByRole("dialog", { name: "AI 요약" }).getByRole("button", { name: "닫기" }).click();
    await expect(page.getByRole("dialog", { name: "AI 요약" })).toHaveCount(0);
    await page.getByRole("button", { name: "필터 열기" }).click();
    await expect(page.getByRole("dialog", { name: "상세 필터" })).toBeVisible();
    const afterFilter = await centers();
    afterFilter.forEach((center, index) => {
      expect(center.x).toBeCloseTo(before[index].x, 0);
      expect(center.y).toBeCloseTo(before[index].y, 0);
    });
  });

  test("mobile sheet stays above the player and inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await setupQueue(page);
    const panel = await openQueue(page, true);
    const player = page.getByTestId("radio-player");
    const panelBox = await panel.boundingBox();
    const playerBox = await player.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(playerBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(393);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(playerBox!.y + 1);
    await expect(panel.getByTestId("current-queue-item")).toBeVisible();
    await expect(panel.getByTestId("queue-item")).toHaveCount(2);
    if (process.env.CAPTURE_UI === "1") {
      await panel.screenshot({ path: "test-results/radio-queue-panel-393.png" });
    }
  });

  test("selection, current removal and clear keep queue state consistent", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupQueue(page);
    let panel = await openQueue(page);

    await panel.getByTestId("queue-item").first().locator("button").first().click();
    await expect(panel).toBeHidden();
    panel = await openQueue(page);
    await expect(panel.locator('[aria-labelledby="next-radio-items"] [data-testid="queue-item"]')).toHaveCount(1);
    await expect(panel.locator('[aria-labelledby="previous-radio-items"] [data-testid="queue-item"]')).toHaveCount(1);

    await panel
      .getByTestId("current-queue-item")
      .getByRole("button", { name: /목록에서 제거/ })
      .click();
    await expect(panel.getByTestId("queue-item")).toHaveCount(1);

    await panel.getByRole("button", { name: "전체 비우기" }).click();
    await expect(page.getByTestId("radio-player")).toHaveCount(0);
    await expect(page.getByTestId("radio-queue-panel")).toHaveCount(0);
  });

  test("desktop drag reorders the queue without changing the playing item", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupQueue(page, 4);
    const panel = await openQueue(page);
    const current = panel.getByTestId("current-queue-item");
    const currentTitle = (await current.locator("p").textContent())?.trim();
    const firstNext = panel
      .locator('[aria-labelledby="next-radio-items"] [data-testid="queue-item"]')
      .first();

    await expect(current).toHaveAttribute("data-queue-index", "0");
    await firstNext.dragTo(current);

    await expect(current).toHaveAttribute("data-queue-index", "1");
    await expect(current.locator("p")).toHaveText(currentTitle ?? "");
    await expect(panel).toContainText("현재 2번째");
    if (process.env.CAPTURE_UI === "1") {
      await panel.screenshot({ path: "test-results/radio-queue-panel-1440.png" });
    }
  });

  test("move buttons preserve the current item and expose 44px mobile targets", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await setupQueue(page, 4);
    const panel = await openQueue(page, true);
    const current = panel.getByTestId("current-queue-item");
    const currentTitle = (await current.locator("p").textContent())?.trim();
    const moveBack = current.getByRole("button", { name: /한 칸 뒤로 이동/ });

    const targetBox = await moveBack.boundingBox();
    expect(targetBox).not.toBeNull();
    expect(targetBox!.width).toBeGreaterThanOrEqual(44);
    expect(targetBox!.height).toBeGreaterThanOrEqual(44);

    await moveBack.click();
    await expect(current).toHaveAttribute("data-queue-index", "1");
    await expect(current.locator("p")).toHaveText(currentTitle ?? "");
    await expect(panel).toContainText("현재 2번째");

    const overflow = await panel.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
