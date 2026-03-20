"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AlertCircle, X } from "lucide-react";

const MESSAGES: Record<string, string> = {
  no_code: "로그인 링크가 만료되었거나 잘못되었습니다. 다시 로그인해 주세요.",
  config: "일시적인 로그인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  exchange: "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
};

interface Props {
  authError: string | undefined;
  /** 서버에서 전달한 에러 설명 (Supabase error_description 등) */
  authErrorHint?: string | null;
}

export default function AuthErrorBanner({ authError }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const message =
    typeof authError === "string" && authError in MESSAGES ? MESSAGES[authError] : null;

  const handleDismiss = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth_error");
    params.delete("auth_error_hint");
    params.delete("error");
    params.delete("error_description");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, searchParams, router]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 space-y-1.5">
            <p>{message}</p>
            <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
              문제가 계속되면 다른 브라우저나 시크릿 모드로 시도해 보세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
