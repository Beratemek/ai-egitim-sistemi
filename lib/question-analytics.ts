import type {
  Exam,
  ExamAttempt,
  ExamQuestion,
  LearningOutcome,
  Question,
  Submission,
  UserProfile,
} from "@/lib/types";
import { normalizeOptionKey } from "./answer-normalization.ts";
import { isBlankAnswer } from "./outcome-diagnostics.ts";

const KEY_SEPARATOR = "\u0000";

export const QUESTION_ANALYTICS_THRESHOLDS = {
  minimumEvidence: 5,
  minimumDiscriminationEvidence: 10,
  veryEasyScore: 90,
  veryHardScore: 30,
  negativeDiscrimination: -0.1,
  highAiTeacherDifference: 20,
} as const;

export type QuestionAnalyticsWarning =
  | "insufficient_evidence"
  | "very_easy"
  | "very_hard"
  | "negative_discrimination"
  | "unused_option"
  | "high_ai_teacher_difference";

export interface QuestionOptionStatistic {
  key: string;
  text: string;
  count: number;
  rate: number;
  correct: boolean;
}

export interface InstructorQuestionAnalyticsRow {
  questionId: string;
  text: string;
  type: Question["type"];
  subject: string;
  topic: string;
  difficulty: string;
  outcomeId: string | null;
  outcomeText: string | null;
  examIds: string[];
  examTitles: string[];
  useCount: number;
  opportunityCount: number;
  approvedAnswerCount: number;
  blankCount: number;
  blankRate: number;
  averageScore: number | null;
  correctRate: number | null;
  aiTeacherMeanDifference: number | null;
  teacherOverrideRate: number | null;
  discrimination: number | null;
  optionStatistics: QuestionOptionStatistic[];
  warnings: QuestionAnalyticsWarning[];
  lastUsedAt: string | null;
}

export interface QuestionAnalyticsOverview {
  questionCount: number;
  responseOpportunityCount: number;
  averageSuccess: number | null;
  highPriorityCount: number;
  insufficientEvidenceCount: number;
  averageAiTeacherDifference: number | null;
}

export interface InstructorQuestionAnalytics {
  overview: QuestionAnalyticsOverview;
  questions: InstructorQuestionAnalyticsRow[];
  filterOptions: {
    subjects: string[];
    exams: Array<{ id: string; title: string; subject: string }>;
    classrooms: string[];
  };
}

export interface QuestionAnalyticsSource {
  exams: readonly Exam[];
  examQuestions: readonly ExamQuestion[];
  attempts: readonly ExamAttempt[];
  submissions: readonly Submission[];
  questions: readonly Question[];
  outcomes: readonly LearningOutcome[];
  students: readonly UserProfile[];
}

export interface QuestionAnalyticsScope {
  subject?: string;
  examId?: string;
  classroom?: string;
  questionType?: Question["type"];
  dateFrom?: string;
  dateTo?: string;
}

type Observation = {
  exam: Exam;
  attempt: ExamAttempt;
  link: ExamQuestion;
  submission: Submission | null;
  score: number;
  blank: boolean;
  answer: string;
  restScore: number | null;
};

export function buildInstructorQuestionAnalytics(
  source: QuestionAnalyticsSource,
  scope: QuestionAnalyticsScope = {},
): InstructorQuestionAnalytics {
  const studentById = new Map(source.students.map((student) => [student.id, student]));
  const exams = source.exams.filter((exam) => {
    if (scope.subject && exam.subject !== scope.subject) return false;
    if (scope.examId && exam.id !== scope.examId) return false;
    return inDateRange(exam, scope.dateFrom, scope.dateTo);
  });
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const examIds = new Set(exams.map((exam) => exam.id));
  const questionById = new Map(source.questions.map((question) => [question.id, question]));
  const outcomeById = new Map(source.outcomes.map((outcome) => [outcome.id, outcome]));
  const submissionByKey = new Map(
    source.submissions.map((submission) => [
      submissionKey(submission.exam_id, submission.student_id, submission.question_id),
      submission,
    ]),
  );
  const linksByExam = groupBy(
    source.examQuestions.filter((link) => examIds.has(link.exam_id)),
    (link) => link.exam_id,
  );
  const completedAttempts = source.attempts.filter((attempt) => {
    if (!examIds.has(attempt.exam_id) || attempt.status !== "sonuclandi") return false;
    if (!scope.classroom) return true;
    return studentById.get(attempt.student_id)?.classroom === scope.classroom;
  });

  const observationsByQuestion = new Map<string, Observation[]>();
  for (const attempt of completedAttempts) {
    const exam = examById.get(attempt.exam_id);
    if (!exam) continue;
    for (const link of linksByExam.get(attempt.exam_id) ?? []) {
      const question = questionById.get(link.question_id);
      if (!question || (scope.questionType && question.type !== scope.questionType)) continue;
      const submission =
        submissionByKey.get(
          submissionKey(attempt.exam_id, attempt.student_id, link.question_id),
        ) ?? null;
      const approvedScore =
        submission?.status === "egitmen_onayli" &&
        submission.instructor_approved_score !== null
          ? clampScore(submission.instructor_approved_score)
          : 0;
      const blank = !submission || isBlankAnswer(submission.answer_text);
      const observation: Observation = {
        exam,
        attempt,
        link,
        submission,
        score: blank ? 0 : approvedScore,
        blank,
        answer: submission?.answer_text ?? "",
        restScore: restOfExamScore(attempt, link, blank ? 0 : approvedScore),
      };
      const bucket = observationsByQuestion.get(question.id) ?? [];
      bucket.push(observation);
      observationsByQuestion.set(question.id, bucket);
    }
  }

  const usedQuestionIds = new Set(
    source.examQuestions
      .filter((link) => examIds.has(link.exam_id))
      .map((link) => link.question_id),
  );
  const questions = source.questions
    .filter(
      (question) =>
        usedQuestionIds.has(question.id) &&
        (!scope.questionType || question.type === scope.questionType),
    )
    .map((question) =>
      buildQuestionRow(
        question,
        observationsByQuestion.get(question.id) ?? [],
        exams,
        source.examQuestions,
        outcomeById.get(question.outcome_id ?? "") ?? null,
      ),
    )
    .sort(compareQuestionRows);

  const measured = questions.filter(
    (question) => question.averageScore !== null && question.opportunityCount > 0,
  );
  const aiDifferences = questions
    .map((question) => question.aiTeacherMeanDifference)
    .filter((value): value is number => value !== null);

  return {
    overview: {
      questionCount: questions.length,
      responseOpportunityCount: questions.reduce(
        (total, question) => total + question.opportunityCount,
        0,
      ),
      averageSuccess: weightedAverage(
        measured.map((question) => ({
          value: question.averageScore as number,
          weight: question.opportunityCount,
        })),
      ),
      highPriorityCount: questions.filter((question) =>
        question.warnings.some((warning) =>
          ["very_hard", "negative_discrimination", "high_ai_teacher_difference"].includes(warning),
        ),
      ).length,
      insufficientEvidenceCount: questions.filter((question) =>
        question.warnings.includes("insufficient_evidence"),
      ).length,
      averageAiTeacherDifference: average(aiDifferences),
    },
    questions,
    filterOptions: {
      subjects: [
        ...new Set(
          source.exams
            .map((exam) => exam.subject)
            .filter((subject): subject is string => Boolean(subject)),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
      exams: source.exams
        .map((exam) => ({
          id: exam.id,
          title: exam.title,
          subject: exam.subject ?? "Ders belirtilmemiş",
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "tr")),
      classrooms: [
        ...new Set(
          source.students
            .map((student) => student.classroom)
            .filter((classroom): classroom is string => Boolean(classroom)),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    },
  };
}

function buildQuestionRow(
  question: Question,
  observations: readonly Observation[],
  exams: readonly Exam[],
  allLinks: readonly ExamQuestion[],
  outcome: LearningOutcome | null,
): InstructorQuestionAnalyticsRow {
  const examIds = [
    ...new Set(
      allLinks
        .filter((link) => link.question_id === question.id && exams.some((exam) => exam.id === link.exam_id))
        .map((link) => link.exam_id),
    ),
  ];
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const approved = observations.filter(
    (item) =>
      item.submission?.status === "egitmen_onayli" &&
      item.submission.instructor_approved_score !== null,
  );
  const scores = observations.map((item) => item.score);
  const optionStatistics = buildOptionStatistics(question, observations);
  const comparableAiScores = approved.filter(
    (item) => item.submission?.ai_score !== null,
  );
  const aiTeacherDifferences = comparableAiScores.map((item) =>
    Math.abs(
      (item.submission?.ai_score as number) -
        (item.submission?.instructor_approved_score as number),
    ),
  );
  const discriminationPairs = observations
    .filter((item): item is Observation & { restScore: number } => item.restScore !== null)
    .map((item) => [item.score, item.restScore] as const);
  const discrimination =
    discriminationPairs.length >= QUESTION_ANALYTICS_THRESHOLDS.minimumDiscriminationEvidence
      ? pearson(discriminationPairs)
      : null;
  const averageScore = scores.length > 0 ? average(scores) : null;
  const aiTeacherMeanDifference = average(aiTeacherDifferences);
  const teacherOverrideRate =
    comparableAiScores.length > 0
      ? percentage(
          comparableAiScores.filter(
            (item) =>
              Math.abs(
                (item.submission?.ai_score as number) -
                  (item.submission?.instructor_approved_score as number),
              ) >= 0.1,
          ).length,
          comparableAiScores.length,
        )
      : null;
  const warnings: QuestionAnalyticsWarning[] = [];

  if (observations.length < QUESTION_ANALYTICS_THRESHOLDS.minimumEvidence) {
    warnings.push("insufficient_evidence");
  } else if (averageScore !== null) {
    if (averageScore >= QUESTION_ANALYTICS_THRESHOLDS.veryEasyScore) warnings.push("very_easy");
    if (averageScore <= QUESTION_ANALYTICS_THRESHOLDS.veryHardScore) warnings.push("very_hard");
  }
  if (
    discrimination !== null &&
    discrimination < QUESTION_ANALYTICS_THRESHOLDS.negativeDiscrimination
  ) {
    warnings.push("negative_discrimination");
  }
  const answeredTestCount = observations.filter((item) => !item.blank).length;
  if (
    question.type === "test" &&
    answeredTestCount >= QUESTION_ANALYTICS_THRESHOLDS.minimumEvidence &&
    optionStatistics.some((option) => option.count === 0)
  ) {
    warnings.push("unused_option");
  }
  if (
    aiTeacherDifferences.length >= QUESTION_ANALYTICS_THRESHOLDS.minimumEvidence &&
    aiTeacherMeanDifference !== null &&
    aiTeacherMeanDifference >= QUESTION_ANALYTICS_THRESHOLDS.highAiTeacherDifference
  ) {
    warnings.push("high_ai_teacher_difference");
  }

  const correctCount =
    question.type === "test" && question.correct_answer
      ? observations.filter(
          (item) =>
            !item.blank &&
            normalizeOptionKey(item.answer) === normalizeOptionKey(question.correct_answer as string),
        ).length
      : 0;

  return {
    questionId: question.id,
    text: question.text,
    type: question.type,
    subject: question.subject,
    topic: question.topic,
    difficulty: question.difficulty ?? "orta",
    outcomeId: question.outcome_id,
    outcomeText: outcome?.outcome_text ?? null,
    examIds,
    examTitles: examIds.map((examId) => examById.get(examId)?.title ?? "Sınav"),
    useCount: examIds.length,
    opportunityCount: observations.length,
    approvedAnswerCount: approved.length,
    blankCount: observations.filter((item) => item.blank).length,
    blankRate: percentage(
      observations.filter((item) => item.blank).length,
      observations.length,
    ),
    averageScore,
    correctRate:
      question.type === "test" ? percentage(correctCount, observations.length) : null,
    aiTeacherMeanDifference,
    teacherOverrideRate,
    discrimination,
    optionStatistics,
    warnings,
    lastUsedAt:
      observations
        .map((item) => item.attempt.completed_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
  };
}

function buildOptionStatistics(
  question: Question,
  observations: readonly Observation[],
): QuestionOptionStatistic[] {
  if (question.type !== "test") return [];
  const answeredCount = observations.filter((item) => !item.blank).length;
  const counts = new Map<string, number>();
  for (const item of observations) {
    if (item.blank) continue;
    const key = normalizeOptionKey(item.answer);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (question.options_json ?? []).map((option) => ({
    key: option.key,
    text: option.text,
    count: counts.get(normalizeOptionKey(option.key)) ?? 0,
    rate: percentage(counts.get(normalizeOptionKey(option.key)) ?? 0, answeredCount),
    correct:
      Boolean(question.correct_answer) &&
      normalizeOptionKey(option.key) === normalizeOptionKey(question.correct_answer as string),
  }));
}

function restOfExamScore(
  attempt: ExamAttempt,
  link: ExamQuestion,
  questionScore: number,
): number | null {
  if (
    attempt.earned_points === null ||
    attempt.total_points === null ||
    attempt.total_points <= link.points
  ) {
    return null;
  }
  const questionEarned = (link.points * questionScore) / 100;
  return clampScore(
    ((attempt.earned_points - questionEarned) / (attempt.total_points - link.points)) * 100,
  );
}

function pearson(pairs: readonly (readonly [number, number])[]): number | null {
  if (pairs.length < 2) return null;
  const meanX = pairs.reduce((total, [x]) => total + x, 0) / pairs.length;
  const meanY = pairs.reduce((total, [, y]) => total + y, 0) / pairs.length;
  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;
  for (const [x, y] of pairs) {
    numerator += (x - meanX) * (y - meanY);
    denominatorX += (x - meanX) ** 2;
    denominatorY += (y - meanY) ** 2;
  }
  const denominator = Math.sqrt(denominatorX * denominatorY);
  return denominator > 0 ? round(numerator / denominator, 2) : null;
}

function compareQuestionRows(
  a: InstructorQuestionAnalyticsRow,
  b: InstructorQuestionAnalyticsRow,
): number {
  const priority = (row: InstructorQuestionAnalyticsRow) =>
    row.warnings.filter((warning) => warning !== "insufficient_evidence").length;
  return (
    priority(b) - priority(a) ||
    (a.averageScore ?? Number.POSITIVE_INFINITY) -
      (b.averageScore ?? Number.POSITIVE_INFINITY) ||
    a.text.localeCompare(b.text, "tr")
  );
}

function submissionKey(
  examId: string,
  studentId: string,
  questionId: string | null,
): string {
  return [examId, studentId, questionId ?? ""].join(KEY_SEPARATOR);
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  return grouped;
}

function inDateRange(
  exam: Exam,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): boolean {
  const value = new Date(exam.ends_at ?? exam.starts_at ?? exam.created_at).getTime();
  if (!Number.isFinite(value)) return !dateFrom && !dateTo;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : null;
  return !(
    (from !== null && Number.isFinite(from) && value < from) ||
    (to !== null && Number.isFinite(to) && value > to)
  );
}

function percentage(value: number, total: number): number {
  return total > 0 ? round((value / total) * 100) : 0;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

function weightedAverage(
  values: readonly { value: number; weight: number }[],
): number | null {
  const totalWeight = values.reduce((total, item) => total + item.weight, 0);
  if (totalWeight <= 0) return null;
  return round(
    values.reduce((total, item) => total + item.value * item.weight, 0) /
      totalWeight,
  );
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function round(value: number, precision = 1): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}
