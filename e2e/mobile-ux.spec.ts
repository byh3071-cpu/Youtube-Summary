import { test, expect, type Locator, type Page } from "@playwright/test";

type ChannelRemovalTiming = {
  clicks: number[];
  deletes: number[];
};

async function installChannelRemovalTiming(page: Page) {
  await page.evaluate(() => {
    const timing: ChannelRemovalTiming = { clicks: [], deletes: [] };
    (window as Window & { __channelRemovalTiming?: ChannelRemovalTiming }).__channelRemovalTiming = timing;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (init?.method === "DELETE" && String(input).includes("/api/custom-sources")) {
        timing.deletes.push(Date.now());
      }
      return nativeFetch(input, init);
    };
  });
}

async function clickWithChannelRemovalTimestamp(page: Page, target: Locator) {
  await target.evaluate((element) => {
    element.addEventListener("click", () => {
      const timing = (window as Window & { __channelRemovalTiming?: ChannelRemovalTiming }).__channelRemovalTiming;
      timing?.clicks.push(Date.now());
    }, { once: true });
  });
  await target.click();
}

async function channelRemovalTiming(page: Page) {
  return page.evaluate(() => {
    const timing = (window as Window & { __channelRemovalTiming?: ChannelRemovalTiming }).__channelRemovalTiming;
    return { clicks: timing?.clicks ?? [], deletes: timing?.deletes ?? [] };
  });
}

// 뷰포트는 playwright.config.ts의 mobile-chromium 프로젝트(Pixel 5 ≈ 393x851)가 제공한다.

// hydration 전 클릭 유실 방지 — hydration 이후에만 렌더되는 My Focus 버튼을 마커로 사용.
async function gotoHydratedHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^(편집|닫기|접기)$/ })).toBeVisible({ timeout: 30000 });
}

async function showRadioPlayerForLayout(page: Page) {
  const addButton = page.getByRole("button", { name: "라디오에 추가" }).first();
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click();
  } else {
    // 외부 피드가 없는 로컬 E2E에서도 실제 RadioFooterControls의 반응형 높이와
    // safe-area padding을 같은 Tailwind 클래스로 재현해 충돌 검증을 결정적으로 유지한다.
    await page.evaluate(() => {
      const fixture = document.createElement("footer");
      fixture.dataset.testid = "radio-player";
      fixture.setAttribute("aria-label", "라디오 플레이어 레이아웃 픽스처");
      fixture.className = "fixed inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)]";
      fixture.innerHTML = [
        '<div class="relative md:hidden"><div class="h-20"></div></div>',
        '<div class="hidden min-h-[84px] md:grid"></div>',
      ].join("");
      document.body.append(fixture);
    });
  }
  const player = page.getByTestId("radio-player");
  await expect(player).toBeVisible();
  return player;
}

test.describe("mobile ux", () => {
  test("mobile menu locks body scroll, restores focus and scroll on close", async ({ page }) => {
    await gotoHydratedHome(page);
    const openButton = page.getByRole("button", { name: "메뉴 열기" });
    await openButton.click();
    await expect(page.getByRole("dialog", { name: "메뉴" })).toBeVisible();

    // 모달 open 동안 배경 스크롤 잠금
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe("fixed");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "메뉴" })).toBeHidden();

    // 닫힌 뒤 body 스타일 복구
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe("");

    // 포커스가 메뉴를 연 버튼으로 복귀 (ModalTransition focus restore)
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? ""),
      )
      .toBe("메뉴 열기");
  });

  test("subscription channels show avatars in the mobile drawer", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const dialog = page.getByRole("dialog", { name: "메뉴" });
    const firstChannel = dialog.locator('a[href*="source="]').first();
    await expect(firstChannel).toBeVisible();
    await expect(firstChannel.locator("img")).toBeVisible();
  });

  test("channel removal hides immediately and undo prevents DELETE", async ({ page }) => {
    let deleteCalls = 0;
    await page.route("**/api/custom-sources?sourceId=*", async (route) => {
      deleteCalls += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await gotoHydratedHome(page);
    await page.clock.install();
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByTestId("mobile-nav-drawer");
    const rowLabel = "드로우앤드류 (DrawAndrew)";
    await drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` }).click();

    await expect(drawer.getByText(rowLabel, { exact: true })).toBeHidden({ timeout: 100 });
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제할 예정이에요", { timeout: 100 });
    expect(deleteCalls).toBe(0);

    await page.getByTestId("channel-removal-undo").click();
    await expect(drawer.getByText(rowLabel, { exact: true })).toBeVisible();
    await page.clock.fastForward(5_000);
    expect(deleteCalls).toBe(0);
  });

  test("channel removal commits after five seconds and reports progress", async ({ page }) => {
    let deleteCalls = 0;
    let releaseResponse!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/custom-sources?sourceId=*", async (route) => {
      deleteCalls += 1;
      await release;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });

    await gotoHydratedHome(page);
    await page.clock.install();
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByTestId("mobile-nav-drawer");
    const rowLabel = "드로우앤드류 (DrawAndrew)";
    const channelRow = drawer.getByText(rowLabel, { exact: true });
    await installChannelRemovalTiming(page);
    await clickWithChannelRemovalTimestamp(page, drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` }));

    const deleteRequest = page.waitForRequest(
      (request) => request.method() === "DELETE" && request.url().includes("/api/custom-sources?sourceId="),
    );
    await page.clock.runFor(4_900);
    expect(deleteCalls).toBe(0);
    await page.clock.runFor(100);
    await deleteRequest;
    await expect.poll(() => deleteCalls).toBe(1);
    const timing = await channelRemovalTiming(page);
    expect(timing.deletes[0] - timing.clicks[0]).toBeGreaterThanOrEqual(5_000);
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제하는 중이에요");
    await expect(page.getByRole("button", { name: "채널 삭제 알림 닫기" })).toBeHidden();
    await expect(drawer.getByRole("button", { name: "EO Korea 채널 목록에서 제거" })).toBeDisabled();

    releaseResponse();
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제했어요");
    await page.clock.fastForward(2_000);
    await expect(page.getByTestId("channel-removal-notice")).toBeHidden();
    await expect(channelRow).toBeHidden();
  });

  test("failed channel removal restores the row and offers retry", async ({ page }) => {
    let deleteCalls = 0;
    let releaseRetryResponse!: () => void;
    const retryResponse = new Promise<void>((resolve) => {
      releaseRetryResponse = resolve;
    });
    await page.route("**/api/custom-sources?sourceId=*", async (route) => {
      deleteCalls += 1;
      if (deleteCalls === 1) {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "delete failed" }) });
        return;
      }
      await retryResponse;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await gotoHydratedHome(page);
    await page.clock.install();
    await page.getByRole("button", { name: "메뉴 열기" }).click();

    const drawer = page.getByTestId("mobile-nav-drawer");
    const rowLabel = "드로우앤드류 (DrawAndrew)";
    const channelRow = drawer.getByText(rowLabel, { exact: true });
    await installChannelRemovalTiming(page);
    await clickWithChannelRemovalTimestamp(page, drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` }));
    await page.clock.runFor(5_000);

    await expect(channelRow).toBeVisible();
    await expect(page.getByTestId("channel-removal-notice")).toContainText("delete failed");
    await expect(page.getByTestId("channel-removal-retry")).toBeVisible();
    await clickWithChannelRemovalTimestamp(page, page.getByTestId("channel-removal-retry"));
    await expect(channelRow).toBeHidden();

    const retryResponseReceived = page.waitForResponse(
      (response) => response.request().method() === "DELETE"
        && response.url().includes("/api/custom-sources?sourceId=")
        && response.status() === 200,
    );
    const retryRequest = page.waitForRequest(
      (request) => request.method() === "DELETE" && request.url().includes("/api/custom-sources?sourceId="),
    );
    await page.clock.runFor(4_900);
    expect(deleteCalls).toBe(1);
    await page.clock.runFor(100);
    await retryRequest;
    await expect.poll(() => deleteCalls).toBe(2);
    const timing = await channelRemovalTiming(page);
    expect(timing.deletes[0] - timing.clicks[0]).toBeGreaterThanOrEqual(5_000);
    expect(timing.deletes[1] - timing.clicks[1]).toBeGreaterThanOrEqual(5_000);
    releaseRetryResponse();
    await retryResponseReceived;
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제했어요");
  });

  test("network failure restores the row and Retry can complete", async ({ page }) => {
    let releaseSuccess!: () => void;
    const successRelease = new Promise<void>((resolve) => {
      releaseSuccess = resolve;
    });
    let markSuccessResponseFinished!: () => void;
    const successResponseFinished = new Promise<void>((resolve) => {
      markSuccessResponseFinished = resolve;
    });
    await page.route("**/api/custom-sources?sourceId=*", async (route) => {
      await successRelease;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      markSuccessResponseFinished();
    });
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "메뉴 열기" }).click();

    await page.evaluate(() => {
      const nativeFetch = window.fetch.bind(window);
      let rejectNextDelete = true;
      window.fetch = (input, init) => {
        if (rejectNextDelete && init?.method === "DELETE" && String(input).includes("/api/custom-sources")) {
          rejectNextDelete = false;
          return Promise.reject(new TypeError("network unavailable"));
        }
        return nativeFetch(input, init);
      };
    });
    await page.clock.install();

    const drawer = page.getByTestId("mobile-nav-drawer");
    const rowLabel = "드로우앤드류 (DrawAndrew)";
    const channelRow = drawer.getByText(rowLabel, { exact: true });
    await drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` }).click();
    await page.clock.runFor(5_000);

    await expect(channelRow).toBeVisible();
    await expect(page.getByTestId("channel-removal-notice")).toContainText("network unavailable");
    await page.getByTestId("channel-removal-retry").click();
    await expect(channelRow).toBeHidden();

    await page.clock.runFor(5_000);
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제하는 중이에요");
    releaseSuccess();
    await successResponseFinished;
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제했어요");
  });

  test("timed out channel removal restores the row", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByTestId("mobile-nav-drawer");
    const rowLabel = "드로우앤드류 (DrawAndrew)";
    const channelRow = drawer.getByText(rowLabel, { exact: true });
    const removeButton = drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` });

    await page.evaluate(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (init?.method === "DELETE" && String(input).includes("/api/custom-sources")) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
        }
        return nativeFetch(input, init);
      };
    });
    await page.clock.install();
    await removeButton.click();
    await page.clock.fastForward(5_000);
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제하는 중이에요");
    await page.clock.fastForward(12_000);

    await expect(channelRow).toBeVisible();
    await expect(page.getByTestId("channel-removal-notice")).toContainText("응답이 늦어");
  });

  test("long server error stays inside a 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const longError = `delete-${"x".repeat(180)}`;
    await page.route("**/api/custom-sources?sourceId=*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: longError }),
      });
    });
    await gotoHydratedHome(page);
    await page.clock.install();
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByTestId("mobile-nav-drawer").getByRole("button", { name: /채널 목록에서 제거/ }).first().click();
    await page.clock.runFor(5_000);

    const notice = page.getByTestId("channel-removal-notice");
    await expect(notice).toContainText(longError);
    expect(await notice.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("removal notice stays above the mobile player with accessible controls", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    let releaseDelete!: () => void;
    const deletePending = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    await page.route("**/api/custom-sources?sourceId=*", async (route) => {
      await deletePending;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "delete failed" }) });
    });
    await gotoHydratedHome(page);
    const player = await showRadioPlayerForLayout(page);

    await page.clock.install();
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByTestId("mobile-nav-drawer");
    await drawer.getByRole("button", { name: /채널 목록에서 제거/ }).first().click();

    const notice = page.getByTestId("channel-removal-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "status");
    await expect(notice).toHaveAttribute("aria-live", "polite");
    const undoBox = await page.getByTestId("channel-removal-undo").boundingBox();
    expect(undoBox).not.toBeNull();
    expect(undoBox!.width).toBeGreaterThanOrEqual(44);
    expect(undoBox!.height).toBeGreaterThanOrEqual(44);

    const noticeBox = await notice.boundingBox();
    const playerBox = await player.boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(playerBox).not.toBeNull();
    expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(playerBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.clock.fastForward(5_000);
    await expect(notice).toContainText("삭제하는 중이에요");
    await expect(notice.locator(".animate-spin")).toHaveAttribute("aria-hidden", "true");
    releaseDelete();
    await expect(page.getByTestId("channel-removal-retry")).toBeVisible();
    const retryBox = await page.getByTestId("channel-removal-retry").boundingBox();
    const close = page.getByRole("button", { name: "채널 삭제 알림 닫기" });
    const closeBox = await close.boundingBox();
    for (const box of [retryBox, closeBox]) {
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("removal notice keeps tablet safe-area spacing above the radio player", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoHydratedHome(page);
    const player = await showRadioPlayerForLayout(page);

    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByTestId("mobile-nav-drawer").getByRole("button", { name: /채널 목록에서 제거/ }).first().click();
    const notice = page.getByTestId("channel-removal-notice");
    await expect(notice).toBeVisible();

    const noticeBox = await notice.boundingBox();
    const playerBox = await player.boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(playerBox).not.toBeNull();
    const gap = playerBox!.y - (noticeBox!.y + noticeBox!.height);
    expect(gap).toBeGreaterThanOrEqual(24);
  });

  test("removal notice remains inside the desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydratedHome(page);
    const sidebar = page.getByTestId("desktop-sidebar");
    const remove = sidebar.getByRole("button", { name: /채널 목록에서 제거/ }).first();
    const channelRow = remove.locator("..");
    await channelRow.hover();
    await remove.click();

    const notice = page.getByTestId("channel-removal-notice");
    await expect(notice).toBeVisible();
    const box = await notice.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  });

  test("channel add dialog stays centered and usable outside the mobile drawer", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "메뉴 열기" }).click();

    const drawer = page.getByRole("dialog", { name: "메뉴" });
    // iOS Safari는 Framer Motion의 translate3d(0, 0, 0)을 애니메이션 뒤에도
    // 유지할 수 있다. transformed ancestor가 fixed 자식의 containing block이 되는
    // 실제 기기 조건을 Chromium에서도 재현한다.
    await expect
      .poll(() => drawer.evaluate((element) => getComputedStyle(element).transform))
      .toBe("none");
    await drawer.evaluate((element) => {
      element.style.setProperty("transform", "translate3d(0, 0, 0)", "important");
    });
    await expect
      .poll(() => drawer.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe("none");
    await drawer.getByRole("button", { name: "채널 추가" }).click();

    const dialog = page.getByRole("dialog", { name: "YouTube 채널 추가" });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => drawer.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe("none");

    const bounds = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        center: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        viewportCenter: window.innerWidth / 2,
        viewportCenterY: window.innerHeight / 2,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(Math.abs(bounds.center - bounds.viewportCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.centerY - bounds.viewportCenterY)).toBeLessThanOrEqual(1);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);

    for (const control of [
      dialog.getByLabel("카테고리"),
      dialog.getByLabel("채널·영상 주소 또는 @핸들"),
      dialog.getByRole("button", { name: "취소" }),
      dialog.getByRole("button", { name: "추가", exact: true }),
    ]) {
      const isReachable = await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit === element || element.contains(hit) || !!hit?.contains(element);
      });
      expect(isReachable).toBe(true);
    }

    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: "채널 추가" })).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe("fixed");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe("");
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeFocused();
  });

  test("Q&A input and submit button are not covered by the radio footer", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "피드 Q&A 열기" }).click();

    const dialog = page.getByRole("dialog", { name: "피드 Q&A" });
    await expect(dialog).toBeVisible();

    const textarea = page.locator("#feed-qa-input");
    await expect(textarea).toBeVisible();

    const submit = page.getByRole("button", { name: "답변 받기" });
    await expect(submit).toBeVisible();

    // 전송 버튼 중심점이 다른 요소(라디오 푸터 등)에 가려져 있지 않아야 한다.
    const covered = await submit.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return !(hit === el || el.contains(hit) || hit?.contains(el));
    });
    expect(covered).toBe(false);

    // Q&A open 동안에도 배경 스크롤 잠금
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe("fixed");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("core touch targets are at least 44px tall", async ({ page }) => {
    await gotoHydratedHome(page);

    const targets = [
      page.getByTestId("discovery-filter-trigger"),
      page.getByTestId("view-all"),
      page.getByRole("button", { name: "유튜브", exact: true }),
      page.getByRole("button", { name: "RSS", exact: true }),
      page.getByRole("button", { name: "피드 Q&A 열기" }),
    ];

    for (const target of targets) {
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      expect(box, "target should have a bounding box").not.toBeNull();
      expect(box!.height, `${await target.evaluate((el) => el.textContent || el.getAttribute("aria-label"))} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("theme toggle in mobile menu switches dark mode", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await expect(page.getByRole("dialog", { name: "메뉴" })).toBeVisible();

    const toggle = page.getByRole("dialog", { name: "메뉴" }).getByRole("button", { name: "테마 전환" });
    await expect(toggle).toBeVisible();

    const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(!wasDark);

    // 원래 테마로 복구
    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(wasDark);
  });

  test("page has no horizontal overflow at mobile width", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
