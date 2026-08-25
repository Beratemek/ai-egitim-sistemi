/**
 * Supabase istemcileri (sunucu tarafi).
 *
 * - `createServerSupabaseClient()`  -> Server Component / Route Handler,
 *                                     oturum cerezlerini okur-yazar.
 * - `createAdminSupabaseClient()`   -> service_role anahtariyla RLS'i bypass eder.
 *                                     SADECE guvenli sunucu kodunda kullanin.
 * - `getCurrentUser()`              -> auth kullanicisi + profil (rol) dondurur.
 *
 * Bu modulu bir Client Component'ten import etmeyin.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { requireSupabaseEnv, serverEnv } from "@/lib/env";
import type { Database, UserProfile, UserRole } from "@/lib/types";

export type TypedServerClient = SupabaseClient<Database>;

export interface ServerSupabaseClientOptions {
  /**
   * Uzun sure acik kalan gelistirme sunucusunda Cloudflare/Supabase tarafindan
   * kapatilmis bir keep-alive soketi yeniden kullanilirsa Node `fetch failed`
   * uretebilir. Yalnizca tekrar edilmesi guvenli auth isteklerinde yeni baglanti
   * ve tek tekrar denemesi kullanilir.
   */
  resilientAuthFetch?: boolean;
}

async function resilientAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const headers = new Headers(init?.headers);
      headers.set("connection", "close");

      return await fetch(input, {
        ...init,
        headers,
        cache: "no-store",
      });
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }

  throw lastError;
}

/**
 * Oturum cerezlerine bagli Supabase istemcisi.
 * Next.js 15'te `cookies()` asenkron oldugu icin bu fonksiyon da asenkrondur.
 */
export async function createServerSupabaseClient(
  options: ServerSupabaseClientOptions = {},
): Promise<TypedServerClient> {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    global: options.resilientAuthFetch
      ? { fetch: resilientAuthFetch }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component icinden cerez yazilamaz. Oturum yenilemesi
          // middleware tarafindan yapildigi icin bu durum guvenle yutulabilir.
        }
      },
    },
  });
}

/**
 * service_role anahtariyla olusturulmus, RLS'i bypass eden istemci.
 * Kullanicidan gelen girdiyle dogrudan filtrelemeyin - yetkiyi once kendiniz
 * dogrulayin (ornegin `requireRole` ile).
 */
export function createAdminSupabaseClient(): TypedServerClient {
  const { url } = requireSupabaseEnv();

  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error(
      '[supabase] "SUPABASE_SERVICE_ROLE_KEY" tanimli degil; admin istemcisi olusturulamaz.',
    );
  }

  return createSupabaseJsClient<Database>(url, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AuthenticatedUser {
  user: User;
  /** Arayuzun kullandigi profil. Rol taklidi aktifse `role` degistirilmis olur. */
  profile: UserProfile;
  /** Veritabanindaki gercek rol. */
  /** Veritabanindaki gercek etkin rol. */
  actualRole: UserRole;
}

/**
 * Oturum acmis kullanicinin auth kaydini ve `public.users` profilini dondurur.
 * Oturum yoksa `null` doner.
 *
 * `cache()` ile sarmalidir: ayni istek icinde layout ve sayfa birlikte cagirsa
 * bile Supabase'e yalnizca BIR kez gidilir. Onbellek istek bittiginde silinir,
 * yani kullanicilar arasinda sizinti olmaz.
 *
 * Gelistirme modunda `dev_role` cerezi varsa profilin rolu o degerle degistirilir
 * (bkz. lib/dev-mode.ts). Bu yalnizca ARAYUZU etkiler - veritabanindaki RLS
 * politikalari her zaman gercek kullaniciya gore calisir.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const client = await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await client
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  /**
   * Rol TAKLIDI kaldirildi.
   *
   * Onceden bir gelistirici cerezi `profile.role`u degistirebiliyordu; bu,
   * kullaniciya ATANMAMIS bir rolun paneline girmenin yoluydu. Yetkinin tek
   * kaynagi verilmis roller kumesi olmali - baska bir panel gerekiyorsa
   * cozum o rolu atamaktir. `actualRole` alani cagrilar icin korunuyor.
   */
  return { user, profile, actualRole: profile.role };
});

/** Kullanicinin rolunu dondurur; oturum yoksa `null`. */
export async function getCurrentRole(): Promise<UserRole | null> {
  const current = await getCurrentUser();
  return current?.profile.role ?? null;
}
