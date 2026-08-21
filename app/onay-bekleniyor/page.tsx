import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleDashed, LogOut, RefreshCw, ShieldX, UserCog } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { roleLabel } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase-server";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Onay Bekleniyor" };

/**
 * Rol talebi karara baglanana kadar gosterilen ekran.
 *
 * Kullanicinin etkin rolu bu asamada 'ogrenci'dir; yani burada beklerken
 * yetkili alanlara zaten erisemez. Ekran yalnizca durumu anlatir.
 */
export default async function OnayBekleniyorPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const { profile } = current;
  const rejected = profile.role_status === "reddedildi";
  const wanted = profile.requested_role ? roleLabel(profile.requested_role) : "-";

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
          <span
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
              rejected ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
            )}
          >
            {rejected ? (
              <ShieldX className="h-7 w-7" />
            ) : (
              <CircleDashed className="h-7 w-7" />
            )}
          </span>

          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            {rejected ? "Talebiniz onaylanmadi" : "Onay bekleniyor"}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {rejected ? (
              <>
                <strong className="font-medium text-foreground">{wanted}</strong> rolu
                icin yaptiginiz basvuru egitim yoneticisi tarafindan reddedildi.
                Farkli bir rol icin yeniden basvurabilirsiniz.
              </>
            ) : (
              <>
                <strong className="font-medium text-foreground">{wanted}</strong> rolu
                icin talebiniz egitim yoneticisine iletildi. Onaylandiginda bu hesapla
                dogrudan panele girebileceksiniz.
              </>
            )}
          </p>

          <dl className="mt-6 space-y-2 rounded-lg border bg-muted/40 p-4 text-left text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Hesap</dt>
              <dd className="truncate font-medium">{profile.email ?? "-"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Talep edilen rol</dt>
              <dd className="font-medium">{wanted}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">
                {rejected ? "Karar tarihi" : "Basvuru tarihi"}
              </dt>
              <dd className="font-medium">
                {formatDateTime(profile.role_reviewed_at ?? profile.updated_at)}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {rejected ? (
              <Link
                href="/hosgeldiniz"
                className={cn(buttonVariants(), "flex-1 gap-2")}
              >
                <UserCog className="h-4 w-4" />
                Baska bir rol sec
              </Link>
            ) : (
              <Link
                href="/onay-bekleniyor"
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-2")}
              >
                <RefreshCw className="h-4 w-4" />
                Durumu yenile
              </Link>
            )}

            <form action="/auth/signout" method="post" className="flex-1">
              <Button type="submit" variant="ghost" className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Cikis yap
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
