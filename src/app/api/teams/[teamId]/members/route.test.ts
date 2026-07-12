import { describe, it, expect } from "vitest";
import { checkOwnerLockoutOnRemove, checkOwnerLockoutOnRoleChange } from "./route";

describe("checkOwnerLockoutOnRemove", () => {
  it("대상이 owner가 아니면 통과한다", () => {
    expect(checkOwnerLockoutOnRemove("admin", "member", 1)).toEqual({ ok: true });
    expect(checkOwnerLockoutOnRemove("owner", "admin", 1)).toEqual({ ok: true });
  });

  it("admin은 owner를 제거할 수 없다 (403)", () => {
    const r = checkOwnerLockoutOnRemove("admin", "owner", 3);
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("마지막 owner는 제거할 수 없다 (400) — admin 락아웃 시나리오 차단", () => {
    // owner가 1명뿐인 팀에서 그 owner를 제거하려는 모든 시도
    expect(checkOwnerLockoutOnRemove("owner", "owner", 1)).toMatchObject({ ok: false, status: 400 });
  });

  it("owner가 2명 이상이면 owner가 다른 owner를 제거할 수 있다", () => {
    expect(checkOwnerLockoutOnRemove("owner", "owner", 2)).toEqual({ ok: true });
  });
});

describe("checkOwnerLockoutOnRoleChange", () => {
  it("마지막 owner를 다른 역할로 강등하면 차단한다 (400)", () => {
    expect(checkOwnerLockoutOnRoleChange("owner", "member", 1)).toMatchObject({ ok: false, status: 400 });
    expect(checkOwnerLockoutOnRoleChange("owner", "admin", 1)).toMatchObject({ ok: false, status: 400 });
  });

  it("owner가 2명 이상이면 강등을 허용한다", () => {
    expect(checkOwnerLockoutOnRoleChange("owner", "member", 2)).toEqual({ ok: true });
  });

  it("owner→owner(무변경)나 owner 승격은 통과한다", () => {
    expect(checkOwnerLockoutOnRoleChange("owner", "owner", 1)).toEqual({ ok: true });
    expect(checkOwnerLockoutOnRoleChange("member", "owner", 1)).toEqual({ ok: true });
  });
});
