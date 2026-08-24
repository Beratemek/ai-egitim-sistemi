import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandSymbolProps = {
  className?: string;
  inverse?: boolean;
};

type BrandMarkProps = {
  className?: string;
  href?: string;
  inverse?: boolean;
  showTagline?: boolean;
};

/**
 * İzometri marka sembolü.
 *
 * Dört dış kol sistemdeki dört çalışma alanını, ortadaki düşey eksen ortak
 * ölçüm dilini temsil eder. Üstteki nokta hem Türkçe “İ” harfini tamamlar
 * hem de öğrenmenin görünür hâle geldiği ölçüm noktasını oluşturur.
 */
export function BrandSymbol({ className, inverse = false }: BrandSymbolProps) {
  return (
    <svg
      aria-hidden
      className={cn("shrink-0", className)}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        className={inverse ? "fill-primary-foreground/15 stroke-primary-foreground/25" : "fill-primary stroke-primary/20"}
        height="36"
        rx="10"
        strokeWidth="1"
        width="36"
        x="2"
        y="2"
      />
      <g
        className="stroke-primary-foreground"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.15"
      >
        <path d="m10 12 10-4.5L30 12l-10 4.5L10 12Z" />
        <path d="m10 28 10-4.5L30 28l-10 4.5L10 28Z" />
        <path d="M20 16.5v7" />
      </g>
      <circle
        className={inverse ? "fill-primary-foreground" : "fill-highlight"}
        cx="20"
        cy="4.8"
        r="1.7"
      />
    </svg>
  );
}

/** İzometri yatay marka kilidi. Sunucu bileşenidir. */
export function BrandMark({
  className,
  href = "/",
  inverse = false,
  showTagline = true,
}: BrandMarkProps) {
  return (
    <Link
      aria-label="İzometri ana sayfa"
      href={href}
      className={cn("group flex min-w-0 items-center gap-2.5", className)}
    >
      <BrandSymbol
        className="h-9 w-9 transition-transform duration-500 ease-out group-hover:-rotate-2 group-hover:scale-[1.03]"
        inverse={inverse}
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "truncate font-sans text-[16px] font-bold tracking-[-0.045em]",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          İzometri
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 truncate text-[10px] font-medium tracking-[-0.01em]",
              inverse ? "text-primary-foreground/68" : "text-muted-foreground",
            )}
          >
            Öğrenmeyi görünür kıl.
          </span>
        ) : null}
      </span>
    </Link>
  );
}
