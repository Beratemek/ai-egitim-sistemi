import type {
  ExamAttemptStatus,
  QuestionOption,
  QuestionType,
  SubmissionStatus,
} from "./types.ts";
import { normalizeOptionKey } from "./answer-normalization.ts";
import type { QuestionVisual } from "./visual.ts";

export const STUDENT_MISTAKE_MASTERY_THRESHOLD = 60;

const KEY_SEPARATOR = "\u0000";

export type StudentMistakeStatus = "yanlis" | "kismi" | "bos";

export interface StudentMistakeExamInput {
  id: string;
  title: string;
  subject: string | null;
  created_at: string;
}

export interface StudentMistakeAttemptInput {
  exam_id: string;
  status: ExamAttemptStatus;
  completed_at: string | null;
}

/**
 * Öğrenci istemcisine açılması güvenli soru alanları.
 *
 * `correct_answer` ve `rubric` bilinçli olarak bu sözleşmede yoktur. Defter,
 * öğrencinin kendi kanıtını gösterir; yeniden kullanılabilir cevap anahtarı
 * üretmez.
 */
export interface SafeStudentMistakeQuestionInput {
  examId: string;
  id: string;
  subject: string;
  topic: string;
  text: string;
  type: QuestionType;
  options_json: QuestionOption[] | null;
  visual_json?: QuestionVisual | null;
  outcome_id: string | null;
  position: number;
  points: number;
}

export interface StudentMistakeSubmissionInput {
  exam_id: string;
  question_id: string | null;
  answer_text: string;
  ai_feedback: string | null;
  instructor_approved_score: number | null;
  instructor_note: string | null;
  status: SubmissionStatus;
}

export interface StudentMistakeOutcomeInput {
  id: string;
  outcome_text: string;
}

export interface StudentMistakeSource {
  exams: readonly StudentMistakeExamInput[];
  attempts: readonly StudentMistakeAttemptInput[];
  questions: readonly SafeStudentMistakeQuestionInput[];
  submissions: readonly StudentMistakeSubmissionInput[];
  outcomes?: readonly StudentMistakeOutcomeInput[];
}

export interface StudentMistakeRecord {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  completedAt: string | null;
  questionId: string;
  questionNumber: number;
  questionText: string;
  questionType: QuestionType;
  options: QuestionOption[];
  visual: QuestionVisual | null;
  topic: string;
  outcomeId: string | null;
  outcomeKey: string;
  outcomeLabel: string;
  status: StudentMistakeStatus;
  answerText: string;
  answerDisplay: string;
  approvedScore: number;
  questionPoints: number;
  earnedPoints: number;
  aiFeedback: string | null;
  instructorNote: string | null;
}

export interface StudentMistakeFilterOption {
  value: string;
  label: string;
}

export interface StudentMistakeNotebook {
  records: StudentMistakeRecord[];
  summary: {
    total: number;
    wrong: number;
    partial: number;
    blank: number;
    outcomeCount: number;
  };
  filterOptions: {
    subjects: StudentMistakeFilterOption[];
    exams: StudentMistakeFilterOption[];
    outcomes: StudentMistakeFilterOption[];
  };
}

export interface StudentMistakeFilters {
  subject?: string | null;
  examId?: string | null;
  outcomeKey?: string | null;
  status?: StudentMistakeStatus | null;
}

/**
 * Eski çoktan seçmeli kayıtlar geri bildirim içine `Doğru şık: B.` biçiminde
 * cevap anahtarını gömmüş olabilir. Yeni puanlama bunu üretmiyor; bu yardımcı
 * geçmiş kaydı da öğrenci ekranına ulaşmadan temizler.
 */
export function sanitizeStudentFeedback(value: string | null): string | null {
  if (!value) return null;

  const sanitized = value
    .replace(
      /(?:doğru|dogru)\s+(?:şık|sik|seçenek|secenek|cevap)\s*:[^\r\n]*/giu,
      "",
    )
    .replace(/[ \t]+([.,;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return sanitized.length > 0 ? sanitized : null;
}

/** Sonuçlanmış sınavların geliştirilmesi gereken soru kanıtlarını üretir. */
export function buildStudentMistakeNotebook(
  source: StudentMistakeSource,
  masteryThreshold = STUDENT_MISTAKE_MASTERY_THRESHOLD,
): StudentMistakeNotebook {
  const threshold = clampThreshold(masteryThreshold);
  const completedAttempts = new Map(
    source.attempts
      .filter((attempt) => attempt.status === "sonuclandi")
      .map((attempt) => [attempt.exam_id, attempt]),
  );
  const examById = new Map(source.exams.map((exam) => [exam.id, exam]));
  const outcomeById = new Map(
    (source.outcomes ?? []).map((outcome) => [outcome.id, outcome.outcome_text]),
  );
  const submissionByQuestion = new Map<string, StudentMistakeSubmissionInput>();

  for (const submission of source.submissions) {
    if (!submission.question_id || !completedAttempts.has(submission.exam_id)) {
      continue;
    }
    submissionByQuestion.set(
      questionKey(submission.exam_id, submission.question_id),
      submission,
    );
  }

  const records = source.questions
    .flatMap((question): StudentMistakeRecord[] => {
      const attempt = completedAttempts.get(question.examId);
      const exam = examById.get(question.examId);
      if (!attempt || !exam) return [];

      const submission = submissionByQuestion.get(
        questionKey(question.examId, question.id),
      );
      const blank = !submission || isBlankAnswer(submission.answer_text);
      const approvedScore = blank
        ? 0
        : clampScore(submission?.instructor_approved_score ?? 0);

      // Tam kanıt deftere girmez. Test soruları deterministik olarak 0/100
      // puanlandığı için aynı eşik hem test hem açık uçluda güvenle çalışır.
      if (!blank && approvedScore >= threshold) return [];

      const status: StudentMistakeStatus = blank
        ? "bos"
        : approvedScore <= 0
          ? "yanlis"
          : "kismi";
      const subject = question.subject || exam.subject || "Ders belirtilmemiş";
      const outcomeLabel = question.outcome_id
        ? outcomeById.get(question.outcome_id) ?? question.topic
        : question.topic;
      const outcomeKey =
        question.outcome_id ??
        ["topic", subject, question.topic].join(KEY_SEPARATOR);
      const answerText = submission?.answer_text ?? "";
      const questionPoints = positivePoints(question.points);

      return [
        {
          id: questionKey(question.examId, question.id),
          examId: question.examId,
          examTitle: exam.title,
          subject,
          completedAt: attempt.completed_at,
          questionId: question.id,
          questionNumber: question.position + 1,
          questionText: question.text,
          questionType: question.type,
          options: question.options_json ?? [],
          visual: question.visual_json ?? null,
          topic: question.topic,
          outcomeId: question.outcome_id,
          outcomeKey,
          outcomeLabel,
          status,
          answerText,
          answerDisplay: answerDisplayOf(question, answerText),
          approvedScore,
          questionPoints,
          earnedPoints: round((questionPoints * approvedScore) / 100),
          aiFeedback: sanitizeStudentFeedback(submission?.ai_feedback ?? null),
          instructorNote: normalizedText(submission?.instructor_note ?? null),
        },
      ];
    })
    .sort(compareMistakes);

  return {
    records,
    summary: {
      total: records.length,
      wrong: records.filter((record) => record.status === "yanlis").length,
      partial: records.filter((record) => record.status === "kismi").length,
      blank: records.filter((record) => record.status === "bos").length,
      outcomeCount: new Set(records.map((record) => record.outcomeKey)).size,
    },
    filterOptions: {
      subjects: uniqueOptions(records, (record) => record.subject, (record) => record.subject),
      exams: uniqueOptions(records, (record) => record.examId, (record) => record.examTitle),
      outcomes: uniqueOptions(
        records,
        (record) => record.outcomeKey,
        (record) => record.outcomeLabel,
      ),
    },
  };
}

export function filterStudentMistakes(
  records: readonly StudentMistakeRecord[],
  filters: StudentMistakeFilters,
): StudentMistakeRecord[] {
  return records.filter(
    (record) =>
      (!filters.subject || record.subject === filters.subject) &&
      (!filters.examId || record.examId === filters.examId) &&
      (!filters.outcomeKey || record.outcomeKey === filters.outcomeKey) &&
      (!filters.status || record.status === filters.status),
  );
}

function answerDisplayOf(
  question: SafeStudentMistakeQuestionInput,
  answerText: string,
): string {
  if (isBlankAnswer(answerText)) return "Cevap verilmedi";
  if (question.type !== "test") return answerText.trim();

  const normalized = normalizeOptionKey(answerText);
  const option = question.options_json?.find(
    (item) => normalizeOptionKey(item.key) === normalized,
  );
  return option ? `${option.key} — ${option.text}` : answerText.trim();
}

function uniqueOptions(
  records: readonly StudentMistakeRecord[],
  valueOf: (record: StudentMistakeRecord) => string,
  labelOf: (record: StudentMistakeRecord) => string,
): StudentMistakeFilterOption[] {
  const labels = new Map<string, string>();
  for (const record of records) {
    const value = valueOf(record);
    if (!labels.has(value)) labels.set(value, labelOf(record));
  }
  return [...labels.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

function isBlankAnswer(value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  return (
    normalized.length === 0 ||
    normalized === "cevap verilmedi" ||
    normalized === "cevap verilmedi." ||
    normalized === "yanıtsız" ||
    normalized === "yanitsiz"
  );
}

function normalizedText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function questionKey(examId: string, questionId: string): string {
  return examId + KEY_SEPARATOR + questionId;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return STUDENT_MISTAKE_MASTERY_THRESHOLD;
  return Math.min(100, Math.max(1, value));
}

function positivePoints(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareMistakes(
  first: StudentMistakeRecord,
  second: StudentMistakeRecord,
): number {
  const firstDate = first.completedAt ? Date.parse(first.completedAt) : 0;
  const secondDate = second.completedAt ? Date.parse(second.completedAt) : 0;
  return (
    secondDate - firstDate ||
    first.examTitle.localeCompare(second.examTitle, "tr") ||
    first.questionNumber - second.questionNumber
  );
}
