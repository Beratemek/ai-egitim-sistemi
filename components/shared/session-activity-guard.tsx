"use client";

import * as React from "react";

import { isSupabaseConfigured } from "@/lib/env";
import {
  SESSION_ACTIVITY_STORAGE_KEY,
  clearSessionActivity,
  isSessionIdle,
  markSessionActivity,
  readSessionActivity,
} from "@/lib/session-activity";
import { createClient } from "@/lib/supabase";

const ACTIVITY_WRITE_INTERVAL_MS = 15_000;
const IDLE_CHECK_INTERVAL_MS = 10_000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "scroll",
  "touchstart",
] as const;

export function SessionActivityGuard() {
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;

    let disposed = false;
    let signingOut = false;
    let lastWrite = 0;
    let intervalId: number | undefined;

    const endIdleSession = () => {
      if (signingOut) return;
      signingOut = true;
      clearSessionActivity();
      const params = new URLSearchParams({
        message: "30 dakika işlem yapılmadığı için oturumunuz kapatıldı.",
      });
      window.location.replace(`/auth/signout-and-login?${params.toString()}`);
    };

    const checkIdle = () => {
      if (isSessionIdle(readSessionActivity())) {
        endIdleSession();
        return true;
      }
      return false;
    };

    const recordActivity = () => {
      if (signingOut || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_INTERVAL_MS) return;
      if (checkIdle()) return;
      markSessionActivity(now);
      lastWrite = now;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !checkIdle()) {
        recordActivity();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === SESSION_ACTIVITY_STORAGE_KEY &&
        event.newValue === null
      ) {
        endIdleSession();
      }
    };

    const initialize = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;

      if (!session) {
        clearSessionActivity();
        return;
      }

      if (checkIdle()) return;
      markSessionActivity();
      lastWrite = Date.now();

      for (const eventName of ACTIVITY_EVENTS) {
        window.addEventListener(eventName, recordActivity, { passive: true });
      }
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("storage", handleStorage);
      intervalId = window.setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);
    };

    void initialize();

    return () => {
      disposed = true;
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, recordActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
