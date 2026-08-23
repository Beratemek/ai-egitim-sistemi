import Link from "next/link";

import { cn } from "@/lib/utils";

/** Marka logosu. Sunucu bileseni - istemci sinirina ihtiyaci yok. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)}>
      {/* Kalıcı marka işareti hazırlanırken yerini nötr bir renk çizgisi tutar. */}
      <span className="h-8 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
      <span className="flex flex-col leading-none">
        <span className="font-sans text-[15px] font-semibold tracking-[-0.02em]">AI Eğitim</span>
        <span className="mt-0.5 text-[11px] text-muted-foreground">
          Ölçme &amp; Değerlendirme
        </span>
      </span>
    </Link>
  );
}
