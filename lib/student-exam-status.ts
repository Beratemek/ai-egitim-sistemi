import { effectiveDeadline } from "./exam-time.ts";
import type { Exam, ExamAttemptStatus } from "@/lib/types";

/**
 * Ogrenci panelindeki sinav durumu.
 *
 * Attempt varsa kaynak odur; eski veriyle geriye uyumluluk icin cevap
 * sayilarindan durum turetme davranisi da korunur.
 */
export const STUDENT_EXAM_STATUSES = [
  "yaklasan",
  "baslanabilir",
  "devam_ediyor",
  "suresi_doldu",
  "onay_bekliyor",
  "sonuclandi",
] as const;

export type StudentExamStatus = (typeof STUDENT_EXAM_STATUSES)[number];

export interface StudentExamStatusInput {
  exam: Pick<Exam, "starts_at" | "ends_at" | "duration_minutes">;
  questionCount: number;
  answeredCount: number;
  /** AI on degerlendirmesine gonderilmis cevap sayisi. */
  evaluatedCount: number;
  approvedCount: number;
  attemptStatus?: ExamAttemptStatus | null;
  /** Denemenin baslama ani; sure siniri buradan isler. */
  attemptStartedAt?: string | null;
  /** Testlerde sabit zaman kullanilabilmesi icin disaridan verilebilir. */
  now?: Date;
}

/**
 * Durumlar oncelik sirasiyla hesaplanir:
 * tamamlanan cevaplar -> zaman penceresi -> cevap ilerlemesi.
 */
export function getStudentExamStatus({
  exam,
  questionCount,
  answeredCount,
  evaluatedCount,
  approvedCount,
  attemptStatus = null,
  attemptStartedAt = null,
  now = new Date(),
}: StudentExamStatusInput): StudentExamStatus {
  if (attemptStatus === "sonuclandi") return "sonuclandi";
  if (attemptStatus === "degerlendiriliyor") return "onay_bekliyor";

  const allAnswered = questionCount > 0 && answeredCount >= questionCount;

  if (allAnswered && approvedCount >= questionCount) return "sonuclandi";
  if (allAnswered && evaluatedCount >= questionCount) return "onay_bekliyor";

  const nowTime = now.getTime();
  const startsAt = parseTime(exam.starts_at);

  // Pencere ve kisiye ozel sure birlikte degerlendirilir; hangisi once
  // biterse o baglar (bkz. lib/exam-time.ts).
  const deadline = effectiveDeadline({
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
    startedAt: attemptStartedAt,
  });

  if (startsAt !== null && nowTime < startsAt) return "yaklasan";
  if (deadline !== null && nowTime >= deadline.getTime()) return "suresi_doldu";

  if (attemptStatus === "devam_ediyor") return "devam_ediyor";

  return answeredCount > 0 ? "devam_ediyor" : "baslanabilir";
}

export function canAnswerStudentExam(status: StudentExamStatus): boolean {
  return status === "baslanabilir" || status === "devam_ediyor";
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}
