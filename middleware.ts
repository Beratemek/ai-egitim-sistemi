import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

import {
  ROLE_CACHE_COOKIE,
} from "@/lib/auth-cookies";
import { DEV_ROLE_COOKIE, isDevRoleSwitchEnabled } from "@/lib/dev-mode";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { dashboardPathFor, landingRole, roleForPath } from "@/lib/roles";
import {
  SESSION_ACTIVITY_COOKIE,
  isSessionIdle,
  parseSessionActivity,
} from "@/lib/session-activity";
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
 *
 * Sure secimi bir denge: cerez dolunca middleware veritabanina gidiyor ve bu
 * tur uzak Supabase ornegimizde yaklasik 150 ms - her sayfa gecisinde
 * hissedilir. Kisa tutmanin tek kazanci, yonetici bir rolu geri aldiginda o
 * panelin KABUGUNUN daha cabuk kapanmasi; icerik zaten bos gelir cunku
 * sorgular RLS'e tabidir. Gorunur gecikmeye deger bir kazanc degil.
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

  const isDashboard = pathname.startsWith("/dashboard");
  const isExam = pathname.startsWith("/sinav/");
  const isLogin = pathname === "/login";
  const isOnboarding = pathname === ONBOARDING_PATH;
  const isPending = pathname === PENDING_PATH;

  const lastActivity = parseSessionActivity(
    request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value,
  );
  if ((isDashboard || isExam) && isSessionIdle(lastActivity)) {
    const signoutUrl = new URL("/auth/signout-and-login", request.url);
    signoutUrl.searchParams.set(
      "message",
      "30 dakika işlem yapılmadığı için oturumunuz kapatıldı.",
    );
    return NextResponse.redirect(signoutUrl);
  }

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
  const { user, unverified } = await getUserResilient(supabase, request);

  /**
   * Dogrulanamadi != oturum yok.
   *
   * `getUser()` Supabase'e giden bir AG CAGRISI. Yayinda bu cagri zaman zaman
   * basarisiz oluyor (uzak bolge, soguk baslangic, gecici 5xx) ve supabase-js
   * o durumda da `user: null` donuyor. Sonucu asagida "oturum yok" sayip
   * /login'e atinca, giris yapmis kullanici once "giris yapilmamis" ekranina
   * dusuyor, ikinci denemede iceri giriyordu - canlida gorulen tam olarak
   * buydu.
   *
   * Artik gecici hata ile gercek oturumsuzluk ayriliyor: elde oturum cerezi
   * varken cagri agdan dolayi basarisiz olduysa istek gecirilir. Bu bir
   * guvenlik acigi degil - middleware yalnizca YONLENDIRME yapar; asil koruma
   * dashboard layout'undaki kontrol ve veritabanindaki RLS politikalaridir.
   * Oturum gercekten gecersizse sayfa yine /login'e dusurur.
   */
  if (unverified) return response;

  /**
   * Sinav cozme ekrani panel kabugunun disinda ama korumasi AYNI olmali:
   * oturum, e-posta dogrulamasi ve rol onayi burada da aranir. Ayri bir
   * kok yol acip korumayi unutmak, sinava herkesin girebilmesi demekti.
   */
  if (!user) {
    if (isDashboard || isExam || isOnboarding || isPending) {
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
  if (!user.email_confirmed_at && (isDashboard || isExam)) {
    return NextResponse.redirect(new URL("/auth/dogrulama-bekleniyor", request.url));
  }

  // Rol yalnizca yonlendirme kararinin gerektigi yerlerde lazim.
  // Tanitim sayfasi, /auth/* gibi yollarda sorgulamaya gerek yok.
  if (!isDashboard && !isExam && !isLogin && !isOnboarding && !isPending) return response;

  const { role: actualRole, roles, status } = await resolveProfile(
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

  /**
   * Gelistirici rol degistiricisi: yalnizca yonlendirme kurallarini etkiler.
   *
   * Taklit edilebilecek roller kullaniciya VERILMIS rollerle sinirli. Aksi
   * halde bu cerez, rol atamasi olmadan baska bir panele girmenin yolu
   * olurdu - yetkinin tek kaynagi verilmis roller kumesi olmali.
   */
  const devRole = request.cookies.get(DEV_ROLE_COOKIE)?.value;
  const role =
    isDevRoleSwitchEnabled && isUserRole(devRole) && roles.includes(devRole)
      ? devRole
      : actualRole;

  /**
   * Yonlendirmelerin gittigi panel.
   *
   * Admin rolu verilmis hesap her zaman Sistem Yoneticisi panelinde acilir;
   * ust cubukta rol degistirici de o hesapta gosterilmedigi icin ikisi ayni
   * kurali (lib/roles.ts) okumak zorunda - yoksa hesap baska bir panelde
   * acilip cikis yolu olmadan orada kalirdi.
   */
  const acilisRolu = landingRole(roles, role);

  // Oturum acikken /login'e gidilirse kendi paneline gonder.
  if (isLogin) {
    return NextResponse.redirect(new URL(dashboardPathFor(acilisRolu), request.url));
  }

  const requiredRole = roleForPath(pathname);

  // /dashboard kok yolu -> role gore dagit
  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(dashboardPathFor(acilisRolu), request.url));
  }

  /**
   * Erisim yalnizca VERILMIS rollerden gelir.
   *
   * `admin` icin gizli bir "her seye erisim" kapisi YOKTUR: sistem yoneticisi
   * de tipki digerleri gibi yalnizca kendisine atanmis rollerin panellerine
   * girer. Bir yoneticinin her panele girmesi isteniyorsa cozum ona o rolleri
   * ATAMAKTIR - coklu rol tam olarak bunun icin var.
   *
   * Verilmis rollerden herhangi birinin alani acilabilir; ust cubuktaki rol
   * degistirici yalnizca varsayilan paneli secer, bir kapi degildir.
   */
  if (requiredRole && !roles.includes(requiredRole)) {
    return NextResponse.redirect(new URL(dashboardPathFor(acilisRolu), request.url));
  }

  return response;
}

/**
 * Oturum sahibini dogrular; gecici ag hatasini oturumsuzluktan AYIRIR.
 *
 * `unverified: true` -> "elde oturum cerezi var ama dogrulayamadim".
 * Cagiran taraf bu durumda yonlendirme yapmaz.
 *
 * Bir kez yeniden deniyoruz: yayinda gorulen hatalarin cogu tek seferlik
 * (soguk baslangic, gecici 5xx). Ikinci deneme genelde tutuyor ve kullanici
 * hicbir sey fark etmiyor.
 */
async function getUserResilient(
  supabase: ReturnType<typeof createServerClient<Database>>,
  request: NextRequest,
): Promise<{ user: User | null; unverified: boolean }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.auth.getUser();

    if (data.user) return { user: data.user, unverified: false };
    if (!error) return { user: null, unverified: false };

    // Gecersiz/suresi dolmus token gercek bir "oturum yok" cevabidir;
    // yalnizca AG kaynakli hatalarda tekrar deniyoruz.
    if (!isRetryableAuthError(error)) return { user: null, unverified: false };
  }

  return { user: null, unverified: hasAuthCookie(request) };
}

/** Ag/sunucu kaynakli, tekrar denemeye deger hata mi? */
function isRetryableAuthError(error: { name?: string; status?: number }): boolean {
  if (error.name === "AuthRetryableFetchError") return true;
  // status 0 ya da tanimsiz: istek hic ulasmadi. 5xx: sunucu tarafi.
  return !error.status || error.status >= 500;
}

/**
 * Tarayicida Supabase oturum cerezi var mi?
 *
 * Cerezin VARLIGI oturumun gecerli oldugunu kanitlamaz - yalnizca "bu kisi
 * giris yapmis gorunuyor" der. Gecici hatada yonlendirmeyi bastirmak icin bu
 * kadari yeterli; gecerlilik karari sayfa katmaninda veriliyor.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => /^sb-.*-auth-token/.test(cookie.name));
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
): Promise<{ role: UserRole; roles: UserRole[]; status: RoleStatus }> {
  const cached = request.cookies.get(ROLE_CACHE_COOKIE)?.value;

  if (cached) {
    // Bicim: "<userId>:<etkinRol>:<rol1,rol2,...>"
    const [cachedUserId, cachedRole, cachedRoles] = cached.split(":");

    if (cachedUserId === userId && isUserRole(cachedRole) && cachedRoles) {
      const roles = cachedRoles.split(",").filter(isUserRole);
      // Bos kume eski bicimli cerezi isaret eder; o zaman yeniden sorgula.
      if (roles.length > 0) return { role: cachedRole, roles, status: "onayli" };
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, roles, role_status")
    .eq("id", userId)
    .maybeSingle();

  const role = isUserRole(profile?.role) ? profile.role : "ogrenci";
  const status = isRoleStatus(profile?.role_status) ? profile.role_status : "onayli";

  // `roles` kolonu eklenmeden once olusmus kayitlarda kume bos olabilir;
  // o durumda etkin rol tek eleman olarak kabul edilir.
  const granted = (profile?.roles ?? []).filter(isUserRole);
  const roles = granted.length > 0 ? granted : [role];

  if (status === "onayli") {
    response.cookies.set(
      ROLE_CACHE_COOKIE,
      `${userId}:${role}:${roles.join(",")}`,
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ROLE_CACHE_MAX_AGE,
      },
    );
  }

  return { role, roles, status };
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar, resim optimizasyonu ve API uclari DISINDAKI tum yollar.
     *
     * `/api` neden disarida: her API ucu zaten `requireRole()` ile kendi
     * yetkisini dogruluyor ve o da `getUser()` cagiriyor. Middleware'in ayni
     * cagriyi bir kez daha yapmasi her istege fazladan bir ag gidis-donusu
     * ekliyordu - soru uretimi gibi zaten yavas uclarda bosa gecen sure.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
