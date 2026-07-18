import { describe, expect, it } from "vitest";
import { reorderQueue } from "@/lib/radio-queue";

const queue = ["a", "b", "c", "d"];

describe("reorderQueue", () => {
  it("현재 항목 자체를 이동해도 같은 항목을 유지한다", () => {
    const result = reorderQueue(queue, 1, 1, 3);

    expect(result.queue).toEqual(["a", "c", "d", "b"]);
    expect(result.currentIndex).toBe(3);
    expect(result.queue[result.currentIndex]).toBe("b");
  });

  it("앞 항목이 현재 위치 뒤로 이동하면 currentIndex를 한 칸 당긴다", () => {
    const result = reorderQueue(queue, 2, 0, 3);

    expect(result.queue).toEqual(["b", "c", "d", "a"]);
    expect(result.currentIndex).toBe(1);
    expect(result.queue[result.currentIndex]).toBe("c");
  });

  it("뒤 항목이 현재 위치 앞으로 이동하면 currentIndex를 한 칸 민다", () => {
    const result = reorderQueue(queue, 1, 3, 0);

    expect(result.queue).toEqual(["d", "a", "b", "c"]);
    expect(result.currentIndex).toBe(2);
    expect(result.queue[result.currentIndex]).toBe("b");
  });

  it("현재 위치를 가로지르지 않는 이동은 currentIndex를 유지한다", () => {
    const result = reorderQueue(queue, 3, 0, 1);

    expect(result.queue).toEqual(["b", "a", "c", "d"]);
    expect(result.currentIndex).toBe(3);
  });

  it("범위를 벗어난 이동은 원본 참조와 상태를 그대로 반환한다", () => {
    const result = reorderQueue(queue, 1, -1, 2);

    expect(result.queue).toBe(queue);
    expect(result.currentIndex).toBe(1);
  });
});
