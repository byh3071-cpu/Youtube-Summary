"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-lg border border-(--notion-border) px-4 py-2.5 text-sm font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
    >
      로그아웃
    </button>
  );
}
