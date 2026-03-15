"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Mail } from "lucide-react";

type Props = {
  teamId: string;
  initialName: string;
  initialGoalText: string;
  canManage: boolean;
};

export default function TeamSettingsClient({
  teamId,
  initialName,
  initialGoalText,
  canManage,
}: Props) {
  const [name, setName] = useState(initialName);
  const [goalText, setGoalText] = useState(initialGoalText);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    if (!canManage) return;
    setSaveMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), goal_text: goalText.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error ?? "저장 실패");
        return;
      }
      setSaveMessage("저장되었습니다.");
    } catch {
      setSaveMessage("요청 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteError(null);
    setInviteLink(null);
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "초대 실패");
        return;
      }
      setInviteLink(data.inviteLink ?? null);
      setInviteEmail("");
    } catch {
      setInviteError("요청 실패");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 팀 목표 / 이름 */}
      <section className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
        <h2 className="mb-3 text-sm font-semibold text-(--notion-fg)/80">팀 정보</h2>
        {canManage ? (
          <>
            <label className="mb-1 block text-xs text-(--notion-fg)/60">팀 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4 w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg)"
            />
            <label className="mb-1 block text-xs text-(--notion-fg)/60">팀 목표 (브리핑에 사용)</label>
            <textarea
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              rows={3}
              placeholder="예: AI·프로덕트 뉴스, 마케팅 인사이트"
              className="mb-3 w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/40"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="cta-primary rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
              {saveMessage && (
                <span className="text-sm text-(--notion-fg)/60">{saveMessage}</span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-(--notion-fg)/70">
            {goalText || "팀 목표가 설정되지 않았습니다. 소유자/관리자만 수정할 수 있습니다."}
          </p>
        )}
      </section>

      {/* 초대하기 */}
      {canManage && (
        <section className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-(--notion-fg)/80">
            <Mail size={16} /> 팀원 초대
          </h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="초대할 이메일"
              className="flex-1 rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/40"
            />
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail.trim()}
              className="cta-primary rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {inviteLoading ? "처리 중…" : "초대 링크 생성"}
            </button>
          </div>
          {inviteError && <p className="mt-2 text-sm text-red-500">{inviteError}</p>}
          {inviteLink && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-(--notion-gray) p-3">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="min-w-0 flex-1 rounded border-0 bg-transparent text-xs text-(--notion-fg)"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-(--notion-fg) hover:bg-(--notion-fg)/10"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-(--notion-fg)/50">링크는 7일간 유효합니다.</p>
        </section>
      )}

      {/* 팀 플랜 (스케치) */}
      {canManage && (
        <section className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
          <h2 className="mb-2 text-sm font-semibold text-(--notion-fg)/80">팀 플랜</h2>
          <p className="mb-2 text-sm text-(--notion-fg)/60">
            팀 단위 Pro 업그레이드는 준비 중입니다. 개인 요금제는 요금제 페이지에서 구독할 수 있어요.
          </p>
          <Link
            href="/pricing"
            className="inline-block text-sm font-medium text-(--notion-fg) underline hover:no-underline"
          >
            요금제 보기 →
          </Link>
        </section>
      )}

      <p className="text-sm text-(--notion-fg)/60">
        <Link href={`/teams/${teamId}/briefing`} className="underline hover:text-(--notion-fg)">
          팀 브리핑
        </Link>
        {" · "}
        <Link href={`/teams/${teamId}/bookmarks`} className="underline hover:text-(--notion-fg)">
          팀 북마크
        </Link>
      </p>
    </div>
  );
}
