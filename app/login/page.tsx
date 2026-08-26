import type { Metadata } from "next";

import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { LoginForm } from "@/components/shared/login-form";
import { safeNextPath } from "@/lib/auth-cookies";
import { SELECTABLE_ROLES } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Giriş",
  description: "İzometri çalışma alanınıza giriş yapın.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    mode?: string;
    next?: string;
    role?: string;
  }>;
}) {
  const params = await searchParams;
  const callbackError = params.error ?? null;
  const callbackMessage = params.message ?? null;
  const initialMode = params.mode === "kayit" ? "kayit" : "giris";
  const initialRole =
    SELECTABLE_ROLES.find((definition) => definition.role === params.role)?.role ??
    "ogrenci";
  const nextPath = safeNextPath(params.next);

  return (
    <AuthPageShell
      title="İzometri çalışma alanınıza devam edin"
      description="Giriş yapın veya yeni hesabınızı oluşturun."
    >
      <LoginForm
        callbackError={callbackError}
        callbackMessage={callbackMessage}
        initialMode={initialMode}
        initialRole={initialRole}
        nextPath={nextPath}
      />

      <p className="text-center text-xs text-muted-foreground">
        Giriş yapamıyorsanız okulunuzun sistem yöneticisine başvurun.
      </p>
    </AuthPageShell>
  );
}
