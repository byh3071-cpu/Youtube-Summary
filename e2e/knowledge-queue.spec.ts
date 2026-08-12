import { expect, test, type Page } from "@playwright/test";

const JOB_ID = "123e4567-e89b-42d3-a456-426614174000";

async function mockKnowledgeQueue(page: Page) {
  await page.route("**/api/knowledge/jobs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jobs: [
          {
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
          },
          {
            id: "223e4567-e89b-42d3-a456-426614174001",
            videoId: "processing-123",
            title: "처리 중인 영상",
            status: "processing",
            captureReady: true,
            createdAt: "2026-08-09T00:00:00.000Z",
            updatedAt: "2026-08-09T00:01:00.000Z",
          },
          {
            id: "323e4567-e89b-42d3-a456-426614174002",
            videoId: "completed-123",
            title: "완료된 영상",
            status: "completed",
            captureReady: true,
            createdAt: "2026-08-10T00:00:00.000Z",
            updatedAt: "2026-08-10T00:01:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/knowledge/jobs/*/review", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        review: {
          formatVersion: 2,
          summary: "원문 사실과 해석을 구분한 검토 요약입니다.",
          keyPoints: ["핵심 요점 하나"],
          claims: [{
            type: "fact",
            statement: "타임스탬프로 확인한 사실 주장",
            evidenceExcerpt: "검증에 사용한 실제 원문 근거입니다",
            citation: "[00:51]",
            citationVerified: true,
            requiresCrosscheck: false,
          }],
          coverage: [],
          uncertainties: ["없음"],
          relevance: "워크플로 설계에 참고할 수 있습니다.",
          category: "YT · AI · Workflow",
          qualityScore: 96,
          qualityWarnings: [],
          creatorThesis: "AI 사용법보다 문제 정의와 검증 역량이 중요하다는 주장입니다.",
          audienceContext: "댓글 미수집",
          criticalAnalysis: "공포 중독이 아닌 학습 대역의 전환으로 읽어야 합니다.",
          ecosystemApplications: [{
            area: "Focus Feed",
            application: "요약과 검증 근거를 분리합니다.",
            expectedEffect: "검토 시간을 줄입니다.",
          }],
          twoWeekExperiment: {
            hypothesis: "근거 분리가 검토 오류를 줄입니다.",
            action: "2주 동안 영상 다섯 편에 적용합니다.",
            metric: "검토 시간과 수정 건수",
            stopCondition: "수정 건수가 줄지 않으면 중단합니다.",
          },
          evidenceMap: [{
            claimId: "F1",
            statement: "타임스탬프로 확인한 사실 주장",
            timestamps: ["[00:51]"],
            note: "공개 자막에서 확인한 구간",
          }],
        },
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockKnowledgeQueue(page);
});

test("지식함은 확인 필요·처리 중·완료를 분리하고 뒤로가기를 제공한다", async ({ page }) => {
  await page.goto("/knowledge", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "지식함" })).toBeVisible();
  await expect(page.getByRole("button", { name: "이전 화면으로 돌아가기" })).toBeVisible();
  await expect(page.getByRole("button", { name: /확인 필요/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("검토할 지식 영상")).toBeVisible();
  await expect(page.getByText("처리 중인 영상")).not.toBeVisible();

  await page.getByRole("button", { name: /처리 중/ }).click();
  await expect(page.getByText("처리 중인 영상")).toBeVisible();
  await expect(page.getByText("검토할 지식 영상")).not.toBeVisible();

  await page.getByRole("button", { name: /완료/ }).click();
  await expect(page.getByText("완료된 영상")).toBeVisible();
});

test("V2 검토는 요약을 먼저 보여주고 세부 근거를 필요할 때 펼친다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/knowledge", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "요약과 근거 확인" }).click();
  await expect(page.getByText("원문 사실과 해석을 구분한 검토 요약입니다.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "제작자의 주장과 영상 논리" })).toBeVisible();
  await expect(page.getByText("비판적 판단")).not.toBeVisible();

  await page.getByText("판단과 활용 제안").click();
  await expect(page.getByRole("heading", { name: "비판적 판단" })).toBeVisible();
  await expect(page.getByText("검토 시간과 수정 건수")).toBeVisible();

  await page.getByText("타임스탬프와 검증 근거").click();
  await expect(page.getByRole("link", { name: /\[00:51\] 원본에서 확인/ })).toHaveAttribute("href", /[?&]t=51s/);

  await page.getByRole("button", { name: "승인 명령 복사" }).click();
  await expect(page.getByRole("button", { name: "복사됨" })).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(`knowledge approve ${JOB_ID}`);
});

test("390px 모바일에서 지식함과 캡처 화면이 가로로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "요약과 근거 확인" }).click();

  const knowledgeDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(knowledgeDimensions.scrollWidth).toBeLessThanOrEqual(knowledgeDimensions.clientWidth);

  const approveButton = page.getByRole("button", { name: "승인 명령 복사" });
  const approveBox = await approveButton.boundingBox();
  expect(approveBox).not.toBeNull();
  expect(approveBox!.height).toBeGreaterThanOrEqual(44);

  await page.goto("/capture", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "지식으로 담기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "이전 화면으로 돌아가기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데스크톱 빠른 캡처" })).not.toBeVisible();

  const captureDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(captureDimensions.scrollWidth).toBeLessThanOrEqual(captureDimensions.clientWidth);
});
