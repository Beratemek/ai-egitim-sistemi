/**
 * API Route yardimcilari: tekbicim JSON yanitlari ve rol kontrolu.
 */

import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser, type AuthenticatedUser } from "@/lib/supabase-server";
import type { ApiResponse, UserRole } from "@/lib/types";

export function jsonOk<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}

export function jsonError(message: string, status = 400): NextResponse<ApiResponse<never>> {
  return NextResponse.json<ApiResponse<never>>({ ok: false, error: message }, { status });
}

/** Bilinmeyen bir hatadan kullaniciya gosterilebilir mesaj cikarir. */
export function errorMessage(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return "Beklenmeyen bir hata olustu.";
}

export type GuardResult =
  | { ok: true; user: AuthenticatedUser | null }
  | { ok: false; response: NextResponse<ApiResponse<never>> };

/**
 * Istegi yapan kullanicinin izin verilen rollerden birine sahip oldugunu dogrular.
 *
 * Supabase yapilandirilmamissa (demo modu) kontrol atlanir ve `user: null` doner;
 * boylece arayuz anahtarsiz da denenebilir.
 */
export async function requireRole(allowed: readonly UserRole[]): Promise<GuardResult> {
  if (!isSupabaseConfigured) {
    return { ok: true, user: null };
  }

  const current = await getCurrentUser();

  if (!current) {
    return { ok: false, response: jsonError("Oturum acmaniz gerekiyor.", 401) };
  }

  if (!allowed.includes(current.profile.role)) {
    return {
      ok: false,
      response: jsonError("Bu islem icin yetkiniz yok.", 403),
    };
  }

  return { ok: true, user: current };
}

/** Govdeyi JSON olarak okur; gecersizse hata firlatir. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Istek govdesi gecerli bir JSON degil.");
  }
}
