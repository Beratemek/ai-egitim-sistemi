import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { isSupabaseConfigured } from "@/lib/env";
import {
  dashboardPathFor,
  grantedRoles,
  landingRole,
  roleForPath,
} from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Supabase yapilandirilmamissa demo modunda calis: rolu URL'den çıkar.
  if (!isSupabaseConfigured) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? "/dashboard";
    const role: UserRole = roleForPath(pathname) ?? "egitmen";

    return (
      <DashboardShell role={role} fullName="Örnek Kullanıcı" demoMode>
        {children}
      </DashboardShell>
    );
  }

  const current = await getCurrentUser();

  // Middleware zaten yonlendiriyor; bu yalnizca ek guvenlik katmanidir.
  if (!current) redirect("/login");

  /** Kullaniciya VERILMIS roller. Yetkinin tek kaynagi budur. */
  // Tip ANOTASYONU YOK: `grantedRoles` bilerek bos olmayan bir demet
  // ([UserRole, ...UserRole[]]) donuyor ki cagiranlar `granted[0]` okurken
  // undefined kontrolu yapmak zorunda kalmasin. `UserRole[]` diye yazmak o
  // bilgiyi cope atiyordu.
  const granted = grantedRoles(current.profile);

  /**
   * Icinde bulunulan panel.
   *
   * Yol bir rolun alanina isaret ediyorsa VE o rol kullaniciya verilmisse o
   * rolun paneli gosterilir; menu, baslik ve rol karti hep ayni rolu anlatir.
   * Aksi halde etkin role dusulur. `admin` icin ayricalikli bir dal YOK -
   * sistem yoneticisi de yalnizca kendisine atanmis rollere girer.
   */
  const requestHeaders = await headers();
  const pathRole = roleForPath(requestHeaders.get("x-pathname") ?? "/dashboard");

  /**
   * Kullanicinin guvenle acabilecegi rol.
   *
   * `profile.role` TEK BASINA kullanilamaz: kumeden cikarilmis ya da
   * `grantedRoles` tarafindan elenmis (arayuzde karsiligi olmayan) bir rol
   * olabilir. Boyle bir rol DashboardShell'e gecerse ROLE_DEFINITIONS'ta
   * aranirken `undefined` doner ve panel acilmadan coker.
   */
  const safeRole = landingRole(
    granted,
    granted.includes(current.profile.role) ? current.profile.role : granted[0],
  );

  // Middleware ana korumadir; layout da ayni kurali uygular. Boylece istemci
  // gecisi, onbellek veya middleware yapilandirma hatasi baska rolun sayfa
  // icerigini mevcut kullanicinin adi altinda render edemez.
  if (pathRole && !granted.includes(pathRole)) {
    redirect(safeRole ? dashboardPathFor(safeRole) : "/login");
  }

  // Verilmis tek bir gecerli rol bile yoksa gosterilecek panel de yok.
  if (!safeRole) redirect("/login");

  const activeRole: UserRole =
    pathRole && granted.includes(pathRole) ? pathRole : safeRole;

  return (
    <DashboardShell
      role={activeRole}
      grantedRoles={granted}
      fullName={current.profile.full_name || current.user.email || "Kullanici"}
    >
      {children}
    </DashboardShell>
  );
}
