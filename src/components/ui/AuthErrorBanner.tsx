"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

const MESSAGES: Record<string, string> = {
  no_code: "로그인 링크가 만료되었거나 잘못되었습니다. 다시 로그인해 주세요.",
  config: "로그인 설정이 올바르지 않습니다. 환경 변수를 확인해 주세요.",
  exchange: "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
};

const NO_CODE_HINT =
  "Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs에 아래 주소를 추가하세요: ";

interface Props {
  authError: string | undefined;
  /** 서버에서 전달한 에러 설명 (Supabase error_description 등) */
  authErrorHint?: string | null;
}

export default function AuthErrorBanner({ authError, authErrorHint: hintProp }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hintFromUrl = searchParams.get("auth_error_hint");
  const hint = hintProp ?? hintFromUrl;
  const [callbackUrlHint, setCallbackUrlHint] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/auth/callback`;
    const id = setTimeout(() => setCallbackUrlHint(url), 0);
    return () => clearTimeout(id);
  }, []);

  const message =
    typeof authError === "string" && authError in MESSAGES ? MESSAGES[authError] : null;
  const showNoCodeHelp = authError === "no_code" && callbackUrlHint;
  const isSupabaseExchangeError =
    typeof hint === "string" && hint.toLowerCase().includes("unable to exchange external code");

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
            {isSupabaseExchangeError && (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                Supabase가 Google과 인증 코드 교환에 실패했습니다. 아래 1~3을 모두 확인하세요.
              </p>
            )}
            {hint && !isSupabaseExchangeError && (
              <p className="text-xs text-amber-700/90 dark:text-amber-300/90">{hint}</p>
            )}
            {showNoCodeHelp && (
              <p className="text-xs">
                <span className="font-medium">1) Supabase URL:</span> Authentication → URL Configuration → Redirect URLs에
                <code className="mx-1 rounded bg-amber-500/20 px-1 py-0.5 break-all">{callbackUrlHint}</code>
                추가
              </p>
            )}
            {showNoCodeHelp && isSupabaseExchangeError && (
              <>
                <p className="text-xs">
                  <span className="font-medium">2) Google Cloud 리디렉션 URI:</span> 같은 OAuth 클라이언트 → 승인된 리디렉션 URI에
                  <code className="mx-1 block mt-1 rounded bg-amber-500/20 px-1 py-0.5 break-all">
                    https://&lt;프로젝트ID&gt;.supabase.co/auth/v1/callback
                  </code>
                  추가
                </p>
                <p className="text-xs">
                  <span className="font-medium">3) Supabase:</span> Providers → Google 사용 + <strong>Client ID</strong>, <strong>Client Secret</strong> 붙여넣기 (공백 없이)
                </p>
                <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                  <span className="font-medium">+ 다 했는데도 안 되면:</span> Google Cloud 같은 클라이언트에서 <strong>승인된 JavaScript 원본</strong>에 <code className="rounded bg-amber-500/20 px-1">http://localhost:3000</code> 추가. OAuth 동의 화면이 <strong>테스트</strong>면 <strong>테스트 사용자</strong>에 로그인할 이메일 추가.
                </p>
              </>
            )}
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
