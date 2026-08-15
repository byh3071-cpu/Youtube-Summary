import { test, expect, type Page } from "@playwright/test";

async function waitForStableHydratedHome(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const stableForMs = 500;
          const sampleEveryMs = 50;
          let stableSince = 0;
          let stableToolbar: Element | null = null;

          for (let elapsed = 0; elapsed <= 1500; elapsed += sampleEveryMs) {
            const toolbars = document.querySelectorAll('[data-testid="discovery-toolbar"]');
            const triggers = document.querySelectorAll('[data-testid="discovery-filter-trigger"]');
            const toolbar = toolbars.length === 1 ? toolbars.item(0) : null;
            const ready =
              toolbar !== null &&
              toolbar.getAttribute("data-hydrated") === "true" &&
              triggers.length === 1 &&
              toolbar.contains(triggers.item(0));

            if (!ready || toolbar !== stableToolbar) {
              stableSince = ready ? performance.now() : 0;
              stableToolbar = ready ? toolbar : null;
            } else if (performance.now() - stableSince >= stableForMs) {
              return true;
            }

            await new Promise((resolve) => window.setTimeout(resolve, sampleEveryMs));
          }

          return false;
        }),
      { timeout: 30000 },
    )
    .toBe(true);
}

async function gotoHydratedHome(page: Page) {
  await page.goto("/");
  await waitForStableHydratedHome(page);
}

test.describe("anonymous flows", () => {
  test("playlist save API rejects anonymous requests with 401", async ({ request }) => {
    const res = await request.post("/api/playlists/save", {
      data: { items: [{ videoId: "v1", title: "테스트" }], title: "익명 시도" },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("로그인");
  });

  test("anonymous /playlists shows login CTA and no playlist rows", async ({ page }) => {
    await page.goto("/playlists");
    await expect(page.getByRole("heading", { name: "내 플레이리스트" })).toBeVisible();
    // Supabase 미설정 환경(CI 등)은 설정 안내, 설정 환경은 로그인 CTA — 어느 쪽이든 익명에게 목록은 비노출.
    const loginCta = page.getByRole("link", { name: "로그인하러 가기" });
    const unconfigured = page.getByText("Supabase 연결이 설정되지 않았습니다", { exact: false });
    await expect(loginCta.or(unconfigured)).toBeVisible();
    // 익명(user_id IS NULL) 행 노출 회귀 방지: 목록 로드 버튼이 존재하지 않아야 한다.
    await expect(page.getByRole("button", { name: "이 플레이리스트로 듣기" })).toHaveCount(0);
  });

  test("keyword filter add/remove persists across reload via localStorage", async ({ page }) => {
    const keyword = `e2e키워드${Date.now() % 10000}`;
    await gotoHydratedHome(page);

    await page.getByTestId("discovery-filter-trigger").click();
    await page.getByLabel("관심 키워드 입력").fill(keyword);
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByText(`# ${keyword}`)).toBeVisible();

    // 새로고침 후에도 localStorage로 유지
    await page.reload({ waitUntil: "commit" });
    await waitForStableHydratedHome(page);
    await page.getByTestId("discovery-filter-trigger").click();
    await expect(page.getByText(`# ${keyword}`)).toBeVisible();

    // 제거
    await page.getByRole("button", { name: `${keyword} 필터 제거` }).click();
    await expect(page.getByText(`# ${keyword}`)).toBeHidden();
  });

  test("view switcher filters instantly and updates URL without navigation", async ({ page }) => {
    await gotoHydratedHome(page);

    const startedAt = Date.now();
    await page.getByRole("button", { name: "유튜브", exact: true }).click();
    await expect(page).toHaveURL(/view=youtube/);
    await expect(page.getByRole("button", { name: "유튜브", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(Date.now() - startedAt).toBeLessThan(1500);

    await page.getByRole("button", { name: "RSS", exact: true }).click();
    await expect(page).toHaveURL(/view=rss/);
    await expect(page.getByRole("button", { name: "RSS", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("view-all").click();
    await expect(page).not.toHaveURL(/view=/);
  });

  test("Q&A dialog has accessible name and closes with Escape", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "피드 Q&A 열기" }).click();

    const dialog = page.getByRole("dialog", { name: "피드 Q&A" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("#feed-qa-input")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("sidebar theme toggle switches dark mode on desktop", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("aside").getByRole("button", { name: "테마 전환" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();

    const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(!wasDark);

    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(wasDark);
  });
});
