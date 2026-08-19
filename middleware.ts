import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { dashboardPathFor, roleForPath } from "@/lib/roles";
import { isUserRole } from "@/lib/types";
import type { Database } from "@/lib/types";

/**
 * Middleware iki is yapar:
 *  1. Supabase oturum cerezini tazeler (aksi halde token suresi dolar).
 *  2. /dashboard altini korur ve kullaniciyi kendi rolunun paneline yonlendirir.
 *
 * Ayrica her istege `x-pathname` basligini ekler; dashboard layout'u aktif
 * yolu buradan okur (Server Component'lerde `usePathname` yoktur).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Supabase yapilandirilmamissa demo modunda calisilir: koruma uygulanmaz.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // ONEMLI: getUser() cagrisi token'i dogrular ve tazeler. Kaldirmayin.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = pathname.startsWith("/dashboard");

  if (!user) {
    if (isDashboard) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Oturum acikken /login'e gidilirse kendi paneline gonder.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = isUserRole(profile?.role) ? profile.role : "ogrenci";

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(dashboardPathFor(role), request.url));
  }

  if (isDashboard) {
    const requiredRole = roleForPath(pathname);

    // /dashboard kok yolu -> role gore dagit
    if (pathname === "/dashboard") {
      return NextResponse.redirect(new URL(dashboardPathFor(role), request.url));
    }

    // Baska bir rolun alanina girilmisse kendi paneline geri gonder.
    if (requiredRole && requiredRole !== role) {
      return NextResponse.redirect(new URL(dashboardPathFor(role), request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve resim optimizasyonu disindaki tum yollar.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
