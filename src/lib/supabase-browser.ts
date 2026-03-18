import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient<Database> | undefined;

/**
 * 브라우저 전용 Supabase 클라이언트 싱글톤 반환.
 * 매번 새로 생성하면 인증 상태 감지 및 세션 유지에 문제가 생길 수 있음.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (client) return client;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return client;
}
