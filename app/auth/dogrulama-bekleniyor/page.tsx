import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { ResendConfirmation } from "@/components/shared/resend-confirmation";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "E-posta doğrulaması bekleniyor" };

/**
 * Oturum acmis ama e-postasini dogrulamamis kullanicilarin geldigi ekran.
 * Middleware bu kullanicilari /dashboard'a birakmaz.
 */
export default async function DogrulamaBekleniyorPage() {
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Oturum yoksa ya da zaten dogrulanmissa burada isi yok.
  if (!user) redirect("/login");
  if (user.email_confirmed_at) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col bg-muted/30">
      <div className="flex items-center justify-between p-4 sm:p-6">
        <BrandMark />
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MailCheck className="h-6 w-6" />
            </span>

            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                E-posta adresinizi dogrulayin
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{user.email}</span>{" "}
                adresine bir dogrulama baglantisi gonderdik. Hesabınız, baglantiya
                tiklanana kadar etkinlesmez.
              </p>
            </div>

            <ResendConfirmation email={user.email ?? ""} />

            <div className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Baglantiyi, uygulamanin calistigi bilgisayarda acmalisiniz - adres
                <code className="mx-1 font-mono">localhost</code> uzerinden geldigi
                için telefondan acilmaz.
              </p>
              <p className="mt-2">
                Başka bir hesapla devam etmek için{" "}
                <Link href="/auth/signout-and-login" className="text-primary underline">
                  çıkış yapın
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
