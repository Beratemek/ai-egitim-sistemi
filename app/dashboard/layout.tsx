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
  // Supabase yapilandirilmamissa demo modunda calis: rolu URL'den cikar.
  if (!isSupabaseConfigured) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? "/dashboard";
    const role: UserRole = roleForPath(pathname) ?? "egitmen";

    return (
      <DashboardShell role={role} fullName="Demo Kullanici" demoMode>
        {children}
      </DashboardShell>
    );
  }

  const current = await getCurrentUser();

  // Middleware zaten yonlendiriyor; bu yalnizca ek guvenlik katmanidir.
  if (!current) redirect("/login");

  return (
    <DashboardShell
      role={current.profile.role}
      fullName={current.profile.full_name || current.user.email || "Kullanici"}
      devSwitch={
        isDevRoleSwitchEnabled && current.actualRole === "egitim_yoneticisi"
      }
      actualRole={current.actualRole}
      impersonating={current.impersonatedRole !== null}
    >
      {children}
    </DashboardShell>
  );
}
