"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase";

/** Google'in marka kilavuzuna uygun çok renkli "G" logosu (inline SVG). */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * Google ile giriş.
 *
 * Supabase OAuth akisini baslatir; kullanıcı Google'da onay verdikten sonra
 * /auth/callback adresine `?code=` ile doner ve orada oturuma cevrilir.
 *
 * Calismasi için Supabase panelinde Google saglayicisinin açık ve Client ID /
 * Secret'in girilmis olmasi gerekir.
 */
export function GoogleSignInButton({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${publicEnv.siteUrl}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });

      // Başarılı olursa tarayici Google'a yonlenir; buraya donulmez.
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Google ile giriş başlatılamadı.",
      );
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2.5"
        disabled={disabled || pending}
        onClick={() => void handleClick()}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleLogo className="h-4 w-4" />
        )}
        Google ile devam et
      </Button>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
