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

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { requireSupabaseEnv, serverEnv } from "@/lib/env";
import type { Database, UserProfile, UserRole } from "@/lib/types";

export type TypedServerClient = SupabaseClient<Database>;

/**
 * Oturum cerezlerine bagli Supabase istemcisi.
 * Next.js 15'te `cookies()` asenkron oldugu icin bu fonksiyon da asenkrondur.
 */
export async function createServerSupabaseClient(): Promise<TypedServerClient> {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
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
  profile: UserProfile;
}

/**
 * Oturum acmis kullanicinin auth kaydini ve `public.users` profilini dondurur.
 * Oturum yoksa `null` doner.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
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

  return { user, profile };
}

/** Kullanicinin rolunu dondurur; oturum yoksa `null`. */
export async function getCurrentRole(): Promise<UserRole | null> {
  const current = await getCurrentUser();
  return current?.profile.role ?? null;
}
