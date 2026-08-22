import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { roleForPath } from "@/lib/roles";
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

  /**
   * Kullaniciya VERILMIS roller. Yetkinin tek kaynagi budur.
   *
   * `roles` kolonu eklenmeden once olusmus kayitlarda kume bos olabilir;
   * o durumda etkin rol tek eleman olarak kabul edilir.
   */
  const grantedRoles: UserRole[] =
    current.profile.roles && current.profile.roles.length > 0
      ? current.profile.roles
      : [current.profile.role];

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
  const activeRole: UserRole =
    pathRole && grantedRoles.includes(pathRole) ? pathRole : current.profile.role;

  return (
    <DashboardShell
      role={activeRole}
      grantedRoles={grantedRoles}
      fullName={current.profile.full_name || current.user.email || "Kullanici"}
    >
      {children}
    </DashboardShell>
  );
}
