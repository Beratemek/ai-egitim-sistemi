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

import {
  createBrowserClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AUTH_PERSISTENCE_COOKIE,
  authCookieOptions,
  authPersistenceFromCookie,
} from "@/lib/auth-cookies";
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
  browserClient = createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(document.cookie);
      },
      setAll(cookiesToSet) {
        const currentCookies = parseCookieHeader(document.cookie);
        const persistence = authPersistenceFromCookie(
          currentCookies.find(({ name }) => name === AUTH_PERSISTENCE_COOKIE)?.value,
        );

        for (const { name, value, options } of cookiesToSet) {
          document.cookie = serializeCookieHeader(
            name,
            value,
            authCookieOptions(options, value, persistence),
          );
        }
      },
    },
  });
  return browserClient;
}

/** Kisayol: `supabase()` cagrisi `createClient()` ile aynidir. */
export const supabase = createClient;

export default createClient;
