import Link from "next/link";

import { cn } from "@/lib/utils";

/** Marka logosu. Sunucu bileseni - istemci sinirina ihtiyaci yok. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      {/*
        Kivilcim (Sparkles) ikonu neredeyse her yapay zeka urununde ayni
        yerde duruyor; marka isareti olarak KITAP secildi - urunun ne
        oldugunu soyluyor ve o kliseye dusmuyor.
      */}
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
          <path
            d="M4 4.6A1.6 1.6 0 0 1 5.6 3H10a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h4.4A1.6 1.6 0 0 1 20 4.6v12.8a1.6 1.6 0 0 1-1.6 1.6H14a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H5.6A1.6 1.6 0 0 1 4 17.4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M12 5.6v13.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-semibold">AI Eğitim</span>
        <span className="mt-0.5 text-[11px] text-muted-foreground">
          Ölçme &amp; Değerlendirme
        </span>
      </span>
    </Link>
  );
}
