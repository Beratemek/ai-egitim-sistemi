import type {
  Exam,
  ExamAttempt,
  ExamQuestion,
  LearningOutcome,
  Question,
  Submission,
  UserProfile,
} from "@/lib/types";

const KEY_SEPARATOR = "\u0000";

export const DEFAULT_MASTERY_THRESHOLD = 60;

export type OutcomeEvidenceLevel = "none" | "early" | "supported" | "strong";

export interface OutcomeWrongAnswerSummary {
  answer: string;
  optionText: string | null;
  count: number;
}

export interface OutcomeQuestionDiagnostic {
  questionId: string;
  questionText: string;
  questionType: Question["type"];
  averageScore: number | null;
  answerCount: number;
  successfulCount: number;
  needsWorkCount: number;
  blankCount: number;
  pendingCount: number;
  examCount: number;
  wrongAnswers: OutcomeWrongAnswerSummary[];
}

export interface OutcomeDiagnosticCell {
  outcomeId: string;
  averageScore: number | null;
  answerCount: number;
  pendingCount: number;
  draftCount: number;
  excludedEvidenceCount: number;
  measuredQuestionCount: number;
  examCount: number;
  evidenceLevel: OutcomeEvidenceLevel;
  isActionableWeak: boolean;
  successfulCount: number;
  needsWorkCount: number;
  blankCount: number;
}

export interface OutcomeGroupDiagnostic extends OutcomeDiagnosticCell {
  groupId: string;
  label: string;
  questions: OutcomeQuestionDiagnostic[];
}

export interface OutcomeDiagnostic extends OutcomeDiagnosticCell {
  outcomeText: string;
  subject: string;
  topic: string;
  threshold: number;
  studentCount: number;
  classroomCount: number;
  questionCount: number;
  linkedQuestionCount: number;
  latestEvidenceAt: string | null;
  questions: OutcomeQuestionDiagnostic[];
  classrooms: OutcomeGroupDiagnostic[];
  students: OutcomeGroupDiagnostic[];
}

export interface OutcomeDiagnosticsSource {
  outcomes: readonly LearningOutcome[];
  questions: readonly Question[];
  examQuestions: readonly ExamQuestion[];
  submissions: readonly Submission[];
  attempts: readonly ExamAttempt[];
  exams: readonly Exam[];
  students: readonly UserProfile[];
}

export interface OutcomeDiagnosticsOptions {
  threshold?: number;
  examIds?: ReadonlySet<string>;
  subject?: string;
  outcomeIds?: ReadonlySet<string>;
}

type EvidenceEntry = {
  submission: Submission;
  question: Question;
  points: number;
  approvedScore: number | null;
  pending: boolean;
  draft: boolean;
  excludedEvidence: boolean;
  blank: boolean;
  successful: boolean;
  wrongAnswer: OutcomeWrongAnswerSummary | null;
};

type Aggregate = OutcomeDiagnosticCell & {
  latestEvidenceAt: string | null;
};

export function buildOutcomeDiagnostics(
  source: OutcomeDiagnosticsSource,
  options: OutcomeDiagnosticsOptions = {},
): OutcomeDiagnostic[] {
  const threshold = clampThreshold(options.threshold);
  const studentById = new Map(source.students.map((student) => [student.id, student]));
  const examById = new Map(source.exams.map((exam) => [exam.id, exam]));
  const attemptByStudentExam = new Map(
    source.attempts.map((attempt) => [
      examStudentKey(attempt.exam_id, attempt.student_id),
      attempt,
    ]),
  );
  const questionById = new Map(source.questions.map((question) => [question.id, question]));
  const outcomeByQuestion = new Map<string, string>();
  const poolQuestionCounts = new Map<string, number>();

  for (const question of source.questions) {
    if (!question.outcome_id) continue;
    outcomeByQuestion.set(question.id, question.outcome_id);
    poolQuestionCounts.set(
      question.outcome_id,
      (poolQuestionCounts.get(question.outcome_id) ?? 0) + 1,
    );
  }

  const pointsByExamQuestion = new Map<string, number>();
  const linkedQuestionIdsByOutcome = new Map<string, Set<string>>();
  for (const link of source.examQuestions) {
    if (options.examIds && !options.examIds.has(link.exam_id)) continue;
    const question = questionById.get(link.question_id);
    if (!question?.outcome_id) continue;
    if (options.subject && examById.get(link.exam_id)?.subject !== options.subject) continue;

    pointsByExamQuestion.set(
      examQuestionKey(link.exam_id, link.question_id),
      positivePoints(link.points),
    );
    const ids = linkedQuestionIdsByOutcome.get(question.outcome_id) ?? new Set<string>();
    ids.add(question.id);
    linkedQuestionIdsByOutcome.set(question.outcome_id, ids);
  }

  const entriesByOutcome = new Map<string, EvidenceEntry[]>();
  for (const submission of source.submissions) {
    if (!submission.question_id) continue;
    if (options.examIds && !options.examIds.has(submission.exam_id)) continue;

    const question = questionById.get(submission.question_id);
    if (!question?.outcome_id) continue;
    if (options.subject && examById.get(submission.exam_id)?.subject !== options.subject) continue;
    if (options.outcomeIds && !options.outcomeIds.has(question.outcome_id)) continue;

    const instructorApproved =
      submission.status === "egitmen_onayli" &&
      submission.instructor_approved_score !== null;
    const linkPoints = pointsByExamQuestion.get(
      examQuestionKey(submission.exam_id, submission.question_id),
    );
    const attemptCompleted =
      attemptByStudentExam.get(
        examStudentKey(submission.exam_id, submission.student_id),
      )?.status === "sonuclandi";
    const eligibleEvidence =
      instructorApproved && attemptCompleted && linkPoints !== undefined;
    const approvedScore = eligibleEvidence
      ? clampScore(submission.instructor_approved_score as number)
      : null;
    const blank = eligibleEvidence && isBlankAnswer(submission.answer_text);
    const successful =
      approvedScore !== null &&
      !blank &&
      isSuccessfulAnswer(question, submission.answer_text, approvedScore, threshold);
    const wrongAnswer =
      approvedScore !== null && !blank && !successful
        ? wrongAnswerOf(question, submission.answer_text)
        : null;
    const entry: EvidenceEntry = {
      submission,
      question,
      points: linkPoints ?? 0,
      approvedScore,
      pending: submission.status === "ai_degerlendirildi",
      draft: submission.status === "gonderildi",
      excludedEvidence: instructorApproved && !eligibleEvidence,
      blank,
      successful,
      wrongAnswer,
    };
    const bucket = entriesByOutcome.get(question.outcome_id) ?? [];
    bucket.push(entry);
    entriesByOutcome.set(question.outcome_id, bucket);
  }

  const visibleOutcomes = source.outcomes.filter((outcome) => {
    if (options.outcomeIds && !options.outcomeIds.has(outcome.id)) return false;
    return (
      !options.subject ||
      outcome.subject === options.subject ||
      entriesByOutcome.has(outcome.id) ||
      linkedQuestionIdsByOutcome.has(outcome.id)
    );
  });

  return visibleOutcomes
    .map((outcome): OutcomeDiagnostic => {
      const entries = entriesByOutcome.get(outcome.id) ?? [];
      const aggregate = aggregateEntries(outcome.id, entries, threshold);
      const students = groupDiagnostics(
        outcome.id,
        entries,
        threshold,
        (entry) => entry.submission.student_id,
        (studentId) => {
          const student = studentById.get(studentId);
          return student?.full_name || student?.email || "İsimsiz öğrenci";
        },
      );
      const classrooms = groupDiagnostics(
        outcome.id,
        entries,
        threshold,
        (entry) =>
          studentById.get(entry.submission.student_id)?.classroom ?? "Sınıf atanmamış",
        (classroom) => classroom,
      );

      return {
        ...aggregate,
        outcomeText: outcome.outcome_text,
        subject: outcome.subject ?? "Ders belirtilmemiş",
        topic: outcome.topic,
        threshold,
        studentCount: new Set(entries.map((entry) => entry.submission.student_id)).size,
        classroomCount: new Set(
          entries.map(
            (entry) =>
              studentById.get(entry.submission.student_id)?.classroom ??
              "Sınıf atanmamış",
          ),
        ).size,
        questionCount: poolQuestionCounts.get(outcome.id) ?? 0,
        linkedQuestionCount: linkedQuestionIdsByOutcome.get(outcome.id)?.size ?? 0,
        questions: buildQuestionDiagnostics(entries, threshold),
        classrooms,
        students,
      };
    })
    .sort(compareDiagnostics);
}

export function evidenceLevelOf(
  measuredQuestionCount: number,
  examCount: number,
  answerCount: number,
): OutcomeEvidenceLevel {
  if (answerCount === 0) return "none";
  if (measuredQuestionCount < 2) return "early";
  if (examCount < 2) return "supported";
  return "strong";
}

export function isBlankAnswer(answer: string): boolean {
  const normalized = answer.trim().toLocaleLowerCase("tr-TR");
  return (
    normalized.length === 0 ||
    normalized === "cevap verilmedi." ||
    normalized === "cevap verilmedi" ||
    normalized === "yanıtsız" ||
    normalized === "yanitsiz"
  );
}

function aggregateEntries(
  outcomeId: string,
  entries: readonly EvidenceEntry[],
  threshold: number,
): Aggregate {
  const approved = entries.filter((entry) => entry.approvedScore !== null);
  const pointTotal = approved.reduce((sum, entry) => sum + entry.points, 0);
  const weightedTotal = approved.reduce(
    (sum, entry) => sum + (entry.approvedScore as number) * entry.points,
    0,
  );
  const measuredQuestionCount = new Set(approved.map((entry) => entry.question.id)).size;
  const examCount = new Set(approved.map((entry) => entry.submission.exam_id)).size;
  const evidenceLevel = evidenceLevelOf(
    measuredQuestionCount,
    examCount,
    approved.length,
  );
  const averageScore = pointTotal > 0 ? round(weightedTotal / pointTotal) : null;

  return {
    outcomeId,
    averageScore,
    answerCount: approved.length,
    pendingCount: entries.filter((entry) => entry.pending).length,
    draftCount: entries.filter((entry) => entry.draft).length,
    excludedEvidenceCount: entries.filter((entry) => entry.excludedEvidence).length,
    measuredQuestionCount,
    examCount,
    evidenceLevel,
    isActionableWeak:
      averageScore !== null && averageScore < threshold && evidenceLevel !== "early",
    successfulCount: approved.filter((entry) => entry.successful).length,
    needsWorkCount: approved.filter((entry) => !entry.successful && !entry.blank).length,
    blankCount: approved.filter((entry) => entry.blank).length,
    latestEvidenceAt:
      approved
        .map((entry) => entry.submission.updated_at ?? entry.submission.created_at)
        .sort()
        .at(-1) ?? null,
  };
}

function groupDiagnostics(
  outcomeId: string,
  entries: readonly EvidenceEntry[],
  threshold: number,
  groupOf: (entry: EvidenceEntry) => string,
  labelOf: (groupId: string) => string,
): OutcomeGroupDiagnostic[] {
  const groups = new Map<string, EvidenceEntry[]>();
  for (const entry of entries) {
    const groupId = groupOf(entry);
    const bucket = groups.get(groupId) ?? [];
    bucket.push(entry);
    groups.set(groupId, bucket);
  }

  return [...groups.entries()]
    .map(([groupId, groupEntries]) => {
      const aggregate = aggregateEntries(outcomeId, groupEntries, threshold);
      return {
        groupId,
        label: labelOf(groupId),
        outcomeId,
        averageScore: aggregate.averageScore,
        answerCount: aggregate.answerCount,
        pendingCount: aggregate.pendingCount,
        draftCount: aggregate.draftCount,
        excludedEvidenceCount: aggregate.excludedEvidenceCount,
        measuredQuestionCount: aggregate.measuredQuestionCount,
        examCount: aggregate.examCount,
        evidenceLevel: aggregate.evidenceLevel,
        isActionableWeak: aggregate.isActionableWeak,
        successfulCount: aggregate.successfulCount,
        needsWorkCount: aggregate.needsWorkCount,
        blankCount: aggregate.blankCount,
        questions: buildQuestionDiagnostics(groupEntries, threshold),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

function buildQuestionDiagnostics(
  entries: readonly EvidenceEntry[],
  threshold: number,
): OutcomeQuestionDiagnostic[] {
  const grouped = new Map<string, EvidenceEntry[]>();
  for (const entry of entries) {
    const bucket = grouped.get(entry.question.id) ?? [];
    bucket.push(entry);
    grouped.set(entry.question.id, bucket);
  }

  return [...grouped.values()]
    .map((questionEntries) => {
      const question = questionEntries[0]!.question;
      const aggregate = aggregateEntries(
        question.outcome_id ?? "",
        questionEntries,
        threshold,
      );
      const wrongAnswerCounts = new Map<string, OutcomeWrongAnswerSummary>();
      for (const entry of questionEntries) {
        if (!entry.wrongAnswer) continue;
        const current = wrongAnswerCounts.get(entry.wrongAnswer.answer);
        wrongAnswerCounts.set(entry.wrongAnswer.answer, {
          ...entry.wrongAnswer,
          count: (current?.count ?? 0) + 1,
        });
      }

      return {
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        averageScore: aggregate.averageScore,
        answerCount: aggregate.answerCount,
        successfulCount: aggregate.successfulCount,
        needsWorkCount: aggregate.needsWorkCount,
        blankCount: aggregate.blankCount,
        pendingCount: aggregate.pendingCount,
        examCount: aggregate.examCount,
        wrongAnswers: [...wrongAnswerCounts.values()]
          .sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer, "tr"))
          .slice(0, 4),
      };
    })
    .sort(
      (a, b) =>
        b.needsWorkCount + b.blankCount - (a.needsWorkCount + a.blankCount) ||
        (a.averageScore ?? Number.POSITIVE_INFINITY) -
          (b.averageScore ?? Number.POSITIVE_INFINITY),
    );
}

function isSuccessfulAnswer(
  question: Question,
  answer: string,
  approvedScore: number,
  threshold: number,
): boolean {
  if (question.type === "test" && question.correct_answer) {
    return answer.trim().toLocaleUpperCase("tr-TR") === question.correct_answer.trim().toLocaleUpperCase("tr-TR");
  }
  return approvedScore >= threshold;
}

function wrongAnswerOf(
  question: Question,
  answer: string,
): OutcomeWrongAnswerSummary | null {
  if (question.type !== "test") return null;
  const normalized = answer.trim();
  const option = question.options_json?.find(
    (item) => item.key.toLocaleUpperCase("tr-TR") === normalized.toLocaleUpperCase("tr-TR"),
  );
  return {
    answer: normalized || "Yanıtsız",
    optionText: option?.text ?? null,
    count: 1,
  };
}

function compareDiagnostics(a: OutcomeDiagnostic, b: OutcomeDiagnostic): number {
  if (a.averageScore === null && b.averageScore === null) {
    return a.outcomeText.localeCompare(b.outcomeText, "tr");
  }
  if (a.averageScore === null) return 1;
  if (b.averageScore === null) return -1;
  return a.averageScore - b.averageScore || b.answerCount - a.answerCount;
}

function examQuestionKey(examId: string, questionId: string): string {
  return examId + KEY_SEPARATOR + questionId;
}

function examStudentKey(examId: string, studentId: string): string {
  return examId + KEY_SEPARATOR + studentId;
}

function positivePoints(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function clampThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_MASTERY_THRESHOLD;
  return Math.min(90, Math.max(40, value as number));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
