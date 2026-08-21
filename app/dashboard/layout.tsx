import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/shared/dashboard-shell";
import { isDevRoleSwitchEnabled } from "@/lib/dev-mode";
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
      <DashboardShell role={role} fullName="Demo Kullanıcı" demoMode>
        {children}
      </DashboardShell>
    );
  }

  const current = await getCurrentUser();

  // Middleware zaten yonlendiriyor; bu yalnızca ek guvenlik katmanidir.
  if (!current) redirect("/login");

  /**
   * `admin` her panele girebilir. Hangi paneldeyse basliklarda ve rol
   * kartinda O rol gorunur - egitmen sayfasindaysa "Egitmen Paneli". Sol
   * menu ise `navRole` ile admin'de kalir, boylece paneller arasinda
   * gezinmeye devam edebilir.
   */
  const isAdmin = current.profile.role === "admin";
  const requestHeaders = await headers();
  const activeRole: UserRole = isAdmin
    ? (roleForPath(requestHeaders.get("x-pathname") ?? "/dashboard") ?? "admin")
    : current.profile.role;

  return (
    <DashboardShell
      role={activeRole}
      navRole={current.profile.role}
      grantedRoles={
        current.profile.roles && current.profile.roles.length > 0
          ? current.profile.roles
          : [current.profile.role]
      }
      fullName={current.profile.full_name || current.user.email || "Kullanici"}
      devSwitch={
        isDevRoleSwitchEnabled && current.actualRole === "admin"
      }
      actualRole={current.actualRole}
      impersonating={current.impersonatedRole !== null}
    >
      {children}
    </DashboardShell>
  );
}
