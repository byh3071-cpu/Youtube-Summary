import { Suspense } from "react";
import type { Metadata } from "next";
import AddDeepLinkClient from "./AddDeepLinkClient";

export const metadata: Metadata = {
  title: "채널 추가 — Focus Feed",
  robots: { index: false },
};

// 공유·북마클릿 딥링크 진입점. GET은 상태를 바꾸지 않고,
// 확인 화면에서 사용자가 [추가]를 눌러야 저장된다 (실수·CSRF 방지).
export default function AddPage() {
  return (
    <Suspense fallback={null}>
      <AddDeepLinkClient />
    </Suspense>
  );
}
