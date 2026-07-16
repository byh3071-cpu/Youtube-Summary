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
  return panel;
}

test.describe("radio queue", () => {
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
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(playerBox!.y);
    await expect(panel.getByTestId("current-queue-item")).toBeVisible();
    await expect(panel.getByTestId("queue-item")).toHaveCount(2);
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

    await panel.getByTestId("current-queue-item").locator("button").click();
    await expect(panel.getByTestId("queue-item")).toHaveCount(1);

    await panel.getByRole("button", { name: "전체 비우기" }).click();
    await expect(page.getByTestId("radio-player")).toHaveCount(0);
    await expect(page.getByTestId("radio-queue-panel")).toHaveCount(0);
  });
});
