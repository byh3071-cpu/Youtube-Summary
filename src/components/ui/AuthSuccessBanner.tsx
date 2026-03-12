"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CheckCircle2, X } from "lucide-react";

interface Props {
  authSuccess: boolean;
}

export default function AuthSuccessBanner({ authSuccess }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleDismiss = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth_success");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, searchParams, router]);

  if (!authSuccess) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
    >
      <div className="flex min-w-0 items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">Google로 로그인되었습니다.</span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
