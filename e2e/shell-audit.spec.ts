import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 393, height: 852 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
] as const;

async function openHydratedHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("youtube-card").first()).toBeVisible({ timeout: 30_000 });
}

async function expectInsideViewport(locator: Locator, width: number, height: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
}

test.describe("SHELL-02 responsive and accessibility audit", () => {
  test("home shell stays inside every contracted viewport", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await openHydratedHome(page);

      const shellState = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        duplicateIds: [...document.querySelectorAll("[id]")]
          .map((element) => element.id)
          .filter((id, index, ids) => id && ids.indexOf(id) !== index),
        missingImageAlts: [...document.querySelectorAll("img")]
          .filter((image) => !image.hasAttribute("alt"))
          .map((image) => image.currentSrc || image.src),
        buttonsWithoutType: [...document.querySelectorAll("button:not([type])")]
          .map((button) => button.getAttribute("aria-label") || button.textContent?.trim() || "unnamed"),
        positiveTabIndexes: [...document.querySelectorAll("[tabindex]")]
          .filter((element) => Number(element.getAttribute("tabindex")) > 0).length,
        unnamedDialogs: [...document.querySelectorAll('[role="dialog"]')]
          .filter((dialog) => !dialog.getAttribute("aria-label") && !dialog.getAttribute("aria-labelledby")).length,
        unlabeledControls: [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")]
          .filter((control) => control.labels?.length === 0 && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby"))
          .map((control) => control.outerHTML.slice(0, 120)),
        lang: document.documentElement.lang,
        mainCount: document.querySelectorAll("main").length,
      }));

      expect(shellState.overflow, `${viewport.width}px horizontal overflow`).toBeLessThanOrEqual(0);
      expect(shellState.duplicateIds, `${viewport.width}px duplicate ids`).toEqual([]);
      expect(shellState.missingImageAlts, `${viewport.width}px images without alt`).toEqual([]);
      expect(shellState.buttonsWithoutType, `${viewport.width}px buttons without explicit type`).toEqual([]);
      expect(shellState.positiveTabIndexes, `${viewport.width}px positive tabindex`).toBe(0);
      expect(shellState.unnamedDialogs, `${viewport.width}px unnamed dialogs`).toBe(0);
      expect(shellState.unlabeledControls, `${viewport.width}px unlabeled form controls`).toEqual([]);
      expect(shellState.lang).toBe("ko");
      expect(shellState.mainCount).toBe(1);

      if (viewport.width < 1024) {
        await expect(page.getByTestId("mobile-header")).toBeVisible();
        await expect(page.getByTestId("desktop-sidebar")).toBeHidden();
        await expectInsideViewport(page.getByTestId("mobile-header"), viewport.width, viewport.height);
      } else {
        await expect(page.getByTestId("desktop-sidebar")).toBeVisible();
        await expect(page.getByTestId("mobile-header")).toBeHidden();
        await expectInsideViewport(page.getByTestId("desktop-sidebar"), viewport.width, viewport.height);
      }

      await expectInsideViewport(page.getByRole("button", { name: "피드 Q&A 열기" }), viewport.width, viewport.height);
    }
  });

  test("core controls keep names, focus visibility, and 44px touch size", async ({ page }) => {
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2]]) {
      await page.setViewportSize(viewport);
      await openHydratedHome(page);

      const controls = [
        page.getByTestId("brand-menu-trigger"),
        page.getByTestId("view-all"),
        page.getByTestId("view-youtube"),
        page.getByTestId("view-rss"),
        page.getByTestId("discovery-filter-trigger"),
        page.getByRole("button", { name: "피드 Q&A 열기" }),
      ];
      const trendChip = page.getByTestId("trend-chip").first();
      if (await trendChip.count()) controls.splice(1, 0, trendChip);

      for (const control of controls) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await control.evaluate((element) => (element as HTMLElement).blur());
        const beforeFocus = await control.evaluate((element) => {
          const style = getComputedStyle(element);
          return { outline: style.outline, boxShadow: style.boxShadow };
        });
        await control.focus();
        await expect(control).toBeFocused();
        const afterFocus = await control.evaluate((element) => {
          const style = getComputedStyle(element);
          return { outline: style.outline, boxShadow: style.boxShadow };
        });
        expect(
          afterFocus.outline !== beforeFocus.outline || afterFocus.boxShadow !== beforeFocus.boxShadow,
          `${await control.getAttribute("data-testid")} needs a visible focus indicator`,
        ).toBe(true);
      }
    }
  });

  test("light and dark themes preserve shell geometry", async ({ page }) => {
    for (const viewport of [VIEWPORTS[1], VIEWPORTS[4]]) {
      await page.setViewportSize(viewport);
      await openHydratedHome(page);

      const before = await page.getByTestId("youtube-card").first().boundingBox();
      expect(before).not.toBeNull();

      const toggle = viewport.width < 1024
        ? page.getByTestId("mobile-nav-drawer").getByRole("button", { name: "테마 전환" })
        : page.getByTestId("desktop-sidebar").getByRole("button", { name: "테마 전환" });

      if (viewport.width < 1024) {
        await page.getByTestId("brand-menu-trigger").click();
        await expect(page.getByTestId("mobile-nav-drawer")).toBeVisible();
      }

      const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      await toggle.click();
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!wasDark);

      if (viewport.width < 1024) {
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("mobile-nav-drawer")).toBeHidden();
      }

      const after = await page.getByTestId("youtube-card").first().boundingBox();
      expect(after).not.toBeNull();
      expect(after!.width).toBeCloseTo(before!.width, 1);
      expect(after!.height).toBeCloseTo(before!.height, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    }
  });

  test("channel detail reuses the clean discovery hierarchy", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[4]);
    await openHydratedHome(page);
    const sourceHref = await page.locator('a[href*="source="]').first().getAttribute("href");
    expect(sourceHref).toBeTruthy();

    await page.goto(sourceHref!, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("source-header")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]')).toBeVisible();
    await expect(page.getByTestId("feed-search-input")).toBeVisible();
    await expect(page.getByRole("button", { name: "새로고침" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "필터" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test("reduced motion removes long transitions and smooth scrolling", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(VIEWPORTS[1]);
    await openHydratedHome(page);

    await page.getByTestId("discovery-filter-trigger").click();
    const panel = page.getByTestId("discovery-filter-panel");
    await expect(panel).toBeVisible();

    const motion = await panel.evaluate((element) => {
      const toMilliseconds = (value: string) => Math.max(
        ...value.split(",").map((token) => {
          const trimmed = token.trim();
          return trimmed.endsWith("ms") ? Number.parseFloat(trimmed) : Number.parseFloat(trimmed) * 1000;
        }),
      );
      const style = getComputedStyle(element);
      return {
        transitionMs: toMilliseconds(style.transitionDuration),
        animationMs: toMilliseconds(style.animationDuration),
        scrollBehavior: style.scrollBehavior,
      };
    });

    expect(motion.transitionMs).toBeLessThanOrEqual(0.01);
    expect(motion.animationMs).toBeLessThanOrEqual(0.01);
    expect(motion.scrollBehavior).toBe("auto");
  });
});
