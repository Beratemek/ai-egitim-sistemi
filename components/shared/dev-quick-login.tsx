"use client";

import * as React from "react";
import { FlaskConical, Loader2 } from "lucide-react";

import { devQuickLogin } from "@/app/actions/dev-auth";
import { Button } from "@/components/ui/button";

/**
 * Yerel gelistirmede tek tikla giris.
 * Kimlik bilgileri .env.local icindeki DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD'dan
 * SUNUCUDA okunur; parola istemci paketine girmez.
 */
export function DevQuickLogin() {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            gelistirme
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await devQuickLogin();
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FlaskConical className="h-4 w-4" />
        )}
        Gelistirici hesabiyla gir
      </Button>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Giris sonrasi ust cubuktaki <strong>Rol</strong> menusunden dort rolu de
        gezebilirsiniz.
      </p>
    </div>
  );
}
