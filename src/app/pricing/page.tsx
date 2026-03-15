import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getPlanForUser } from "@/lib/plan";
import PricingClient from "./PricingClient";

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; canceled?: string }>;
}) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  const plan = user ? await getPlanForUser(cookieStore) : null;
  const params = await searchParams ?? {};
  const success = params.success === "1";
  const canceled = params.canceled === "1";

  return (
    <main className="min-h-screen bg-(--notion-bg) text-(--notion-fg)">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-full border border-(--notion-border) bg-(--notion-bg) px-4 py-2 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
          >
            ← 피드로
          </Link>
          {user ? (
            <span className="text-sm text-(--notion-fg)/60">{user.email}</span>
          ) : (
            <Link
              href="/login"
              className="cta-primary rounded-full bg-(--notion-fg) px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              로그인
            </Link>
          )}
        </div>

        <h1 className="mb-2 text-3xl font-bold">요금제</h1>
        <p className="mb-8 text-(--notion-fg)/70">
          Focus Feed로 더 많은 영상을 요약하고, 목표에 맞는 브리핑을 받아보세요.
        </p>

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
            Pro 구독이 완료되었습니다. 이제 무제한으로 요약·인사이트·브리핑을 이용할 수 있습니다.
          </div>
        )}
        {canceled && (
          <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            결제가 취소되었습니다. 언제든 다시 구독할 수 있습니다.
          </div>
        )}

        <PricingClient isLoggedIn={!!user} currentPlan={plan} />
      </div>
    </main>
  );
}
