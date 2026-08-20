"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";

import { resendConfirmationEmail } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/** Dogrulama e-postasini yeniden gonderme butonu ve sonuc mesaji. */
export function ResendConfirmation({ email }: { email: string }) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<
    { ok: true; message: string } | { ok: false; error: string } | null
  >(null);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full gap-2"
        disabled={pending || !email}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            setResult(await resendConfirmationEmail(email));
          });
        }}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Dogrulama e-postasini yeniden gonder
      </Button>

      {result ? (
        <p
          role="status"
          className={
            result.ok
              ? "rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-left text-sm text-success"
              : "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
          }
        >
          {result.ok ? result.message : result.error}
        </p>
      ) : null}
    </div>
  );
}
