"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase";

interface ForgotPasswordFormProps {
  callbackError?: string | null;
}

/** Supabase'in parola kurtarma e-postasini gonderen ilk adim. */
export function ForgotPasswordForm({
  callbackError = null,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(callbackError);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const callbackUrl = new URL("/auth/callback", publicEnv.siteUrl);
      callbackUrl.searchParams.set("next", "/sifre-yenile");

      const supabase = createClient();
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: callbackUrl.toString() },
      );

      if (requestError) throw requestError;
      setSent(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(
        /rate limit|too many requests/i.test(message)
          ? "Çok fazla e-posta istendi. Lütfen bir süre sonra tekrar deneyin."
          : "Bağlantı gönderilemedi. E-posta adresinizi kontrol edip tekrar deneyin.",
      );
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Bu adres sistemde kayıtlıysa parola yenileme bağlantısını gönderdik.
            Gelen kutunuzu ve spam klasörünü kontrol edin.
          </p>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={() => setSent(false)}>
          Başka bir adres dene
        </Button>
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Giriş ekranına dön
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="reset-email">E-posta</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ornek@okul.edu.tr"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Gönderiliyor..." : "Yenileme bağlantısı gönder"}
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Giriş ekranına dön
        <ArrowRight className="h-4 w-4" />
      </Link>
    </form>
  );
}
