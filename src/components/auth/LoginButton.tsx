"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface UserInfo {
  email?: string;
}

export function LoginButton() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let mounted = true;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ? { email: session.user.email ?? undefined } : null);
        }
      } catch (err) {
        console.error("LoginButton checkSession error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ? { email: session.user.email ?? undefined } : null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 구글 로그인 콜백 직후: URL에 auth_success가 있으면 세션을 강제로 다시 확인
  useEffect(() => {
    if (!searchParams.get("auth_success")) return;
    
    const supabase = getSupabaseBrowserClient();
    const t = setTimeout(async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) setUser({ email: u.email ?? undefined });
    }, 500);
    
    return () => clearTimeout(t);
  }, [searchParams]);

  const handleLogin = async () => {
    const supabase = getSupabaseBrowserClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin ? `${origin}/auth/callback` : undefined,
      },
    });
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <button
        type="button"
        className="rounded-full bg-(--notion-gray)/30 px-2.5 py-1 text-[11px] text-(--notion-fg)/60"
        disabled
      >
        로그인 확인 중…
      </button>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleLogin}
        className="rounded-full bg-(--notion-gray)/30 px-3 py-2 text-[11px] font-medium text-(--notion-fg)/85 transition-colors hover:bg-(--notion-hover) min-h-[32px] touch-manipulation whitespace-nowrap"
      >
        Google로 로그인
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-(--notion-gray)/20 pl-2.5 pr-1 py-1 text-[11px] text-(--notion-fg)/85">
      <span className="max-w-[120px] truncate" title={user.email}>
        {user.email ?? "로그인됨"}
      </span>
      <span className="text-(--notion-fg)/40" aria-hidden>|</span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full bg-(--notion-fg) px-3 py-1.5 text-[11px] font-semibold text-(--notion-bg) transition-colors hover:bg-(--notion-fg)/90 min-h-[32px] touch-manipulation whitespace-nowrap leading-none"
      >
        로그아웃
      </button>
    </div>
  );
}

