import { subjectKey } from "./subjects.ts";

const ISTANBUL_DATE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
});

/** Tamamlanma tarihini `2026-1` / `2026-2` donem anahtarina cevirir. */
export function courseFeedbackPeriodKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "bilinmeyen-donem";

  const parts = ISTANBUL_DATE_PARTS.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = Number(
    parts.find((part) => part.type === "month")?.value ?? "1",
  );

  return `${year}-${month <= 6 ? "1" : "2"}`;
}

export function courseFeedbackPeriodLabel(period: string): string {
  const match = /^(\d{4})-([12])$/.exec(period);
  return match ? `${match[1]} · ${match[2]}. dönem` : "Dönem belirtilmemiş";
}

export function courseFeedbackScopeKey(
  instructorId: string,
  subject: string,
  academicPeriod: string,
): string {
  return `${instructorId}\u0000${subjectKey(subject)}\u0000${academicPeriod}`;
}
