import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/shared/brand-mark";
import { RoleOnboarding } from "@/components/shared/role-onboarding";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getCurrentUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Hos Geldiniz" };

/**
 * Ilk giristen sonra rol secim ekrani.
 *
 * Buraya yonlendirmeyi middleware yapar (`role_status = 'secilmedi'` veya
 * reddedilmis bir talep). Yine de oturum kontrolu burada da var: sayfa
 * dogrudan acilirsa da korunmali.
 */
export default async function HosGeldinizPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl">
          <RoleOnboarding
            fullName={current.profile.full_name || current.user.email || ""}
            previousRole={current.profile.requested_role}
            rejected={current.profile.role_status === "reddedildi"}
          />
        </div>
      </div>
    </main>
  );
}
