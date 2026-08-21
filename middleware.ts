import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { ROLE_CACHE_COOKIE } from "@/lib/auth-cookies";
import { DEV_ROLE_COOKIE, isDevRoleSwitchEnabled } from "@/lib/dev-mode";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { dashboardPathFor, roleForPath } from "@/lib/roles";
import { isRoleStatus, isUserRole } from "@/lib/types";
import type { Database, RoleStatus, UserRole } from "@/lib/types";

/** Rolunu henuz secmemis kullanicinin gonderildigi ekran. */
const ONBOARDING_PATH = "/hosgeldiniz";
/** Onay bekleyen veya reddedilen kullanicinin gonderildigi ekran. */
const PENDING_PATH = "/onay-bekleniyor";

/**
 * Rolun onbelleklendigi cerez.
 *
 * Rol her istekte veritabanindan okunursa her sayfa gecisi fazladan bir ag
 * gidis-donusu maliyeti tasir. Rol nadiren degistigi icin kisa omurlu bir
 * cerezde tutulur; sure dolunca yeniden sorgulanir. Bu cerez YETKI KAYNAGI
 * DEGILDIR - veri erisimini her zaman veritabanindaki RLS politikalari belirler,
 * cerez yalnizca hangi panele yonlendirilecegini soyler.
 */
const ROLE_CACHE_MAX_AGE = 300; // 5 dakika

/**
 * Middleware uc is yapar:
 *  1. Supabase oturum cerezini tazeler (aksi halde token suresi dolar).
 *  2. /dashboard altini korur ve kullaniciyi kendi rolunun paneline yonlendirir.
 *  3. Her istege `x-pathname` basligini ekler; dashboard layout'u aktif yolu
 *     buradan okur (Server Component'lerde `usePathname` yoktur).
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
  const isLogin = pathname === "/login";
  const isOnboarding = pathname === ONBOARDING_PATH;
  const isPending = pathname === PENDING_PATH;

  if (!user) {
    if (isDashboard || isOnboarding || isPending) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  /**
   * E-postasi dogrulanmamis kullanici panele giremez.
   *
   * Supabase zaten "Confirm email" acikken dogrulanmamis kullaniciya oturum
   * vermez; bu kontrol ikinci bir savunma katmani. Proje ayari sonradan
   * gevsetilse bile uygulama dogrulanmamis hesabi iceri almaz.
   */
  if (!user.email_confirmed_at && isDashboard) {
    return NextResponse.redirect(new URL("/auth/dogrulama-bekleniyor", request.url));
  }

  // Rol yalnizca yonlendirme kararinin gerektigi yerlerde lazim.
  // Tanitim sayfasi, /auth/* gibi yollarda sorgulamaya gerek yok.
  if (!isDashboard && !isLogin && !isOnboarding && !isPending) return response;

  const { role: actualRole, status } = await resolveProfile(
    request,
    response,
    supabase,
    user.id,
  );

  /**
   * Rol onay akisi.
   *
   * Rolunu secmemis kullanici once "kim oldugunu" soyler; ogrenci disi bir
   * rol talep ettiyse egitim yoneticisi karar verene kadar bekleme ekraninda
   * kalir. Onaya kadar etkin rolu 'ogrenci' oldugu icin yetkili alanlara
   * zaten giremez - bu yonlendirme yalnizca ekrani netlestirir.
   */
  if (status === "secilmedi") {
    return isOnboarding
      ? response
      : NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
  }

  if (status === "beklemede") {
    return isPending
      ? response
      : NextResponse.redirect(new URL(PENDING_PATH, request.url));
  }

  // Reddedilen kullanici baska bir rol talep edebilsin diye secim ekranina
  // da girebilir; aksi halde hesabi kalici olarak kilitlenirdi.
  if (status === "reddedildi") {
    return isPending || isOnboarding
      ? response
      : NextResponse.redirect(new URL(PENDING_PATH, request.url));
  }

  // Onayli kullanicinin bu iki ekranda isi yok.
  if (isOnboarding || isPending) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Gelistirici rol degistiricisi: yalnizca yonlendirme kurallarini etkiler.
  const devRole = request.cookies.get(DEV_ROLE_COOKIE)?.value;
  const role = isDevRoleSwitchEnabled && isUserRole(devRole) ? devRole : actualRole;

  // Oturum acikken /login'e gidilirse kendi paneline gonder.
  if (isLogin) {
    return NextResponse.redirect(new URL(dashboardPathFor(role), request.url));
  }

  const requiredRole = roleForPath(pathname);

  // /dashboard kok yolu -> role gore dagit
  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(dashboardPathFor(role), request.url));
  }

  // Baska bir rolun alanina girilmisse kendi paneline geri gonder.
  if (requiredRole && requiredRole !== role) {
    return NextResponse.redirect(new URL(dashboardPathFor(role), request.url));
  }

  return response;
}

/**
 * Rolu ve rol onay durumunu cozer; mumkunse cerez onbelleginden okur.
 *
 * Onbellek degeri "<userId>:<rol>" bicimindedir. Kullanici kimligini de
 * anahtara katmak sart: ayni tarayicida baska bir hesaba gecildiginde eski
 * rolun yapisip yanlis panele yonlendirmesini onler.
 *
 * Onbellek YALNIZCA onayli kullanicilar icin yazilir. Onay bekleyen biri
 * onbellege alinsaydi, yonetici onayladiktan sonra 5 dakika boyunca bekleme
 * ekraninda kalirdi. Onaylilar hizli yolda, bekleyenler her istekte taze.
 */
async function resolveProfile(
  request: NextRequest,
  response: NextResponse,
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
): Promise<{ role: UserRole; status: RoleStatus }> {
  const cached = request.cookies.get(ROLE_CACHE_COOKIE)?.value;

  if (cached) {
    const separator = cached.indexOf(":");
    const cachedUserId = cached.slice(0, separator);
    const cachedRole = cached.slice(separator + 1);

    if (cachedUserId === userId && isUserRole(cachedRole)) {
      return { role: cachedRole, status: "onayli" };
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, role_status")
    .eq("id", userId)
    .maybeSingle();

  const role = isUserRole(profile?.role) ? profile.role : "ogrenci";
  const status = isRoleStatus(profile?.role_status) ? profile.role_status : "onayli";

  if (status === "onayli") {
    response.cookies.set(ROLE_CACHE_COOKIE, `${userId}:${role}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ROLE_CACHE_MAX_AGE,
    });
  }

  return { role, status };
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve resim optimizasyonu disindaki tum yollar.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
