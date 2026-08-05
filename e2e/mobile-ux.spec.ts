import { test, expect, type Page } from "@playwright/test";

// 뷰포트는 playwright.config.ts의 mobile-chromium 프로젝트(Pixel 5 ≈ 393x851)가 제공한다.

// hydration 전 클릭 유실 방지 — hydration 이후에만 렌더되는 My Focus 버튼을 마커로 사용.
async function gotoHydratedHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^(편집|닫기|접기)$/ })).toBeVisible({ timeout: 30000 });
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
    await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제할 예정이에요");
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
    await drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` }).click();

    const deleteRequest = page.waitForRequest(
      (request) => request.method() === "DELETE" && request.url().includes("/api/custom-sources?sourceId="),
    );
    await page.clock.runFor(4_999);
    expect(deleteCalls).toBe(0);
    await page.clock.runFor(1);
    await deleteRequest;
    await expect.poll(() => deleteCalls).toBe(1);
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
    await drawer.getByRole("button", { name: `${rowLabel} 채널 목록에서 제거` }).click();
    await page.clock.runFor(5_000);

    await expect(channelRow).toBeVisible();
    await expect(page.getByTestId("channel-removal-notice")).toContainText("delete failed");
    await expect(page.getByTestId("channel-removal-retry")).toBeVisible();
    await page.getByTestId("channel-removal-retry").click();
    await expect(channelRow).toBeHidden();

    const retryRequest = page.waitForRequest(
      (request) => request.method() === "DELETE" && request.url().includes("/api/custom-sources?sourceId="),
    );
    await page.clock.runFor(4_999);
    expect(deleteCalls).toBe(1);
    await page.clock.runFor(1);
    await retryRequest;
    await expect.poll(() => deleteCalls).toBe(2);
    releaseRetryResponse();
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
            init.signal?.addEventListener(
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
