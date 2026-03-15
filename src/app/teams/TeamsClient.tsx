"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Plus, Settings, Bookmark } from "lucide-react";
import type { TeamWithRole } from "@/types/teams";
import { canManageTeam } from "@/types/teams";

type Team = TeamWithRole;

export default function TeamsClient({ teams }: { teams: Team[] }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "팀 생성 실패");
        return;
      }
      window.location.reload();
    } catch {
      setError("요청 실패");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
        <h2 className="mb-3 text-sm font-semibold text-(--notion-fg)/80">팀 만들기</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="팀 이름"
            className="flex-1 rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/40"
            aria-label="팀 이름"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="cta-primary flex items-center gap-1 rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Plus size={16} /> 만들기
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-(--notion-fg)/60">참여 중인 팀이 없습니다. 위에서 팀을 만들거나 초대 링크로 참여하세요.</p>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-(--notion-border) bg-(--notion-bg) px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Users size={18} className="text-(--notion-fg)/60" />
                <span className="font-medium">{t.name}</span>
                <span className="rounded bg-(--notion-gray) px-2 py-0.5 text-xs text-(--notion-fg)/70">
                  {t.role === "owner" ? "소유자" : t.role === "admin" ? "관리자" : "멤버"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {canManageTeam(t.role) && (
                  <Link
                    href={`/teams/${t.id}/settings`}
                    className="flex items-center gap-1 text-sm text-(--notion-fg)/70 hover:underline"
                  >
                    <Settings size={14} /> 설정
                  </Link>
                )}
                <Link
                  href={`/teams/${t.id}/bookmarks`}
                  className="flex items-center gap-1 text-sm text-(--notion-fg)/70 hover:underline"
                >
                  <Bookmark size={14} /> 북마크
                </Link>
                <Link
                  href={`/teams/${t.id}/briefing`}
                  className="text-sm text-(--notion-fg)/70 hover:underline"
                >
                  팀 브리핑
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
