import { SESSION_ACTIVITY_COOKIE } from "./auth-cookies.ts";

export { SESSION_ACTIVITY_COOKIE };

export const SESSION_ACTIVITY_STORAGE_KEY = "izometri:last-activity";
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ACTIVITY_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function parseSessionActivity(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function isSessionIdle(
  lastActivity: number | null,
  now = Date.now(),
): boolean {
  return lastActivity !== null && now - lastActivity >= SESSION_IDLE_TIMEOUT_MS;
}

export function readSessionActivity(): number | null {
  if (typeof window === "undefined") return null;

  let stored: number | null = null;
  try {
    stored = parseSessionActivity(
      window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY),
    );
  } catch {
    // Gizlilik ayarlari localStorage'i kapatirsa yerel cereze geri dusulur.
  }
  if (stored !== null) return stored;

  const cookieValue = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${SESSION_ACTIVITY_COOKIE}=`))
    ?.split("=")[1];
  return parseSessionActivity(cookieValue);
}

export function markSessionActivity(timestamp = Date.now()): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(timestamp));
  } catch {
    // Yerel cerez ayni zaman bilgisini tasimaya devam eder.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_ACTIVITY_COOKIE}=${timestamp}; Path=/; Max-Age=${SESSION_ACTIVITY_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearSessionActivity(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
  } catch {
    // Yerel cerez yine temizlenir.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_ACTIVITY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
