"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  HIDDEN_SOURCES_COOKIE_NAME,
  SYNC_OWNER_COOKIE_NAME,
  getCustomSourcesFromCookie,
  getHiddenSourceIdsFromCookie,
  filterValidSources,
  compactCustomSources,
} from "@/lib/custom-sources-cookie";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { FeedSource } from "@/lib/sources";

const SYNCED_FLAG_KEY = "focus_feed_sources_synced_v1";
const BACKUP_KEY = "focus_feed_sources_backup_v1";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * 앱 진입 시 커스텀 소스를 복원·동기화한다.
 * 1. 쿠키가 비었는데 localStorage 백업이 있으면 복원 (ITP·쿠키 유실 자가 치유)
 * 2. 로그인 상태면 /api/custom-sources/sync 로 DB 단일 진실 동기화:
 *    - 소유자 마커(SYNC_OWNER_COOKIE_NAME) == 나: 쿠키는 미러 — push 없이 DB로 교체
 *    - 마커 없음: 비로그인 시절 데이터 — 1회 push 후 미러 전환 (서버가 멱등 처리)
 *    - 마커 != 나: 이전 계정 잔재 — push 금지, 내 DB 미러로 교체 (계정 오염 방지)
 *    예전 union 동기화는 낡은 쿠키가 삭제된 채널을 DB로 되밀어 부활시켰다(결함 B).
 * 3. 동기화 결과를 localStorage에 백업하고, SSR 시점과 목록이 달라졌으면 새로고침
 *
 * 세션당 1회 가드(SYNCED_FLAG_KEY)는 **동기화가 실제로 성공한 경우에만** 기록한다.
 * UI는 렌더링하지 않는다.
 */
export default function CustomSourcesSync() {
  const router = useRouter();
  const runningRef = useRef(false);

  useEffect(() => {
    const runSync = async (force = false) => {
      if (runningRef.current) return;
      if (!force) {
        try {
          if (sessionStorage.getItem(SYNCED_FLAG_KEY)) return;
        } catch {
          // sessionStorage 접근 불가 시에도 동기화 자체는 진행
        }
      }
      runningRef.current = true;
      try {
        const rawSourcesCookie = getCookie(CUSTOM_SOURCES_COOKIE_NAME);
        let baseSources = getCustomSourcesFromCookie(rawSourcesCookie);
        let restoredFromBackup = false;
        // 백업 복원은 쿠키가 "아예 없을 때"만 — 값이 빈 배열("[]")인 건 사용자가
        // 마지막 채널까지 의도적으로 삭제한 상태라, 복원하면 삭제가 되돌아간다.
        if (rawSourcesCookie === undefined && baseSources.length === 0) {
          try {
            const backupRaw = localStorage.getItem(BACKUP_KEY);
            if (backupRaw) {
              const backup = filterValidSources(JSON.parse(backupRaw));
              if (backup.length > 0) {
                baseSources = backup;
                restoredFromBackup = true;
              }
            }
          } catch {
            // 백업 파싱 실패는 무시
          }
        }
        const hiddenFromCookie = getHiddenSourceIdsFromCookie(
          getCookie(HIDDEN_SOURCES_COOKIE_NAME),
        );

        // 비로그인은 GET/sync가 예상된 401을 내며 콘솔에 리소스 오류를 남기므로,
        // 로컬 세션을 먼저 확인하고 로그인 시에만 DB 동기화한다.
        let userId: string | null = null;
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            userId = session?.user?.id ?? null;
          } catch {
            // 세션 확인 실패 시 비로그인으로 간주
          }
        }

        if (!userId) {
          // 비로그인: 백업 복원분만 서버 Set-Cookie로 굽고 화면 갱신
          if (restoredFromBackup && baseSources.length > 0) {
            try {
              await fetch("/api/custom-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(baseSources),
              });
            } catch {
              // 실패해도 다음 진입 시 재시도됨
            }
            router.refresh();
          }
          try {
            // 빈 목록도 그대로 백업 — 낡은 백업이 "전부 삭제"를 되돌리지 않도록
            localStorage.setItem(BACKUP_KEY, JSON.stringify(compactCustomSources(baseSources)));
          } catch {
            // ignore
          }
          return;
        }

        const owner = getCookie(SYNC_OWNER_COOKIE_NAME);
        const isPreLoginData = !owner;
        const res = await fetch("/api/custom-sources/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isPreLoginData ? { localSources: baseSources, localHidden: hiddenFromCookie } : {},
          ),
        });
        if (!res.ok) return; // 플래그를 남기지 않아 다음 진입 때 재시도
        const data = (await res.json()) as { sources: FeedSource[]; hiddenIds: string[] };

        try {
          sessionStorage.setItem(SYNCED_FLAG_KEY, "1");
        } catch {
          // ignore
        }
        try {
          // 빈 목록도 그대로 백업 — 낡은 백업이 "전부 삭제"를 되돌리지 않도록
          localStorage.setItem(BACKUP_KEY, JSON.stringify(compactCustomSources(data.sources)));
        } catch {
          // ignore
        }

        // SSR이 그린 목록(쿠키 기준)과 동기화 결과가 다르면 화면 갱신
        const before = JSON.stringify(
          [...baseSources.map((s) => s.id), ...hiddenFromCookie].sort(),
        );
        const after = JSON.stringify(
          [...data.sources.map((s) => s.id), ...data.hiddenIds].sort(),
        );
        if (before !== after || restoredFromBackup) {
          router.refresh();
        }
      } finally {
        runningRef.current = false;
      }
    };

    void runSync();

    // 같은 탭에서 로그인(OAuth 리다이렉트 복귀 포함)하면 비로그인 때 미뤘던 DB 동기화를 즉시 수행.
    const supabase = getSupabaseBrowserClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        try {
          sessionStorage.removeItem(SYNCED_FLAG_KEY);
        } catch {
          // ignore
        }
        void runSync(true);
      }
      if (event === "SIGNED_OUT") {
        // 계정 전환 오염 방지: 이 흔적이 남으면 같은 브라우저에서 다음에 로그인한
        // 다른 계정의 동기화가 이전 계정의 채널을 자기 DB로 push해 버린다.
        document.cookie = `${CUSTOM_SOURCES_COOKIE_NAME}=; path=/; max-age=0`;
        document.cookie = `${HIDDEN_SOURCES_COOKIE_NAME}=; path=/; max-age=0`;
        document.cookie = `${SYNC_OWNER_COOKIE_NAME}=; path=/; max-age=0`;
        try {
          localStorage.removeItem(BACKUP_KEY);
        } catch {
          // ignore
        }
        try {
          sessionStorage.removeItem(SYNCED_FLAG_KEY);
        } catch {
          // ignore
        }
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [router]);

  return null;
}
