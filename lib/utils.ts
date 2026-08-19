import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind sinif adlarini cakismalari cozerek birlestirir. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** ISO tarih dizesini "19.08.2026 14:30" formatinda gosterir. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** Puani "87,5 / 100" seklinde gosterir. */
export function formatScore(score: number | null, max = 100): string {
  if (score === null) return "-";
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(score)} / ${max}`;
}
