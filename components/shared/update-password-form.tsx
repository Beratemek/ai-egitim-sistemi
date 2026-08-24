"use client";

import * as React from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase";

/** Kurtarma baglantisi dogrulandiktan sonra yeni parolayi kaydeder. */
export function UpdatePasswordForm() {
  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Parolanız en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirmation) {
      setError("Parolalar birbiriyle eşleşmiyor.");
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const params = new URLSearchParams({
        mode: "giris",
        message: "Parolanız güncellendi. Yeni parolanızla giriş yapabilirsiniz.",
      });
      window.location.assign(`/auth/signout-and-login?${params.toString()}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(
        /same password|different from the old/i.test(message)
          ? "Yeni parolanız önceki parolanızdan farklı olmalıdır."
          : "Parola güncellenemedi. Bağlantının süresi dolmuş olabilir; yeniden bağlantı isteyin.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-password">Yeni parola</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
        <p className="text-xs text-muted-foreground">En az 8 karakter kullanın.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Yeni parola tekrar</Label>
        <Input
          id="confirm-password"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="••••••••"
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
        {pending ? "Güncelleniyor..." : "Parolayı güncelle"}
      </Button>
    </form>
  );
}
