import Link from "next/link";

import { RoleBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
}

/** Rol basina sol menu ogeleri. */
export const ROLE_NAV: Record<UserRole, readonly NavItem[]> = {
  icerik_uzmani: [
    { href: "/dashboard/icerik-uzmani", label: "Icerik & Kazanimlar" },
  ],
  egitmen: [
    { href: "/dashboard/egitmen", label: "Genel Bakis" },
    { href: "/dashboard/egitmen/soru-havuzu", label: "Soru Havuzu" },
  ],
  ogrenci: [{ href: "/dashboard/ogrenci", label: "Sinavlarim" }],
  egitim_yoneticisi: [{ href: "/dashboard/yonetici", label: "Istatistikler" }],
};

export interface DashboardShellProps {
  role: UserRole;
  fullName: string;
  /** Supabase yapilandirilmadiginda demo rozeti gosterilir. */
  demoMode?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  fullName,
  demoMode = false,
  children,
}: DashboardShellProps) {
  const definition = ROLE_DEFINITIONS[role];
  const navItems = ROLE_NAV[role];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              AI Egitim Sistemi
            </Link>
            <RoleBadge role={role} />
            {demoMode ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Demo
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{fullName}</span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Cikis
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {definition.label}
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 px-3 text-xs leading-relaxed text-muted-foreground">
            {definition.description}
          </p>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
