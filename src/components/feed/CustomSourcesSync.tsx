"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  getCustomSourcesFromCookie,
  filterValidSources,
  compactCustomSources,
  syncCustomSourcesWithDb,
} from "@/lib/custom-sources-cookie";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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
 * 2. 로그인 상태면 쿠키↔DB를 양방향 병합 (쿠키→DB push, DB→쿠키 pull)
 * 3. 최종 목록을 localStorage에 백업하고, 변경 시 서버 PUT으로 쿠키를 다시 굽고 새로고침
 *
 * 세션당 1회 가드(SYNCED_FLAG_KEY)는 **DB 동기화를 실제로 수행(로그인)한 경우에만** 기록한다.
 * 비로그인·세션판독 실패로 DB 동기화를 건너뛴 경우 플래그를 남기지 않아야, 같은 탭에서
 * 로그인하거나 다음 진입 때 다시 시도된다. 같은 탭 로그인은 onAuthStateChange로 즉시 재동기화.
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
        let baseSources = getCustomSourcesFromCookie(getCookie(CUSTOM_SOURCES_COOKIE_NAME));
        let restoredFromBackup = false;
        if (baseSources.length === 0) {
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

        // 비로그인은 GET /api/custom-sources가 예상된 401을 내며 콘솔에 리소스 오류를 남기므로,
        // 로컬 세션을 먼저 확인하고 로그인 시에만 DB 동기화한다.
        let isLoggedIn = false;
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            isLoggedIn = !!session;
          } catch {
            // 세션 확인 실패 시 비로그인으로 간주
          }
        }

        const { merged, changed } = isLoggedIn
          ? await syncCustomSourcesWithDb(baseSources)
          : { merged: baseSources, changed: false };

        try {
          if (merged.length > 0) {
            localStorage.setItem(BACKUP_KEY, JSON.stringify(compactCustomSources(merged)));
          }
        } catch {
          // ignore
        }

        // DB 동기화를 실제로 수행했을 때만 세션 플래그 기록 — 비로그인/실패는 재시도 여지를 남긴다.
        if (isLoggedIn) {
          try {
            sessionStorage.setItem(SYNCED_FLAG_KEY, "1");
          } catch {
            // ignore
          }
        }

        if (changed || restoredFromBackup) {
          // 쿠키는 서버 Set-Cookie로 굽는다 (JS 쿠키는 iOS Safari에서 7일 만료)
          try {
            await fetch("/api/custom-sources", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(merged),
            });
          } catch {
            // 실패해도 다음 진입 시 재시도됨
          }
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
