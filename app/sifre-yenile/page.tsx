import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { UpdatePasswordForm } from "@/components/shared/update-password-form";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Yeni Parola",
  description: "İzometri hesabınız için yeni bir parola belirleyin.",
};

export default async function UpdatePasswordPage() {
  let authenticated = false;

  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  }

  return (
    <AuthPageShell
      title="Yeni parolanızı belirleyin"
      description="Hesabınızı korumak için daha önce kullanmadığınız güçlü bir parola seçin."
      backHref="/login"
      backLabel="Giriş ekranı"
    >
      {authenticated ? (
        <UpdatePasswordForm />
      ) : (
        <div className="space-y-5">
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Bu bağlantı geçersiz, kullanılmış veya süresi dolmuş olabilir.
          </p>
          <Link
            href="/sifremi-unuttum"
            className="flex h-12 items-center justify-center rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Yeni bağlantı iste
          </Link>
        </div>
      )}
    </AuthPageShell>
  );
}
