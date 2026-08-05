# Channel Delete Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일과 PC에서 채널을 즉시 숨기고 5초 안에 실행 취소할 수 있으며, 느린 서버 처리와 실패 상태를 명확히 보여주는 삭제 흐름을 만든다.

**Architecture:** `AppLayout`에 `ChannelRemovalProvider`를 배치해 모바일 드로어와 PC 사이드바가 하나의 삭제 상태를 공유한다. `YouTubeSourceList`는 Provider의 숨김 ID를 필터링하고 삭제 의도를 전달하며, Provider가 5초 타이머·DELETE·12초 타임아웃·복원·전역 알림을 담당한다.

**Tech Stack:** Next.js 16.3, React 19 client context, TypeScript, Tailwind CSS, Playwright 1.57

## Global Constraints

- 휴지통 클릭 후 100ms 안에 채널 행과 상태 메시지를 갱신한다.
- 실제 DELETE 요청은 5,000ms 실행 취소 구간이 끝난 뒤에만 보낸다.
- DELETE 요청은 12,000ms에 중단하고 채널을 복원한다.
- 한 번에 하나의 채널 삭제만 진행한다.
- 실행 취소·다시 시도 버튼은 최소 44×44px이어야 한다.
- 기존 `/api/custom-sources` 요청·응답 스키마와 Supabase·쿠키 로직은 변경하지 않는다.
- 새 런타임 의존성을 추가하지 않는다.

---

### Task 1: 공통 삭제 상태와 5초 실행 취소

**Files:**
- Create: `src/components/layout/ChannelRemovalProvider.tsx`
- Modify: `src/components/layout/AppLayout.tsx:1-72`
- Modify: `src/components/layout/YouTubeSourceList.tsx:1-151`
- Test: `e2e/mobile-ux.spec.ts:48-72`

**Interfaces:**
- Consumes: `FeedSource`, `useRouter()`, 현재 YouTube source ID 배열
- Produces: `ChannelRemovalProvider`, `useChannelRemoval()`, `requestRemoval(source)`, `undoRemoval()`, `hiddenSourceIds`, `pendingSourceId`

- [ ] **Step 1: 실행 취소 E2E를 먼저 작성한다**

기존 모바일 삭제 테스트 앞에 다음 흐름을 추가한다. hydration 이후 clock을 설치해야 앱 초기 타이머를 막지 않는다.

```ts
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

  await expect(drawer.getByText(rowLabel, { exact: true })).toBeHidden();
  await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제할 예정이에요");
  expect(deleteCalls).toBe(0);

  await page.getByTestId("channel-removal-undo").click();
  await expect(drawer.getByText(rowLabel, { exact: true })).toBeVisible();
  await page.clock.fastForward(5_000);
  expect(deleteCalls).toBe(0);
});
```

- [ ] **Step 2: 새 테스트가 실패하는지 확인한다**

Run:

```powershell
$env:CI='true'
$env:FOCUS_FEED_E2E_FIXTURES='1'
npx.cmd playwright test e2e/mobile-ux.spec.ts --project=mobile-chromium --grep "undo prevents DELETE"
```

Expected: `channel-removal-notice` 또는 `channel-removal-undo`가 없어서 FAIL.

- [ ] **Step 3: Provider의 공개 계약과 기본 상태를 구현한다**

`ChannelRemovalProvider.tsx`에 다음 계약을 만들고 `ChannelRemovalProvider` 밖에서 hook을 호출하면 명확한 오류를 던진다.

```ts
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { FeedSource } from "@/lib/sources";

const UNDO_WINDOW_MS = 5_000;
const DELETE_TIMEOUT_MS = 12_000;

type RemovalPhase = "undo" | "deleting" | "success" | "error";
type PendingRemoval = { source: FeedSource; phase: RemovalPhase; error?: string };

interface ChannelRemovalContextValue {
  hiddenSourceIds: ReadonlySet<string>;
  pendingSourceId: string | null;
  pendingPhase: RemovalPhase | null;
  requestRemoval: (source: FeedSource) => void;
  undoRemoval: () => void;
  retryRemoval: () => void;
  dismissNotice: () => void;
}
```

`requestRemoval`은 대상 ID를 `hiddenSourceIds`에 추가하고 phase를 `undo`로 설정한 뒤 5,000ms 타이머를 만든다. `undoRemoval`은 타이머를 취소하고 ID를 숨김 집합에서 제거한 뒤 pending 상태를 비운다. Provider unmount 시 타이머와 AbortController를 정리한다.

Task 1의 성공 경로는 다음 함수 형태로 완성한다. Task 2에서 같은 함수를 타임아웃·오류 복원까지 확장한다.

```ts
const commitRemoval = useCallback(async (source: FeedSource) => {
  setPending({ source, phase: "deleting" });
  const response = await fetch(`/api/custom-sources?sourceId=${encodeURIComponent(source.id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("채널 삭제 요청에 실패했습니다.");
  setPending({ source, phase: "success" });
  router.refresh();
}, [router]);

const requestRemoval = useCallback((source: FeedSource) => {
  if (pendingRef.current) return;
  setHiddenSourceIds((current) => new Set(current).add(source.id));
  setPending({ source, phase: "undo" });
  undoTimerRef.current = window.setTimeout(() => {
    void commitRemoval(source);
  }, UNDO_WINDOW_MS);
}, [commitRemoval]);

const undoRemoval = useCallback(() => {
  const sourceId = pendingRef.current?.source.id;
  if (!sourceId || pendingRef.current?.phase !== "undo") return;
  if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  setHiddenSourceIds((current) => {
    const next = new Set(current);
    next.delete(sourceId);
    return next;
  });
  setPending(null);
}, []);
```

- [ ] **Step 4: AppLayout과 목록을 Provider에 연결한다**

`AppLayout`의 현재 최상위 `<div>` 바로 앞에 Provider를 열고, 그 `<div>`의 닫는 태그 바로 뒤에서 Provider를 닫는다.

```tsx
return (
    <ChannelRemovalProvider sourceIds={(youtubeSources ?? []).map((source) => source.id)}>
        <div className="flex min-h-screen flex-col bg-(--notion-bg) text-(--notion-fg)">
```

파일 끝의 반환부는 다음 두 닫는 태그와 세미콜론으로 끝낸다.

```tsx
        </div>
    </ChannelRemovalProvider>
);
```

`YouTubeSourceList`에서는 직접 fetch와 `router.refresh()`를 제거하고 공통 상태를 사용한다.

```ts
const {
  hiddenSourceIds,
  pendingSourceId,
  requestRemoval,
} = useChannelRemoval();
const visibleItems = items.filter((item) => !hiddenSourceIds.has(item.id));

const handleRemove = (e: React.MouseEvent, source: FeedSource) => {
  e.preventDefault();
  e.stopPropagation();
  requestRemoval(source);
};
```

목록 반복문의 시작을 `visibleItems.map((item) => {`로 바꾸고 삭제 버튼은 `disabled={pendingSourceId !== null}` 및 `aria-busy={pendingSourceId === item.id}`를 갖는다.

- [ ] **Step 5: 실행 취소 E2E를 통과시킨다**

Run: Step 2와 동일.

Expected: 1 passed, DELETE 호출 수 0.

- [ ] **Step 6: 첫 기능 커밋을 만든다**

```powershell
git add src/components/layout/ChannelRemovalProvider.tsx src/components/layout/AppLayout.tsx src/components/layout/YouTubeSourceList.tsx e2e/mobile-ux.spec.ts
git commit -m "feat(feed): 채널 삭제 실행 취소 추가"
```

---

### Task 2: 서버 처리·실패 복원·다시 시도

**Files:**
- Modify: `src/components/layout/ChannelRemovalProvider.tsx`
- Test: `e2e/mobile-ux.spec.ts`

**Interfaces:**
- Consumes: Task 1의 `PendingRemoval`, `requestRemoval`, 숨김 ID 집합
- Produces: 5초 후 DELETE, 12초 AbortController, `retryRemoval`, `dismissNotice`, 성공·실패 알림

- [ ] **Step 1: 성공·실패 테스트를 먼저 작성한다**

성공 테스트는 route 응답을 보류해 `deleting` 문구를 관찰한 뒤 성공시킨다.

```ts
test("channel removal commits after five seconds and reports progress", async ({ page }) => {
  let releaseResponse!: () => void;
  const release = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route("**/api/custom-sources?sourceId=*", async (route) => {
    await release;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await gotoHydratedHome(page);
  await page.clock.install();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByTestId("mobile-nav-drawer").getByRole("button", { name: /채널 목록에서 제거$/ }).first().click();
  const requestPromise = page.waitForRequest((request) => request.method() === "DELETE" && request.url().includes("/api/custom-sources?sourceId="));
  await page.clock.fastForward(5_000);
  await requestPromise;
  await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제하는 중이에요");
  releaseResponse();
  await expect(page.getByTestId("channel-removal-notice")).toContainText("삭제했어요");
});
```

실패 테스트는 500을 반환하고 숨긴 행 복원, 오류 문구, 다시 시도 버튼을 확인한다.

```ts
test("failed channel removal restores the row and offers retry", async ({ page }) => {
  await page.route("**/api/custom-sources?sourceId=*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "delete failed" }) }),
  );
  await gotoHydratedHome(page);
  await page.clock.install();
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const drawer = page.getByTestId("mobile-nav-drawer");
  const channelRow = drawer.getByText("드로우앤드류 (DrawAndrew)", { exact: true });
  await drawer.getByRole("button", { name: /채널 목록에서 제거$/ }).first().click();
  await page.clock.fastForward(5_000);

  await expect(channelRow).toBeVisible();
  await expect(page.getByTestId("channel-removal-notice")).toContainText("delete failed");
  await expect(page.getByTestId("channel-removal-retry")).toBeVisible();
});
```

타임아웃 테스트는 브라우저의 DELETE fetch만 AbortSignal까지 대기하도록 바꾸고 17초를 진행한다.

```ts
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
await page.clock.fastForward(17_000);
await expect(channelRow).toBeVisible();
await expect(page.getByTestId("channel-removal-notice")).toContainText("응답이 늦어");
```

- [ ] **Step 2: 새 성공·실패 테스트가 실패하는지 확인한다**

Run:

```powershell
$env:CI='true'
$env:FOCUS_FEED_E2E_FIXTURES='1'
npx.cmd playwright test e2e/mobile-ux.spec.ts --project=mobile-chromium --grep "channel removal"
```

Expected: DELETE 또는 진행·오류 알림이 구현되지 않아 FAIL.

- [ ] **Step 3: DELETE와 타임아웃을 구현한다**

Provider 내부 `commitRemoval`은 다음 순서로 동작한다.

```ts
const commitRemoval = useCallback(async (source: FeedSource) => {
  setPending({ source, phase: "deleting" });
  const controller = new AbortController();
  abortRef.current = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), DELETE_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/custom-sources?sourceId=${encodeURIComponent(source.id)}`, {
      method: "DELETE",
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(body?.error ?? "채널 삭제 요청에 실패했습니다.");
    setPending({ source, phase: "success" });
    router.refresh();
  } catch (error) {
    setHiddenSourceIds((current) => {
      const next = new Set(current);
      next.delete(source.id);
      return next;
    });
    setPending({
      source,
      phase: "error",
      error: error instanceof Error && error.name !== "AbortError"
        ? error.message
        : "응답이 늦어 삭제하지 못했어요.",
    });
  } finally {
    window.clearTimeout(timeoutId);
    abortRef.current = null;
  }
}, [router]);
```

성공 문구는 2초 뒤 닫되 숨김 ID는 `sourceIds` prop에서 해당 ID가 사라진 뒤 정리한다. 오류 알림은 사용자가 닫거나 다시 시도할 때까지 유지한다. `retryRemoval`은 오류 대상에 `requestRemoval`을 다시 호출한다.

- [ ] **Step 4: 상태별 전역 알림을 구현한다**

Provider가 children 다음에 `data-testid="channel-removal-notice"`인 fixed 알림을 렌더링한다. phase별 문구와 버튼은 다음과 같다.

```ts
const copy = {
  undo: `${pending.source.name} 채널을 삭제할 예정이에요`,
  deleting: `${pending.source.name} 채널을 삭제하는 중이에요`,
  success: `${pending.source.name} 채널을 삭제했어요`,
  error: pending.error ?? "채널을 삭제하지 못했어요.",
};
```

`undo`에는 `channel-removal-undo`, `error`에는 `channel-removal-retry`, 성공·오류에는 닫기 버튼을 제공한다.

- [ ] **Step 5: 채널 삭제 테스트를 통과시킨다**

Run: Step 2와 동일.

Expected: 실행 취소·성공·실패 테스트 모두 PASS.

- [ ] **Step 6: 오류 처리 커밋을 만든다**

```powershell
git add src/components/layout/ChannelRemovalProvider.tsx e2e/mobile-ux.spec.ts
git commit -m "fix(feed): 채널 삭제 실패 시 자동 복원"
```

---

### Task 3: PC·모바일 배치와 회귀 게이트

**Files:**
- Modify: `src/components/layout/ChannelRemovalProvider.tsx`
- Test: `e2e/mobile-ux.spec.ts`

**Interfaces:**
- Consumes: Task 2의 전역 알림과 상태 버튼
- Produces: safe-area·라디오 플레이어 회피 배치, 44px 터치 영역, PC·모바일 회귀 증거

- [ ] **Step 1: PC와 모바일 배치·터치 영역 테스트를 작성한다**

같은 spec에서 뷰포트를 각각 393×852와 1440×900으로 설정한다. 모바일에서는 라디오에 첫 항목을 추가한 뒤 알림과 플레이어의 bounding box를 비교한다.

```ts
const noticeBox = await page.getByTestId("channel-removal-notice").boundingBox();
const playerBox = await page.getByTestId("radio-player").boundingBox();
const undoBox = await page.getByTestId("channel-removal-undo").boundingBox();
expect(noticeBox).not.toBeNull();
expect(playerBox).not.toBeNull();
expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(playerBox!.y);
expect(undoBox!.width).toBeGreaterThanOrEqual(44);
expect(undoBox!.height).toBeGreaterThanOrEqual(44);
```

PC에서는 `page.setViewportSize({ width: 1440, height: 900 })` 후 `desktop-sidebar`의 첫 채널 행을 hover하고 삭제한다. 알림이 viewport 오른쪽·아래 경계를 넘지 않는지 검사한다.

- [ ] **Step 2: 배치 테스트가 실패하는지 확인한다**

Run:

```powershell
$env:CI='true'
$env:FOCUS_FEED_E2E_FIXTURES='1'
npx.cmd playwright test e2e/mobile-ux.spec.ts --project=mobile-chromium --grep "removal notice"
```

Expected: 초기 알림 위치 또는 버튼 크기가 계약과 다르면 FAIL.

- [ ] **Step 3: 반응형 알림 스타일과 접근성 속성을 완성한다**

알림 컨테이너에 다음 기준을 적용한다.

```tsx
<div
  data-testid="channel-removal-notice"
  role="status"
  aria-live="polite"
  className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+7rem)] z-[90] mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-(--border-subtle) bg-(--surface-raised) p-3 shadow-xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[min(26rem,calc(100vw-3rem))]"
>
```

실행 취소·다시 시도·닫기 버튼은 `min-h-11 min-w-11 touch-manipulation focus-visible:ring-2`를 사용한다. Loader 아이콘에는 `aria-hidden`을 지정한다.

- [ ] **Step 4: 표적 E2E와 전체 검증을 실행한다**

Run:

```powershell
$env:CI='true'
$env:FOCUS_FEED_E2E_FIXTURES='1'
npx.cmd playwright test e2e/mobile-ux.spec.ts --project=mobile-chromium
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run vhk:policy
git diff --check
```

Expected: 모바일 UX 전체 PASS, unit 188개 이상 PASS, lint·build·VHK·diff check PASS.

- [ ] **Step 5: 최종 구현 커밋을 만든다**

```powershell
git add src/components/layout/ChannelRemovalProvider.tsx e2e/mobile-ux.spec.ts
git commit -m "fix(feed): 삭제 알림 모바일 겹침 방지"
```

- [ ] **Step 6: 최종 변경 범위를 확인한다**

```powershell
git status --short
git diff origin/main...HEAD --stat
git log --oneline origin/main..HEAD
```

Expected: 설계·계획 문서, Provider, AppLayout, YouTubeSourceList, mobile UX spec만 변경되고 비밀값이나 `.env.local`은 포함되지 않는다.
