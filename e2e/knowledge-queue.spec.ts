import { expect, test, type Page } from "@playwright/test";

const JOB_ID = "123e4567-e89b-42d3-a456-426614174000";

async function mockKnowledgeQueue(page: Page) {
  await page.route("**/api/knowledge/jobs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobs: [{
          id: JOB_ID,
          videoId: "abc_DEF-123",
          sourceUrl: "https://www.youtube.com/watch?v=abc_DEF-123",
          title: "검토할 지식 영상",
          channelName: "테스트 채널",
          status: "review_required",
          failureCode: null,
          captureReady: true,
          createdAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-08T00:01:00.000Z",
          reviewAvailable: true,
        }],
      }),
    });
  });

  await page.route("**/api/knowledge/jobs/*/review", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        review: {
          summary: "원문 사실과 해석을 구분한 검토 요약입니다.",
          keyPoints: ["핵심 요점 하나"],
          claims: [{
            type: "fact",
            statement: "타임스탬프로 확인할 사실 주장",
            evidenceExcerpt: "검증에 사용한 짧은 원문 근거입니다",
            citation: "[00:51]",
            citationVerified: true,
            requiresCrosscheck: false,
          }],
          coverage: [],
          uncertainties: ["없음"],
          relevance: "워크플로우 설계에 참고할 수 있습니다.",
          category: "YT · AI · Workflow",
          qualityScore: 96,
          qualityWarnings: [],
        },
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockKnowledgeQueue(page);
});

test("검토 상세를 필요할 때만 읽고 근거와 다음 단계를 보여준다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/knowledge", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("검토할 지식 영상")).toBeVisible();
  await page.getByRole("button", { name: "요약과 근거 확인" }).click();

  await expect(page.getByText("원문 사실과 해석을 구분한 검토 요약입니다.")).toBeVisible();
  await expect(page.getByText("검증에 사용한 짧은 원문 근거입니다", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI가 제안한 적재 이유" })).toBeVisible();
  await expect(page.getByRole("link", { name: /\[00:51\] 원본에서 확인/ })).toHaveAttribute("href", /[?&]t=51s/);
  await expect(page.getByText("승인하기 전에는 Yohan Brain에 기록되지 않습니다.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "승인 요청 복사" }).click();
  await expect(page.getByRole("button", { name: "복사됨" })).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(`knowledge approve ${JOB_ID}`);
});

test("390px 모바일에서 검토 카드와 승인 버튼이 가로로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "요약과 근거 확인" }).click();
  await expect(page.getByRole("heading", { name: "검토를 마쳤다면" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const approveButton = page.getByRole("button", { name: "승인 요청 복사" });
  const box = await approveButton.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
