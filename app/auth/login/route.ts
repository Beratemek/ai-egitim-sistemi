import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { ROLE_CACHE_COOKIE } from "@/lib/auth-cookies";
import { publicEnv } from "@/lib/env";
import { dashboardPathFor } from "@/lib/roles";
import { isRoleStatus, isUserRole } from "@/lib/types";
import type { Database, UserRole } from "@/lib/types";

export const runtime = "nodejs";

interface LoginPayload {
  email?: unknown;
  password?: unknown;
}

/**
 * Parola girisini sunucuda tamamlar.
 *
 * Boylece Supabase oturum cerezleri yonlendirmeden once yanita kesin olarak
 * eklenir. Tarayicida oturum acip hemen client-side yonlendirme yapmak,
 * middleware'in yeni oturumu henuz gormedigi durumlarda /login dongusune
 * neden olabiliyordu.
 */
export async function POST(request: NextRequest) {
  const acceptsJson =
    request.headers.get("content-type")?.includes("application/json") ?? false;
  let payload: LoginPayload;

  try {
    if (acceptsJson) {
      payload = (await request.json()) as LoginPayload;
    } else {
      const formData = await request.formData();
      payload = {
        email: formData.get("email"),
        password: formData.get("password"),
      };
    }
  } catch {
    return loginError(request, acceptsJson, "Geçersiz giriş isteği.", 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!email || !password) {
    return loginError(
      request,
      acceptsJson,
      "E-posta ve parola zorunludur.",
      400,
    );
  }

  const cookiesToSet: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(values) {
          cookiesToSet.push(...values);
        },
      },
    },
  );

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !data.user) {
    return loginError(
      request,
      acceptsJson,
      signInError?.message ?? "Giriş yapılamadı.",
      401,
      cookiesToSet,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, roles, role_status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile || !isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return loginError(
      request,
      acceptsJson,
      "Hesabınızın rol profili bulunamadı. Sistem yöneticisine başvurun.",
      403,
      cookiesToSet,
    );
  }

  const grantedRoles = (profile.roles ?? []).filter(isUserRole);
  const roles: UserRole[] =
    grantedRoles.length > 0 ? grantedRoles : [profile.role];

  let redirectTo: string;

  if (isRoleStatus(profile.role_status) && profile.role_status === "secilmedi") {
    redirectTo = "/hosgeldiniz";
  } else if (
    isRoleStatus(profile.role_status) &&
    (profile.role_status === "beklemede" || profile.role_status === "reddedildi")
  ) {
    redirectTo = "/onay-bekleniyor";
  } else {
    // Sistem yoneticisi rolu verilmis bir hesap, aktif rol daha once baska bir
    // panelde kalmis olsa bile giriste yonetim ekranina ulasabilmelidir.
    const destinationRole: UserRole = roles.includes("admin")
      ? "admin"
      : profile.role;
    redirectTo = dashboardPathFor(destinationRole);
  }

  const response = acceptsJson
    ? NextResponse.json(
        { redirectTo },
        { headers: { "Cache-Control": "no-store" } },
      )
    : NextResponse.redirect(new URL(redirectTo, request.url), 303);

  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  // Ayni hesapla daha once olusmus rol onbellegi yeni profil kararini ezmesin.
  response.cookies.delete(ROLE_CACHE_COOKIE);

  return response;
}

function loginError(
  request: NextRequest,
  acceptsJson: boolean,
  message: string,
  status: number,
  cookiesToSet: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [],
) {
  const response = acceptsJson
    ? NextResponse.json(
        { error: message },
        { status, headers: { "Cache-Control": "no-store" } },
      )
    : (() => {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("mode", "giris");
        loginUrl.searchParams.set("error", message);
        return NextResponse.redirect(loginUrl, 303);
      })();

  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}
