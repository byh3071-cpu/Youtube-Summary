import { expect, test, type Page } from "@playwright/test";

async function gotoHydrated(page: Page, url = "/") {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]').waitFor({
    state: "visible",
    timeout: 30_000,
  });
}

test.describe("mobile shell regressions", () => {
  test("the full brand area opens the drawer without navigation loading", async ({ page }) => {
    await gotoHydrated(page);
    const header = page.getByTestId("mobile-header");
    const brand = header.getByTestId("mobile-brand-menu");
    const trigger = header.getByTestId("brand-menu-trigger");
    const brandBox = await brand.boundingBox();
    const triggerBox = await trigger.boundingBox();

    expect(brandBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.x).toBeCloseTo(brandBox!.x, 0);
    expect(triggerBox!.width).toBeCloseTo(brandBox!.width, 0);

    await page.mouse.click(
      brandBox!.x + brandBox!.width - 8,
      brandBox!.y + brandBox!.height / 2,
    );

    await expect(page.getByRole("dialog", { name: "메뉴" })).toBeVisible();
    await expect(page.locator('[role="status"]').filter({ hasText: "화면 불러오는 중" })).toHaveCount(0);
  });

  test("the main surface permits vertical pan and pinch zoom", async ({ page }) => {
    await gotoHydrated(page);
    const main = page.locator("main#main");
    await expect(main).toHaveCSS("touch-action", /pan-y/);
    await expect(main).toHaveCSS("touch-action", /pinch-zoom/);

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toMatch(/(?:^|,)\s*user-scalable\s*=\s*no\s*(?:,|$)/i);
    expect(viewport).not.toMatch(/(?:^|,)\s*maximum-scale\s*=\s*1(?:\.0+)?\s*(?:,|$)/i);
  });

  test("the active home link closes the drawer without navigation loading", async ({ page }) => {
    await gotoHydrated(page);
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByRole("dialog", { name: "메뉴" });
    const homeLink = drawer.getByRole("link", { name: "홈", exact: true });
    await expect(homeLink).toHaveAttribute("aria-current", "page");
    await homeLink.click();

    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe("/");
    await expect.poll(() => page.evaluate(() => location.search)).toBe("");
    await expect(page.locator('[role="status"]').filter({ hasText: "화면 불러오는 중" })).toHaveCount(0);
  });

  test("the active YouTube source closes the drawer without navigation loading", async ({ page }) => {
    await gotoHydrated(page, "/?source=UCCU2H8fnVx20POKCzFm-G5Q");
    await page.getByRole("button", { name: "메뉴 열기" }).click();

    const drawer = page.getByRole("dialog", { name: "메뉴" });
    const activeSource = drawer.locator('a[href="/?source=UCCU2H8fnVx20POKCzFm-G5Q"]');
    await expect(activeSource).toHaveAttribute("aria-current", "page");
    await activeSource.click();

    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => location.search)).toBe("?source=UCCU2H8fnVx20POKCzFm-G5Q");
    await expect(page.locator('[role="status"]').filter({ hasText: "화면 불러오는 중" })).toHaveCount(0);
  });

  test("the active RSS source closes the drawer without navigation loading", async ({ page }) => {
    const source = "https://news.hada.io/rss/news";
    await gotoHydrated(page, `/?source=${encodeURIComponent(source)}`);
    await page.getByRole("button", { name: "메뉴 열기" }).click();

    const drawer = page.getByRole("dialog", { name: "메뉴" });
    const activeSource = drawer.getByRole("link", { name: "GeekNews", exact: true });
    await expect(activeSource).toHaveAttribute("aria-current", "page");
    await activeSource.click();

    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get("source"))).toBe(source);
    await expect(page.locator('[role="status"]').filter({ hasText: "화면 불러오는 중" })).toHaveCount(0);
  });
});
