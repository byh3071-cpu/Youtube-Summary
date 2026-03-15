import Link from "next/link";
import { Check, Rss, Radio, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-(--notion-bg) text-(--notion-fg)">
      <header className="border-b border-(--notion-border) px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xl font-bold">Focus Feed</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-(--notion-fg)/80 hover:text-(--notion-fg)"
            >
              요금제
            </Link>
            <Link
              href="/login"
              className="cta-primary rounded-full bg-(--notion-fg) px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              로그인
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-(--notion-fg)/80 hover:text-(--notion-fg)"
            >
              피드 바로가기
            </Link>
          </nav>
        </div>
      </header>

      <section className="px-4 py-20 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          유튜브와 RSS를 한 곳에서.
          <br />
          <span className="text-(--notion-fg)/70">AI 요약으로 핵심만 빠르게.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-(--notion-fg)/70">
          구독 채널과 뉴스를 하나의 피드로 모아보고, 목표에 맞는 영상만 골라보세요.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="cta-primary rounded-full bg-(--notion-fg) px-8 py-4 text-base font-semibold hover:opacity-90"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-(--notion-border) px-8 py-4 text-base font-semibold text-(--notion-fg) hover:bg-(--notion-hover)"
          >
            Pro 요금제 보기
          </Link>
        </div>
      </section>

      <section className="border-t border-(--notion-border) px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold">왜 Focus Feed인가</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-6">
              <div className="mb-4 inline-flex rounded-xl bg-(--notion-gray) p-3">
                <Rss className="h-6 w-6 text-(--notion-fg)/80" />
              </div>
              <h3 className="mb-2 font-semibold">한 곳에 모은 피드</h3>
              <p className="text-sm text-(--notion-fg)/70">
                유튜브 채널과 RSS 소스를 한 리스트로. 카테고리·키워드로 필터링해 원하는 것만 보세요.
              </p>
            </div>
            <div className="rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-6">
              <div className="mb-4 inline-flex rounded-xl bg-(--notion-gray) p-3">
                <Sparkles className="h-6 w-6 text-(--notion-fg)/80" />
              </div>
              <h3 className="mb-2 font-semibold">AI 3줄 요약·브리핑</h3>
              <p className="text-sm text-(--notion-fg)/70">
                영상 요약, 인사이트, 목표 기반 “오늘 볼 영상” 추천. Pro는 무제한.
              </p>
            </div>
            <div className="rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-6">
              <div className="mb-4 inline-flex rounded-xl bg-(--notion-gray) p-3">
                <Radio className="h-6 w-6 text-(--notion-fg)/80" />
              </div>
              <h3 className="mb-2 font-semibold">라디오 모드</h3>
              <p className="text-sm text-(--notion-fg)/70">
                큐에 넣고 백그라운드로 재생. 출퇴근·작업 중에도 들을 수 있어요.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-(--notion-border) px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-6 text-2xl font-bold">Free로 시작하세요</h2>
          <ul className="mb-8 space-y-3 text-left text-(--notion-fg)/80">
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-green-500" />
              요약 일 5회, 인사이트 일 3회, 브리핑 주 1회
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-green-500" />
              피드·북마크·라디오 무제한
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-green-500" />
              Pro는 ₩9,900/월에 무제한
            </li>
          </ul>
          <Link
            href="/login"
            className="cta-primary inline-block rounded-full bg-(--notion-fg) px-8 py-3 text-base font-semibold hover:opacity-90"
          >
            로그인하고 시작하기
          </Link>
        </div>
      </section>

      <footer className="border-t border-(--notion-border) px-4 py-8">
        <div className="mx-auto max-w-5xl text-center text-sm text-(--notion-fg)/50">
          <Link href="/" className="hover:text-(--notion-fg)/70">피드</Link>
          {" · "}
          <Link href="/pricing" className="hover:text-(--notion-fg)/70">요금제</Link>
          {" · "}
          <Link href="/login" className="hover:text-(--notion-fg)/70">로그인</Link>
        </div>
      </footer>
    </main>
  );
}
