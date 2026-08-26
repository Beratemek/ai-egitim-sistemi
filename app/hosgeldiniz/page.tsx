import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BookshelfBackdrop } from "@/components/shared/bookshelf-backdrop";
import { BrandMark } from "@/components/shared/brand-mark";
import { RoleOnboarding } from "@/components/shared/role-onboarding";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { dashboardPathFor } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Hoş Geldiniz" };

/**
 * Ilk giristen sonra rol seçim ekrani.
 *
 * Buraya yonlendirmeyi middleware yapar (`role_status = 'secilmedi'` veya
 * reddedilmis bir talep). Yine de oturum kontrolu burada da var: sayfa
 * doğrudan acilirsa da korunmali.
 */
export default async function HosGeldinizPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role_status === "onayli") {
    redirect(dashboardPathFor(current.profile.role));
  }
  if (current.profile.role_status === "beklemede") {
    redirect("/onay-bekleniyor");
  }

  return (
    <main className="bg-study relative flex min-h-screen flex-col overflow-hidden bg-background">
      <BookshelfBackdrop className="opacity-70" />

      <header className="relative z-10 flex h-16 items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <ThemeToggle />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-40">
        <div className="animate-kitap-yukselir w-full max-w-2xl">
          <RoleOnboarding
            fullName={current.profile.full_name}
            email={current.profile.email ?? current.user.email ?? ""}
            previousRole={current.profile.requested_role}
            rejected={current.profile.role_status === "reddedildi"}
          />
        </div>
      </div>
    </main>
  );
}
