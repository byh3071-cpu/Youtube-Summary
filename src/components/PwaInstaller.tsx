"use client";

import { useEffect } from "react";

export default function PwaInstaller() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 로컬 개발 환경에서도 등록 (localhost / 로컬 IP)
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (e) {
        console.error("[PWA] service worker register failed", e);
      }
    };

    register();
  }, []);

  return null;
}

