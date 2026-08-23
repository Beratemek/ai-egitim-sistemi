import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { grantedRoles, roleForPath } from "@/lib/roles";
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
  const granted: UserRole[] = grantedRoles(current.profile);

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
    pathRole && granted.includes(pathRole) ? pathRole : current.profile.role;

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
