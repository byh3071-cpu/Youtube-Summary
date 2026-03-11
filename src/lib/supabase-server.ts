import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 우리가 사용할 DB 타입(테이블들)을 최소한으로 정의해 두면 좋습니다.
type Database = {
  public: {
    Tables: {
      summaries: {
        Row: {
          id: number;
          video_id: string;
          summary: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          video_id: string;
          summary: string;
          source?: string | null;
          created_at?: string;
          id?: number;
        };
        Update: Partial<Database["public"]["Tables"]["summaries"]["Row"]>;
      };
      playlists: {
        Row: {
          id: string;
          title: string | null;
          items: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          title?: string | null;
          items: unknown;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["playlists"]["Row"]>;
      };
      bookmarks: {
        Row: {
          id: string;
          video_id: string;
          video_title: string;
          highlight: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          video_title: string;
          highlight: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Row"]>;
      };
    };
  };
};

/**
 * 서버 전용 Supabase 클라이언트.
 * - env가 없으면 null 반환해서 기능을 끌 수 있게 함.
 * - Service Role 키 사용 → 반드시 서버에서만 호출.
 */
export function getServerSupabaseClient():
  | SupabaseClient<Database>
  | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // 설정 안 돼 있으면 안전하게 null
    return null;
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false, // 서버에서는 세션 저장 필요 없음
    },
  });
}

/**
 * 요약(summaries) 기능 전용 Supabase 클라이언트 헬퍼.
 * 현재는 서버용 클라이언트를 그대로 재사용하지만,
 * 나중에 권한/스키마가 분리되면 이 함수만 수정하면 됩니다.
 */
export function getSupabaseForSummaries():
  | SupabaseClient<Database>
  | null {
  return getServerSupabaseClient();
}