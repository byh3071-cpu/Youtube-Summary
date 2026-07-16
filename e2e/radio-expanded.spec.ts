import { expect, test, type Page } from "@playwright/test";

async function addFirstItemToRadio(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]').waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "라디오에 추가" }).first().click();
  await expect(page.getByTestId("radio-player")).toBeVisible();
}

async function openExpandedPlayer(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole("button", { name: "플레이어 더보기" }).click();
    await page.getByRole("menuitem", { name: "전체 화면" }).click();
  } else {
    await page.getByRole("button", { name: "전체 화면 영상" }).click();
  }
}

async function openMiniPlayer(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByRole("button", { name: "플레이어 더보기" }).click();
    await page.getByRole("menuitem", { name: "미니 영상" }).click();
  } else {
    await page.getByRole("button", { name: "미니 영상 켜기" }).click();
  }
}

test.describe("expanded radio player", () => {
  for (const viewport of [
    { width: 393, height: 852 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`${viewport.width}px mini player stays recoverable and inside the viewport`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await addFirstItemToRadio(page);
      await openMiniPlayer(page, viewport.width < 768);

      const wrapper = page.locator("#yt-radio-player-wrapper");
      const close = page.getByTestId("mini-video-close");
      await expect(close).toBeVisible();
      const wrapperBox = await wrapper.boundingBox();
      const closeBox = await close.boundingBox();
      expect(wrapperBox).not.toBeNull();
      expect(closeBox).not.toBeNull();
      expect(wrapperBox!.x).toBeGreaterThanOrEqual(0);
      expect(wrapperBox!.x + wrapperBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(wrapperBox!.width / wrapperBox!.height).toBeCloseTo(16 / 9, 2);
      expect(closeBox!.width).toBeGreaterThanOrEqual(44);
      expect(closeBox!.height).toBeGreaterThanOrEqual(44);
      if (process.env.CAPTURE_UI === "1") {
        await wrapper.screenshot({ path: `test-results/mini-radio-player-${viewport.width}.png` });
      }

      await close.click();
      await expect(close).toHaveCount(0);
      await expect(wrapper).toHaveAttribute("aria-hidden", "true");
      await expect(wrapper.locator("iframe")).toHaveCSS("width", "1px");
    });
  }

  for (const viewport of [
    { width: 393, height: 852 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`${viewport.width}px keeps the theater shell inside the viewport`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await addFirstItemToRadio(page);
      await openExpandedPlayer(page, viewport.width < 768);

      const dialog = page.getByRole("dialog", { name: "확장 라디오 플레이어" });
      const media = page.getByTestId("expanded-radio-media");
      const context = page.getByTestId("expanded-radio-context");
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("button", { name: "확장 플레이어 닫기" })).toBeFocused();
      await expect(context.getByText("NOW PLAYING")).toBeVisible();
      if (viewport.width >= 1280) {
        const queuePreview = page.getByTestId("expanded-queue-preview");
        await expect(queuePreview).toBeVisible();
        await expect(queuePreview.getByRole("button")).toHaveCount(1);
      }

      const dialogBox = await dialog.boundingBox();
      const mediaBox = await media.boundingBox();
      const contextBox = await context.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(mediaBox).not.toBeNull();
      expect(contextBox).not.toBeNull();
      expect(dialogBox!.width).toBeCloseTo(viewport.width, 0);
      expect(dialogBox!.height).toBeCloseTo(viewport.height, 0);
      expect(mediaBox!.width / mediaBox!.height).toBeCloseTo(16 / 9, 2);
      expect(mediaBox!.x).toBeGreaterThanOrEqual(0);
      expect(mediaBox!.x + mediaBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(contextBox!.x).toBeGreaterThanOrEqual(0);
      expect(contextBox!.x + contextBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
      if (viewport.width < 768) {
        await expect(page.getByRole("button", { name: "플레이어 더보기" })).toBeFocused();
      } else {
        await expect(page.getByRole("button", { name: "전체 화면 영상" })).toBeFocused();
      }
    });
  }

  test("mobile and tablet use a bottom AI summary sheet", async ({ page }) => {
    for (const viewport of [
      { width: 393, height: 852 },
      { width: 768, height: 1024 },
      { width: 1023, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await addFirstItemToRadio(page);
      await openExpandedPlayer(page, viewport.width < 768);

      const trigger = page.getByTestId("expanded-ai-summary-trigger");
      await trigger.click();
      const sheet = page.getByTestId("expanded-ai-summary-sheet");
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(220);

      const sheetBox = await sheet.boundingBox();
      const generateBox = await page.getByTestId("expanded-ai-summary-generate").boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(generateBox).not.toBeNull();
      expect(sheetBox!.y + sheetBox!.height).toBeCloseTo(viewport.height, 0);
      expect(sheetBox!.width).toBeCloseTo(viewport.width < 680 ? viewport.width : 680, 0);
      expect(generateBox!.height).toBeGreaterThanOrEqual(44);
      await expect(page.getByTestId("expanded-ai-summary-panel")).toHaveCount(0);

      await sheet.getByRole("button", { name: "AI 요약 닫기" }).click();
      await expect(sheet).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });

  test("resume prompt follows the video hover boundary", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="discovery-toolbar"][data-hydrated="true"]').waitFor({
      state: "visible",
      timeout: 30_000,
    });

    const thumbnailUrl = await page.getByTestId("youtube-card").first().locator("img").first().getAttribute("src");
    const videoId = decodeURIComponent(thumbnailUrl ?? "").match(/\/vi\/([^/]+)/)?.[1];
    expect(videoId).toBeTruthy();
    await page.evaluate((id) => {
      localStorage.setItem("focus_feed_watch_history_v1", JSON.stringify({
        [id]: {
          videoId: id,
          lastPositionSeconds: 5,
          durationSeconds: 360,
          updatedAt: Date.now(),
          completed: false,
        },
      }));
    }, videoId!);

    await page.getByRole("button", { name: "라디오에 추가" }).first().click();
    await page.getByRole("button", { name: "전체 화면 영상" }).click();
    const media = page.getByTestId("expanded-radio-media");
    const prompt = page.getByTestId("resume-playback-prompt");
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveCSS("opacity", "1");

    await page.mouse.move(1, 1);
    await expect(prompt).toHaveCSS("opacity", "0");
    await media.hover();
    await expect(prompt).toHaveCSS("opacity", "1");

    const resumeButton = prompt.getByRole("button");
    await resumeButton.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(resumeButton).toBeFocused();
    expect(await resumeButton.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    await page.mouse.move(1, 1);
    await expect(prompt).toHaveCSS("opacity", "1");
  });

  test("wide-screen queue preview uses the same video chrome boundary", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstItemToRadio(page);
    await page.getByRole("button", { name: "라디오에 추가" }).nth(1).click();
    await openExpandedPlayer(page, false);

    const media = page.getByTestId("expanded-radio-media");
    const queuePreview = page.getByTestId("expanded-queue-preview");
    await expect(queuePreview).toBeVisible();
    await expect(queuePreview).toHaveCSS("opacity", "1");
    const previewItems = queuePreview.getByTestId("expanded-queue-preview-item");
    await expect(previewItems).toHaveCount(2);

    await previewItems.nth(1).click();
    await expect(previewItems).toHaveCount(2);
    await expect(previewItems.nth(0)).toContainText("이전 1번째");
    await expect(previewItems.nth(1)).toHaveAttribute("aria-current", "true");

    await page.mouse.move(1, 1);
    await expect(queuePreview).toHaveCSS("opacity", "0");
    await media.hover();
    await expect(queuePreview).toHaveCSS("opacity", "1");

    await previewItems.first().click();
    await page.mouse.move(1, 1);
    await expect(queuePreview).toHaveCSS("opacity", "0");
  });

  test("mini and expanded modes keep the same YouTube iframe instance", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstItemToRadio(page);

    const iframe = page.locator("#yt-radio-player-wrapper iframe");
    const wrapper = page.locator("#yt-radio-player-wrapper");
    await expect(iframe).toHaveCount(1, { timeout: 30_000 });
    await page.getByRole("button", { name: "미니 영상 켜기" }).click();
    expect(await iframe.evaluate((element) => element.style.width)).toBe("100%");
    expect((await iframe.boundingBox())!.width).toBeCloseTo(
      await wrapper.evaluate((element) => element.clientWidth),
      0
    );

    const initialSrc = await iframe.getAttribute("src");
    await page.evaluate(() => {
      const target = document.querySelector("#yt-radio-player-wrapper iframe");
      (window as Window & { __focusFeedRadioIframe?: Element | null }).__focusFeedRadioIframe = target;
    });

    await openExpandedPlayer(page, false);
    await expect(page.getByRole("dialog", { name: "확장 라디오 플레이어" })).toBeVisible();
    expect(await iframe.evaluate((element) => element.style.width)).toBe("100%");
    const expandedIframeBox = await iframe.boundingBox();
    const expandedMediaBox = await page.getByTestId("expanded-radio-media").boundingBox();
    expect(expandedIframeBox).not.toBeNull();
    expect(expandedMediaBox).not.toBeNull();
    expect(expandedIframeBox!.width).toBeCloseTo(expandedMediaBox!.width, 0);
    expect(expandedIframeBox!.height).toBeCloseTo(expandedMediaBox!.height, 0);
    expect(await iframe.getAttribute("src")).toBe(initialSrc);
    expect(
      await page.evaluate(() => {
        const stored = (window as Window & { __focusFeedRadioIframe?: Element | null }).__focusFeedRadioIframe;
        return Boolean(stored?.isSameNode(document.querySelector("#yt-radio-player-wrapper iframe")));
      })
    ).toBe(true);

    await page.getByRole("button", { name: "확장 플레이어 닫기" }).click();
    await expect(page.getByRole("dialog", { name: "확장 라디오 플레이어" })).toHaveCount(0);
    expect(await iframe.evaluate((element) => element.style.width)).toBe("100%");
    expect((await iframe.boundingBox())!.width).toBeCloseTo(
      await wrapper.evaluate((element) => element.clientWidth),
      0
    );
    expect(await iframe.getAttribute("src")).toBe(initialSrc);
    expect(
      await page.evaluate(() => {
        const stored = (window as Window & { __focusFeedRadioIframe?: Element | null }).__focusFeedRadioIframe;
        return Boolean(stored?.isSameNode(document.querySelector("#yt-radio-player-wrapper iframe")));
      })
    ).toBe(true);
  });

  test("desktop AI summary shell stays open until explicitly closed", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addFirstItemToRadio(page);
    await openExpandedPlayer(page, false);

    const trigger = page.getByTestId("expanded-ai-summary-trigger");
    await trigger.click();
    const panel = page.getByTestId("expanded-ai-summary-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("expanded-queue-preview")).toHaveCount(0);
    await expect(panel.getByText("아직 생성된 요약이 없어요.")).toBeVisible();
    const generate = page.getByTestId("expanded-ai-summary-generate");
    await expect(generate).toBeVisible();
    const generateBox = await generate.boundingBox();
    expect(generateBox).not.toBeNull();
    expect(generateBox!.height).toBeGreaterThanOrEqual(44);
    const mediaBox = await page.getByTestId("expanded-radio-media").boundingBox();
    const panelBox = await panel.boundingBox();
    expect(mediaBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(mediaBox!.x + mediaBox!.width);

    await page.mouse.move(1, 1);
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "확장 라디오 플레이어" })).toBeVisible();
    await expect(trigger).toBeVisible();
  });
});
