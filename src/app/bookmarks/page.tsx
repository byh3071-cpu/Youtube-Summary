import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies, getBookmarksFromDb } from "@/lib/supabase-server-cookies";
import BookmarksClient from "./BookmarksClient";
import FloatingRadioPlayer from "@/components/player/FloatingRadioPlayer";

export default async function BookmarksPage() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
        >
          <span>← 피드로 돌아가기</span>
        </Link>
        <h1 className="mb-4 text-2xl font-bold text-(--notion-fg)">북마크</h1>
        <p className="mb-6 text-sm text-(--notion-fg)/65">
          로그인하면 영상과 요약을 북마크로 저장하고 나중에 모아볼 수 있습니다.
        </p>
        <FloatingRadioPlayer />
      </main>
    );
  }

  const bookmarks = await getBookmarksFromDb(cookieStore);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
      >
        <span>← 피드로 돌아가기</span>
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-(--notion-fg)">북마크</h1>
      <p className="mb-6 text-sm text-(--notion-fg)/65">
        저장한 영상과 AI 요약 메모를 한 번에 모아봅니다. 원하는 북마크는 바로 라디오 플레이어로 들을 수도 있어요.
      </p>
      <BookmarksClient bookmarks={bookmarks} />
      <div className="fixed inset-x-0 bottom-0 z-40">
        <FloatingRadioPlayer />
      </div>
    </main>
  );
}
