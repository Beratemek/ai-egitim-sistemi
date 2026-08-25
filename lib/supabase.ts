/**
 * Supabase istemcisi (tarayici / Client Component tarafi).
 *
 * URL ve anon key `.env.local` icindeki
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 * degiskenlerinden okunur.
 *
 * Sunucu tarafi (Server Component / Route Handler / Middleware) icin
 * `lib/supabase-server.ts` kullanin - orada oturum cerezleri yonetilir.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/types";

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | null = null;

/**
 * Tarayici icin tekil (singleton) Supabase istemcisi dondurur.
 * Her render'da yeni istemci olusturmak oturum dinleyicilerini cogaltir,
 * bu yuzden ornek onbellege alinir.
 */
export function createClient(): TypedSupabaseClient {
  if (browserClient) return browserClient;

  const { url, anonKey } = requireSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}

/** Kisayol: `supabase()` cagrisi `createClient()` ile aynidir. */
export const supabase = createClient;

export default createClient;
