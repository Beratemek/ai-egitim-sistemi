import {
  DEFAULT_MASTERY_THRESHOLD,
  evidenceLevelOf,
  type OutcomeEvidenceLevel,
} from "./outcome-diagnostics.ts";
import type {
  GuardianStudentExamRow,
  GuardianStudentOutcomeRow,
  GuardianStudentSummary,
} from "./types.ts";

export const GUARDIAN_MASTERY_THRESHOLD = DEFAULT_MASTERY_THRESHOLD;

export type GuardianOutcomeStatus =
  | "support_needed"
  | "early_signal"
  | "on_track"
  | "unmeasured";

export interface GuardianHouseholdOverview {
  studentCount: number;
  assignedExamCount: number;
  completedExamCount: number;
  overdueExamCount: number;
  completionRate: number;
  averageScore: number | null;
}

export interface GuardianStudentSummaryView extends GuardianStudentSummary {
  completionRate: number;
  averageScore: number | null;
  latestScore: number | null;
}

export interface GuardianExamView extends GuardianStudentExamRow {
  isSubmitted: boolean;
  isCompleted: boolean;
  isOverdue: boolean;
}

export interface GuardianOutcomeView extends GuardianStudentOutcomeRow {
  evidenceLevel: OutcomeEvidenceLevel;
  isActionableWeak: boolean;
  status: GuardianOutcomeStatus;
}

export interface GuardianGrowthPoint {
  attemptId: string;
  examId: string;
  title: string;
  subject: string;
  completedAt: string;
  score: number;
}

export interface GuardianStudentAnalytics {
  student: GuardianStudentSummaryView;
  assignedCount: number;
  submittedCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;
  averageScore: number | null;
  supportAreaCount: number;
  earlySignalCount: number;
  exams: GuardianExamView[];
  outcomes: GuardianOutcomeView[];
  growthPoints: GuardianGrowthPoint[];
}

export interface GuardianAnalyticsOptions {
  masteryThreshold?: number;
  now?: number;
}

/**
 * Veli ana ekranındaki çoklu öğrenci özetini üretir.
 *
 * Ortalama, öğrencilerin ortalamalarının düz ortalaması değildir. Çok sınavı
 * olan öğrenciyle tek sınavı olan öğrencinin aynı ağırlığı taşımaması için her
 * öğrencinin tamamlanan sınav sayısı kadar ağırlıklandırılır.
 */
export function buildGuardianHouseholdOverview(
  students: readonly GuardianStudentSummary[],
): GuardianHouseholdOverview {
  const assignedExamCount = sum(students, (student) => student.assigned_exam_count);
  const completedExamCount = sum(students, (student) => student.completed_exam_count);
  const overdueExamCount = sum(students, (student) => student.overdue_exam_count);
  const scoredStudents = students.filter(
    (student) =>
      finiteNumber(student.average_score) !== null &&
      nonNegativeInteger(student.completed_exam_count) > 0,
  );
  const scoreWeight = sum(
    scoredStudents,
    (student) => student.completed_exam_count,
  );
  const weightedScore = scoredStudents.reduce(
    (total, student) =>
      total +
      (finiteNumber(student.average_score) ?? 0) *
        nonNegativeInteger(student.completed_exam_count),
    0,
  );

  return {
    studentCount: students.length,
    assignedExamCount,
    completedExamCount,
    overdueExamCount,
    completionRate: percentage(completedExamCount, assignedExamCount),
    averageScore: scoreWeight > 0 ? roundScore(weightedScore / scoreWeight) : null,
  };
}

export function guardianStudentSummaryView(
  student: GuardianStudentSummary,
): GuardianStudentSummaryView {
  return {
    ...student,
    completionRate: percentage(
      student.completed_exam_count,
      student.assigned_exam_count,
    ),
    averageScore: normalizedScore(student.average_score),
    latestScore: normalizedScore(student.latest_score),
  };
}

/**
 * Tek bir öğrenci için veliye gösterilecek salt-okunur analitiği hazırlar.
 * RPC'nin döndürdüğü `is_actionable_weak` alanına körü körüne güvenmez;
 * kanıt seviyesi ortak `evidenceLevelOf` kuralıyla yeniden hesaplanır.
 */
export function buildGuardianStudentAnalytics(
  student: GuardianStudentSummary,
  examRows: readonly GuardianStudentExamRow[],
  outcomeRows: readonly GuardianStudentOutcomeRow[],
  options: GuardianAnalyticsOptions = {},
): GuardianStudentAnalytics {
  const now = Number.isFinite(options.now) ? (options.now as number) : Date.now();
  const masteryThreshold = normalizeThreshold(options.masteryThreshold);
  const exams = examRows
    .map((exam): GuardianExamView => {
      const isSubmitted =
        exam.submitted_at !== null ||
        exam.progress_status === "degerlendiriliyor" ||
        exam.progress_status === "sonuclandi";
      const isCompleted = exam.progress_status === "sonuclandi";
      const dueAt = dateValue(exam.due_at);

      return {
        ...exam,
        final_score: isCompleted ? normalizedScore(exam.final_score) : null,
        isSubmitted,
        isCompleted,
        isOverdue:
          dueAt !== null &&
          dueAt < now &&
          (exam.progress_status === "baslanmadi" ||
            exam.progress_status === "devam_ediyor"),
      };
    })
    .sort(compareGuardianExams);

  const outcomes = outcomeRows
    .map((outcome): GuardianOutcomeView => {
      const evidenceLevel = evidenceLevelOf(
        nonNegativeInteger(outcome.measured_question_count),
        nonNegativeInteger(outcome.exam_count),
        nonNegativeInteger(outcome.approved_answer_count),
      );
      const averageScore = normalizedScore(outcome.average_score);
      const belowThreshold =
        averageScore !== null && averageScore < masteryThreshold;
      const isActionableWeak =
        belowThreshold && evidenceLevel !== "none" && evidenceLevel !== "early";
      const status: GuardianOutcomeStatus =
        evidenceLevel === "none"
          ? "unmeasured"
          : isActionableWeak
            ? "support_needed"
            : belowThreshold
              ? "early_signal"
              : "on_track";

      return {
        ...outcome,
        average_score: averageScore,
        evidenceLevel,
        isActionableWeak,
        status,
      };
    })
    .sort(compareGuardianOutcomes);

  const completedScores = exams
    .filter(
      (exam): exam is GuardianExamView & { final_score: number } =>
        exam.isCompleted && exam.final_score !== null,
    )
    .map((exam) => exam.final_score);
  const growthPoints = exams
    .filter(
      (
        exam,
      ): exam is GuardianExamView & {
        completed_at: string;
        final_score: number;
      } =>
        exam.isCompleted &&
        exam.completed_at !== null &&
        exam.final_score !== null &&
        dateValue(exam.completed_at) !== null,
    )
    .map((exam): GuardianGrowthPoint => ({
      attemptId: `guardian-${exam.exam_id}-${exam.completed_at}`,
      examId: exam.exam_id,
      title: exam.title,
      subject: exam.subject ?? "Ders belirtilmemiş",
      completedAt: exam.completed_at,
      score: exam.final_score,
    }))
    .sort((a, b) => dateValue(a.completedAt)! - dateValue(b.completedAt)!);

  const assignedCount = exams.length;
  const submittedCount = exams.filter((exam) => exam.isSubmitted).length;
  const completedCount = exams.filter((exam) => exam.isCompleted).length;

  return {
    student: guardianStudentSummaryView(student),
    assignedCount,
    submittedCount,
    completedCount,
    overdueCount: exams.filter((exam) => exam.isOverdue).length,
    completionRate: percentage(completedCount, assignedCount),
    averageScore:
      completedScores.length > 0
        ? roundScore(
            completedScores.reduce((total, score) => total + score, 0) /
              completedScores.length,
          )
        : null,
    supportAreaCount: outcomes.filter((outcome) => outcome.isActionableWeak).length,
    earlySignalCount: outcomes.filter(
      (outcome) => outcome.status === "early_signal",
    ).length,
    exams,
    outcomes,
    growthPoints,
  };
}

function compareGuardianExams(a: GuardianExamView, b: GuardianExamView): number {
  const priority = (exam: GuardianExamView) => {
    if (exam.isOverdue) return 0;
    if (exam.progress_status === "devam_ediyor") return 1;
    if (exam.progress_status === "baslanmadi") return 2;
    if (exam.progress_status === "degerlendiriliyor") return 3;
    return 4;
  };
  const priorityDifference = priority(a) - priority(b);
  if (priorityDifference !== 0) return priorityDifference;

  if (a.isCompleted && b.isCompleted) {
    return (
      (dateValue(b.completed_at) ?? Number.NEGATIVE_INFINITY) -
      (dateValue(a.completed_at) ?? Number.NEGATIVE_INFINITY)
    );
  }

  return (
    (dateValue(a.due_at) ?? Number.POSITIVE_INFINITY) -
      (dateValue(b.due_at) ?? Number.POSITIVE_INFINITY) ||
    a.title.localeCompare(b.title, "tr")
  );
}

function compareGuardianOutcomes(
  a: GuardianOutcomeView,
  b: GuardianOutcomeView,
): number {
  const priority: Record<GuardianOutcomeStatus, number> = {
    support_needed: 0,
    early_signal: 1,
    on_track: 2,
    unmeasured: 3,
  };

  return (
    priority[a.status] - priority[b.status] ||
    (a.average_score ?? Number.POSITIVE_INFINITY) -
      (b.average_score ?? Number.POSITIVE_INFINITY) ||
    a.outcome_text.localeCompare(b.outcome_text, "tr")
  );
}

function percentage(part: number, whole: number): number {
  const safePart = nonNegativeInteger(part);
  const safeWhole = nonNegativeInteger(whole);
  return safeWhole === 0
    ? 0
    : Math.min(100, Math.round((safePart / safeWhole) * 100));
}

function sum<T>(rows: readonly T[], valueOf: (row: T) => number): number {
  return rows.reduce(
    (total, row) => total + nonNegativeInteger(valueOf(row)),
    0,
  );
}

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function normalizedScore(value: number | null): number | null {
  const finite = finiteNumber(value);
  return finite === null ? null : roundScore(Math.min(100, Math.max(0, finite)));
}

function finiteNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) return GUARDIAN_MASTERY_THRESHOLD;
  return Math.min(90, Math.max(40, value as number));
}

function dateValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
