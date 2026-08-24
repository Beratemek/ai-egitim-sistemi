import type { Metadata } from "next";

import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { ForgotPasswordForm } from "@/components/shared/forgot-password-form";

export const metadata: Metadata = {
  title: "Şifremi Unuttum",
  description: "İzometri hesabınız için parola yenileme bağlantısı isteyin.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthPageShell
      title="Parolanızı yenileyin"
      description="Hesabınıza bağlı e-posta adresine güvenli bir yenileme bağlantısı göndereceğiz."
      backHref="/login"
      backLabel="Giriş ekranı"
    >
      <ForgotPasswordForm callbackError={params.error ?? null} />
    </AuthPageShell>
  );
}
