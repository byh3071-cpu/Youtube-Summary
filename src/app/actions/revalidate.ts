"use server";

import { revalidatePath } from "next/cache";

/**
 * 홈 피드 캐시를 재검증한다. 인앱 새로고침 버튼 전용.
 *
 * 서버 액션이라 Next가 POST + Origin/Host 동일출처를 강제(CSRF 방어)하므로
 * 별도 시크릿·인증 헤더가 필요 없다. 공개 API 라우트를 없애 캐시 무효화
 * 남용 표면도 줄인다(호출에 빌드별 액션 ID가 필요).
 */
export async function revalidateHomeAction(): Promise<{ ok: boolean }> {
  revalidatePath("/");
  return { ok: true };
}
