"use client";

import { useCallback, useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface Props {
  teamId: string;
  currentUserRole: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function TeamMemberList({ teamId, currentUserRole }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // memberId being mutated

  /* ---- fetch ---- */
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "멤버 목록을 불러올 수 없습니다.");
      }
      const json = await res.json();
      setMembers(json.members ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  /* ---- role change ---- */
  const handleRoleChange = async (memberId: string, newRole: string) => {
    setBusy(memberId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "역할 변경에 실패했습니다.");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
    } finally {
      setBusy(null);
    }
  };

  /* ---- remove ---- */
  const handleRemove = async (memberId: string) => {
    if (!confirm("정말 이 멤버를 팀에서 제거하시겠습니까?")) return;
    setBusy(memberId);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "멤버 제거에 실패했습니다.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } finally {
      setBusy(null);
    }
  };

  /* ---- render ---- */
  if (loading) {
    return (
      <div className="py-6 text-center text-sm" style={{ color: "var(--notion-fg)" }}>
        멤버 목록을 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-red-500">
        {error}
        <button
          onClick={fetchMembers}
          className="ml-2 underline"
          style={{ color: "var(--notion-fg)" }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  const isOwner = currentUserRole === "owner";

  return (
    <div className="w-full">
      <h3
        className="mb-3 text-sm font-semibold"
        style={{ color: "var(--notion-fg)" }}
      >
        팀 멤버 ({members.length})
      </h3>

      <ul className="divide-y" style={{ borderColor: "var(--notion-border)" }}>
        {members.map((m) => {
          const isBusy = busy === m.id;

          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-2 py-2.5 text-sm transition-colors"
              style={{
                color: "var(--notion-fg)",
                backgroundColor: "var(--notion-bg)",
              }}
            >
              {/* left: user id + role badge */}
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate">{m.user_id}</span>
                {!isOwner && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: "var(--notion-hover)",
                      color: "var(--notion-fg)",
                    }}
                  >
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                )}
              </div>

              {/* right: controls (owner only) */}
              {isOwner && (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={m.role}
                    disabled={isBusy}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="rounded border px-1.5 py-1 text-xs outline-none"
                    style={{
                      borderColor: "var(--notion-border)",
                      backgroundColor: "var(--notion-bg)",
                      color: "var(--notion-fg)",
                    }}
                  >
                    <option value="owner">소유자</option>
                    <option value="admin">관리자</option>
                    <option value="member">멤버</option>
                  </select>

                  <button
                    disabled={isBusy}
                    onClick={() => handleRemove(m.id)}
                    className="rounded px-2 py-1 text-xs transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                    style={{ color: "var(--notion-fg)" }}
                  >
                    제거
                  </button>
                </div>
              )}
            </li>
          );
        })}

        {members.length === 0 && (
          <li
            className="py-4 text-center text-sm"
            style={{ color: "var(--notion-fg)", opacity: 0.5 }}
          >
            팀 멤버가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}
