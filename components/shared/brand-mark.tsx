import Link from "next/link";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/** Marka logosu. Sunucu bileseni - istemci sinirina ihtiyaci yok. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">AI Egitim</span>
        <span className="mt-0.5 text-[11px] text-muted-foreground">
          Olcme &amp; Degerlendirme
        </span>
      </span>
    </Link>
  );
}
