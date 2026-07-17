import { expect, test } from "@playwright/test";

test.describe("responsive app shell", () => {
  test("desktop sidebar is fixed-width and independently scrollable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const sidebar = page.getByTestId("desktop-sidebar");
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
    const before = await sidebar.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.width).toBeCloseTo(260, 0);
    expect(before!.height).toBeCloseTo(1000, 0);

    await page.evaluate(() => scrollTo(0, 700));
    const after = await sidebar.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.y).toBeCloseTo(0, 0);
    await expect(sidebar.locator("nav").last()).toHaveCSS("overflow-y", "auto");
    await expect(sidebar.getByRole("link", { name: "홈", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "동영상", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "숏폼", exact: true })).toBeVisible();
    expect(await sidebar.locator("[class*='border-t'], [class*='border-b']").count()).toBe(0);
  });

  test("mobile header opens a safe drawer without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const header = page.getByTestId("mobile-header");
    await expect(header).toBeVisible({ timeout: 30_000 });
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBeCloseTo(64, 0);

    const brand = header.getByTestId("mobile-brand-menu");
    const brandTrigger = header.getByTestId("brand-menu-trigger");
    const brandBox = await brand.boundingBox();
    const triggerBox = await brandTrigger.boundingBox();
    expect(brandBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.width).toBeCloseTo(44, 0);
    expect(triggerBox!.x).toBeCloseTo(brandBox!.x, 0);
    await expect(header.locator("svg.lucide-menu")).toHaveCount(0);

    await brandTrigger.click();
    const drawer = page.getByTestId("mobile-nav-drawer");
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("dialog", { name: "메뉴" })).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.width).toBeCloseTo(288, 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const loginBox = await drawer.getByRole("button", { name: /Google.*로그인/ }).boundingBox();
    expect(loginBox).not.toBeNull();
    expect(loginBox!.y + loginBox!.height).toBeLessThanOrEqual(852);
  });

  test("opening the mobile drawer does not resize feed cards", async ({ page }) => {
    for (const viewport of [
      { width: 393, height: 852 },
      { width: 768, height: 1024 },
      { width: 1023, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const card = page.getByTestId("youtube-card").first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      const before = await card.boundingBox();
      await page.getByTestId("brand-menu-trigger").click();
      await expect(page.getByRole("dialog", { name: "메뉴" })).toBeVisible();
      const after = await card.boundingBox();
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      expect(after!.width).toBeCloseTo(before!.width, 1);
      expect(after!.height).toBeCloseTo(before!.height, 1);
      await page.getByRole("button", { name: "메뉴 닫기" }).click();
    }
  });

  test("tablet keeps content width by using the compact mobile shell", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("desktop-sidebar")).toBeHidden();

    const cards = page.getByTestId("youtube-card");
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(1);
    expect(second!.x).toBeGreaterThan(first!.x);
  });

  test("desktop sidebar begins at the large breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("desktop-sidebar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("mobile-header")).toBeHidden();
  });

  test("reel mode owns the viewport without duplicated app shell", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/?viewMode=shortform&auth_success=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-header")).toHaveCount(0);
    await expect(page.getByTestId("desktop-sidebar")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "숏폼" })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(viewport.scrollHeight).toBe(viewport.clientHeight);
    await expect(page.getByRole("region", { name: "라디오 안내" })).toHaveCount(0);
  });

  test("shortform and live keep the title inside the reel header boundary", async ({ page }) => {
    for (const viewport of [
      { width: 393, height: 852 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      for (const mode of ["shortform", "live"] as const) {
        await page.goto(`/?viewMode=${mode}`, { waitUntil: "domcontentloaded" });
        const header = page.getByTestId("reel-context-bar");
        const title = page.getByTestId("reel-context-title");
        const content = page.getByTestId("reel-content");
        await expect(header).toBeVisible({ timeout: 30_000 });

        const headerBox = await header.boundingBox();
        const titleBox = await title.boundingBox();
        const contentBox = await content.boundingBox();
        expect(headerBox).not.toBeNull();
        expect(titleBox).not.toBeNull();
        expect(contentBox).not.toBeNull();
        expect(titleBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
        expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(headerBox!.y + headerBox!.height);
        expect(contentBox!.y).toBeCloseTo(headerBox!.y + headerBox!.height, 0);
      }
    }
  });

  test("shortform and live use mode-specific media frames", async ({ page }) => {
    for (const viewport of [
      { width: 393, height: 852 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      for (const mode of ["shortform", "live"] as const) {
        await page.goto(`/?viewMode=${mode}`, { waitUntil: "domcontentloaded" });
        const media = page.getByTestId("reel-media").first();
        const actions = page.getByTestId("reel-actions").first();
        await expect(media).toBeVisible({ timeout: 30_000 });
        await expect(actions).toBeVisible();

        const mediaBox = await media.boundingBox();
        const actionsBox = await actions.boundingBox();
        expect(mediaBox).not.toBeNull();
        expect(actionsBox).not.toBeNull();
        const expectedRatio = mode === "shortform" ? 9 / 16 : 16 / 9;
        expect(mediaBox!.width / mediaBox!.height).toBeCloseTo(expectedRatio, 2);
        if (mode === "shortform") {
          expect(actionsBox!.y).toBeGreaterThanOrEqual(mediaBox!.y + mediaBox!.height - 1);
          const metadata = page.getByTestId("shortform-meta").first();
          await expect(metadata).toBeVisible();
          const metadataBox = await metadata.boundingBox();
          expect(metadataBox).not.toBeNull();
          expect(metadataBox!.y).toBeGreaterThanOrEqual(mediaBox!.y + mediaBox!.height - 1);
          expect(actionsBox!.y).toBeGreaterThanOrEqual(metadataBox!.y + metadataBox!.height - 1);
        }

        const targets = actions.locator("a, button");
        for (let index = 0; index < (await targets.count()); index += 1) {
          const box = await targets.nth(index).boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
    }
  });

  test("reel modes expose the agreed playback policy", async ({ page }) => {
    for (const [mode, autoplay, advanceOnEnd] of [
      ["shortform", "true", "true"],
      ["live", "true", "false"],
    ] as const) {
      await page.goto(`/?viewMode=${mode}`, { waitUntil: "domcontentloaded" });
      const content = page.getByTestId("reel-content");
      await expect(content).toHaveAttribute("data-autoplay", autoplay);
      await expect(content).toHaveAttribute("data-advance-on-end", advanceOnEnd);
    }
  });

  test("longform uses a browse-first list and opens a 16:9 watch view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/?viewMode=longform", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("desktop-sidebar")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("reel-context-bar")).toHaveCount(0);

    const cards = page.getByTestId("longform-card");
    await expect(cards.first()).toBeVisible();
    const firstThumbnail = cards.first().locator("span").first();
    const thumbnailBox = await firstThumbnail.boundingBox();
    expect(thumbnailBox).not.toBeNull();
    expect(thumbnailBox!.width / thumbnailBox!.height).toBeCloseTo(16 / 9, 2);

    await cards.first().click();
    const watch = page.getByTestId("longform-watch");
    const player = page.getByTestId("longform-player");
    await expect(watch).toBeVisible();
    const playerBox = await player.boundingBox();
    expect(playerBox).not.toBeNull();
    expect(playerBox!.width / playerBox!.height).toBeCloseTo(16 / 9, 2);
    await expect(player.locator("iframe")).toHaveAttribute("src", /autoplay=0/);

    const summaryPanel = page.getByTestId("longform-summary-panel");
    await expect(summaryPanel).toBeVisible();
    await expect(summaryPanel).toHaveAttribute("data-summary-state", "idle");
    const summaryBox = await summaryPanel.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(summaryBox!.y).toBeGreaterThanOrEqual(playerBox!.y + playerBox!.height);

    await page.getByTestId("longform-summary-generate").click();
    await expect(summaryPanel).toHaveAttribute("data-summary-state", "error");
    await expect(summaryPanel.getByRole("link", { name: "로그인" })).toBeVisible();
  });

  test("reel and home positions are restored within the session", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?viewMode=shortform", { waitUntil: "domcontentloaded" });
    const reel = page.locator('[data-testid="reel-content"][data-hydrated="true"]');
    await expect(page.getByTestId("reel-slide").nth(1)).toBeVisible({ timeout: 30_000 });
    await reel.evaluate((element) => {
      const previousBehavior = element.style.scrollBehavior;
      element.style.scrollBehavior = "auto";
      element.scrollTop = element.clientHeight;
      element.dispatchEvent(new Event("scroll"));
      element.style.scrollBehavior = previousBehavior;
    });
    await expect.poll(() => reel.evaluate((element) => Math.round(element.scrollTop / element.clientHeight))).toBe(1);
    await expect.poll(() => page.evaluate(() => {
      const raw = sessionStorage.getItem("focus-feed:reel-position:shortform");
      return raw ? JSON.parse(raw).index : null;
    })).toBe(1);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.evaluate(() => {
      const raw = sessionStorage.getItem("focus-feed:reel-position:shortform");
      return raw ? JSON.parse(raw).index : null;
    })).toBe(1);
    await page.goto("/?viewMode=shortform", { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.getByTestId("reel-content").evaluate((element) => Math.round(element.scrollTop / element.clientHeight))).toBe(1);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("youtube-card").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]')).toBeVisible({ timeout: 30_000 });
    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    test.skip(maxScroll < 300, "feed is not tall enough to verify home scroll restoration");
    await page.evaluate(() => window.scrollTo(0, Math.min(600, document.documentElement.scrollHeight - innerHeight)));
    const savedY = await page.evaluate(() => Math.round(window.scrollY));
    await page.locator('a[href="/?viewMode=shortform"]').first().click();
    await expect(page.getByTestId("reel-content")).toBeVisible();
    await page.getByTestId("reel-context-bar").locator('a[href="/"]').click();
    await expect(page.getByTestId("youtube-card").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeCloseTo(savedY, -1);
  });

  test("shortform actions stay above the active radio player", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/?viewMode=shortform", { waitUntil: "domcontentloaded" });
    const actions = page.getByTestId("reel-actions").first();
    await expect(actions).toBeVisible({ timeout: 30_000 });
    await actions.locator("button").first().click();

    const player = page.getByTestId("radio-player");
    await expect(player).toBeVisible();
    const actionBox = await actions.boundingBox();
    const playerBox = await player.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(playerBox).not.toBeNull();
    expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(playerBox!.y);
  });

  test("active radio player stays inside desktop and mobile viewports", async ({ page }) => {
    for (const viewport of [
      { width: 393, height: 852 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]').waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('button[aria-label="라디오에 추가"]:visible').first().click();

      const player = page.getByTestId("radio-player");
      await expect(player).toBeVisible();
      const playerBox = await player.boundingBox();
      expect(playerBox).not.toBeNull();
      expect(playerBox!.x).toBeGreaterThanOrEqual(0);
      expect(playerBox!.x + playerBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(playerBox!.y + playerBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(playerBox!.height).toBeLessThanOrEqual(viewport.width < 768 ? 72 : 96);

      const buttonBoxes = await player.locator("button:visible").evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }),
      );
      for (const box of buttonBoxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height);
      }

      if (viewport.width < 768) {
        const more = player.getByRole("button", { name: "플레이어 더보기" });
        await more.click();
        const menu = page.getByTestId("mobile-player-actions");
        await expect(menu).toBeVisible();
        await expect.poll(() => menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
        await expect(more).toBeFocused();
      }
    }
  });
});
