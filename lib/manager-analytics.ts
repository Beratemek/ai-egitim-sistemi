import type {
  Exam,
  ExamAssignment,
  ExamAttempt,
  ExamQuestion,
  LearningOutcome,
  Question,
  Submission,
  UserProfile,
} from "@/lib/types";
import {
  buildOutcomeDiagnostics,
  DEFAULT_MASTERY_THRESHOLD,
  type OutcomeDiagnostic,
} from "./outcome-diagnostics.ts";

export const MANAGER_RISK_SCORE = 60;
export const MANAGER_WEAK_OUTCOME_SCORE = DEFAULT_MASTERY_THRESHOLD;
const KEY_SEPARATOR = "\u0000";

export interface ManagerAnalyticsSource {
  users: UserProfile[];
  exams: Exam[];
  assignments: ExamAssignment[];
  attempts: ExamAttempt[];
  submissions: Submission[];
  questions: Question[];
  outcomes: LearningOutcome[];
  examQuestions: ExamQuestion[];
}

export interface ManagerOverview {
  classroomCount: number;
  studentCount: number;
  assignedCount: number;
  submittedCount: number;
  completedCount: number;
  completionRate: number;
  evaluationRate: number;
  averageScore: number | null;
  atRiskStudentCount: number;
  weakOutcomeCount: number;
  pendingReviewCount: number;
  draftAnswerCount: number;
  excludedOutcomeEvidenceCount: number;
}

export type ManagerRiskLevel = "risk" | "watch" | "good" | "unmeasured";

export interface ManagerStudentExamResult {
  attemptId: string;
  examId: string;
  title: string;
  subject: string;
  status: ExamAttempt["status"];
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  outcomeIds: string[];
}

export interface ManagerStudentSummary {
  studentId: string;
  name: string;
  email: string | null;
  classroom: string;
  assignedCount: number;
  submittedCount: number;
  completedCount: number;
  completionRate: number;
  averageScore: number | null;
  latestScore: number | null;
  scoreChange: number | null;
  overdueCount: number;
  weakOutcomeCount: number;
  riskLevel: ManagerRiskLevel;
  history: ManagerStudentExamResult[];
}

export interface ManagerClassroomSummary {
  name: string;
  studentCount: number;
  examCount: number;
  assignedCount: number;
  submittedCount: number;
  completedCount: number;
  completionRate: number;
  evaluationRate: number;
  averageScore: number | null;
  atRiskStudentCount: number;
  pendingReviewCount: number;
}

export interface ManagerExamSummary {
  examId: string;
  title: string;
  subject: string;
  isPublished: boolean;
  classrooms: string[];
  assignedCount: number;
  submittedCount: number;
  completedCount: number;
  completionRate: number;
  averageScore: number | null;
  pendingReviewCount: number;
  endsAt: string | null;
}

export type ManagerOutcomeSummary = OutcomeDiagnostic;

export interface ManagerTrendPoint {
  examId: string;
  label: string;
  fullLabel: string;
  subject: string;
  averageScore: number;
  completedCount: number;
  completedAt: string;
}

export interface ManagerAnalytics {
  overview: ManagerOverview;
  classrooms: ManagerClassroomSummary[];
  students: ManagerStudentSummary[];
  exams: ManagerExamSummary[];
  outcomes: ManagerOutcomeSummary[];
  trend: ManagerTrendPoint[];
  masteryThreshold: number;
  filterOptions: {
    subjects: string[];
    exams: Array<{ id: string; title: string; subject: string; date: string }>;
  };
}

export interface ManagerAnalyticsScope {
  classroom?: string;
  studentId?: string;
  subject?: string;
  examId?: string;
  dateFrom?: string;
  dateTo?: string;
  masteryThreshold?: number;
}

export function buildManagerAnalytics(
  source: ManagerAnalyticsSource,
  scope: ManagerAnalyticsScope = {},
  now = Date.now(),
): ManagerAnalytics {
  const masteryThreshold = normalizeThreshold(scope.masteryThreshold);
  const allStudents = source.users.filter((user) => user.roles.includes("ogrenci"));
  const students = allStudents.filter(
    (student) =>
      (!scope.classroom || student.classroom === scope.classroom) &&
      (!scope.studentId || student.id === scope.studentId),
  );
  const studentIds = new Set(students.map((student) => student.id));

  const selectedExams = source.exams.filter((exam) => {
    if (scope.examId && exam.id !== scope.examId) return false;
    if (scope.subject && exam.subject !== scope.subject) return false;
    return isExamInDateRange(exam, scope.dateFrom, scope.dateTo);
  });
  const selectedExamIds = new Set(selectedExams.map((exam) => exam.id));

  const assignments = source.assignments.filter(
    (row) => studentIds.has(row.student_id) && selectedExamIds.has(row.exam_id),
  );
  const attempts = source.attempts.filter(
    (row) => studentIds.has(row.student_id) && selectedExamIds.has(row.exam_id),
  );
  const submissions = source.submissions.filter(
    (row) => studentIds.has(row.student_id) && selectedExamIds.has(row.exam_id),
  );

  const examById = new Map(selectedExams.map((exam) => [exam.id, exam]));
  const userById = new Map(allStudents.map((student) => [student.id, student]));
  const outcomeByQuestion = new Map(
    source.questions
      .filter((question) => question.outcome_id)
      .map((question) => [question.id, question.outcome_id as string]),
  );
  const outcomeIdsByExam = new Map<string, Set<string>>();
  for (const link of source.examQuestions) {
    const outcomeId = outcomeByQuestion.get(link.question_id);
    if (!outcomeId) continue;
    const ids = outcomeIdsByExam.get(link.exam_id) ?? new Set<string>();
    ids.add(outcomeId);
    outcomeIdsByExam.set(link.exam_id, ids);
  }
  const attemptByStudentExam = new Map(
    attempts.map((attempt) => [
      attempt.student_id + KEY_SEPARATOR + attempt.exam_id,
      attempt,
    ]),
  );

  const examOutcomeIds = scope.examId
    ? new Set(
        source.examQuestions
          .filter((link) => link.exam_id === scope.examId)
          .map((link) => source.questions.find((question) => question.id === link.question_id)?.outcome_id)
          .filter((outcomeId): outcomeId is string => Boolean(outcomeId)),
      )
    : undefined;
  const outcomes = buildOutcomeDiagnostics(
    {
      outcomes: source.outcomes,
      questions: source.questions,
      examQuestions: source.examQuestions,
      submissions,
      attempts,
      exams: selectedExams,
      students,
    },
    {
      threshold: masteryThreshold,
      examIds: selectedExamIds,
      subject: scope.subject,
      outcomeIds: examOutcomeIds,
    },
  );

  const assignmentsByStudent = groupBy(assignments, (row) => row.student_id);
  const attemptsByStudent = groupBy(attempts, (row) => row.student_id);

  const studentSummaries: ManagerStudentSummary[] = students.map((student) => {
    const studentAssignments = assignmentsByStudent.get(student.id) ?? [];
    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const history: ManagerStudentExamResult[] = studentAttempts
      .map((attempt) => {
        const exam = examById.get(attempt.exam_id);
        return {
          attemptId: attempt.id,
          examId: attempt.exam_id,
          title: exam?.title ?? "Sınav",
          subject: exam?.subject ?? "Ders belirtilmemiş",
          status: attempt.status,
          score: attempt.status === "sonuclandi" ? attempt.final_score : null,
          startedAt: attempt.started_at,
          completedAt: attempt.completed_at,
          outcomeIds: [...(outcomeIdsByExam.get(attempt.exam_id) ?? [])],
        };
      })
      .sort(
        (a, b) =>
          new Date(a.completedAt ?? a.startedAt).getTime() -
          new Date(b.completedAt ?? b.startedAt).getTime(),
      );

    const completedHistory = history.filter(
      (item): item is ManagerStudentExamResult & { score: number } => item.score !== null,
    );
    const scores = completedHistory.map((item) => item.score);
    const latestResult = completedHistory.at(-1) ?? null;
    const latestScore = latestResult?.score ?? null;
    const previousComparableResult = latestResult
      ? completedHistory
          .slice(0, -1)
          .reverse()
          .find(
            (item) =>
              item.subject === latestResult.subject &&
              hasOutcomeOverlap(item.outcomeIds, latestResult.outcomeIds),
          ) ?? null
      : null;
    const previousScore = previousComparableResult?.score ?? null;
    const scoreChange =
      latestScore !== null && previousScore !== null
        ? round(latestScore - previousScore)
        : null;

    const overdueCount = studentAssignments.filter((assignment) => {
      const attempt = attemptByStudentExam.get(
        assignment.student_id + KEY_SEPARATOR + assignment.exam_id,
      );
      if (attempt && attempt.status !== "devam_ediyor") return false;
      const exam = examById.get(assignment.exam_id);
      const deadline = assignment.due_at ?? exam?.ends_at;
      return deadline ? new Date(deadline).getTime() < now : false;
    }).length;

    const weakOutcomeCount = outcomes.filter((outcome) =>
      outcome.students.some(
        (cell) => cell.groupId === student.id && cell.isActionableWeak,
      ),
    ).length;

    const submittedCount = studentAttempts.filter(
      (attempt) => attempt.status !== "devam_ediyor",
    ).length;
    const completedCount = studentAttempts.filter(
      (attempt) => attempt.status === "sonuclandi",
    ).length;
    const averageScore = average(scores);
    const completionRate = percentage(submittedCount, studentAssignments.length);

    let riskLevel: ManagerRiskLevel = "good";
    if (scores.length === 0 && studentAssignments.length === 0) riskLevel = "unmeasured";
    else if (
      overdueCount > 0 ||
      (averageScore !== null && averageScore < MANAGER_RISK_SCORE) ||
      (scoreChange !== null && scoreChange <= -10)
    ) {
      riskLevel = "risk";
    } else if (
      completionRate < 75 ||
      weakOutcomeCount > 0 ||
      (scoreChange !== null && scoreChange < 0)
    ) {
      riskLevel = "watch";
    }

    return {
      studentId: student.id,
      name: student.full_name || student.email || "İsimsiz öğrenci",
      email: student.email,
      classroom: student.classroom ?? "Sınıf atanmamış",
      assignedCount: studentAssignments.length,
      submittedCount,
      completedCount,
      completionRate,
      averageScore,
      latestScore,
      scoreChange,
      overdueCount,
      weakOutcomeCount,
      riskLevel,
      history,
    };
  });

  const submissionsByClassroom = groupBy(submissions, (row) => {
    return userById.get(row.student_id)?.classroom ?? "Sınıf atanmamış";
  });

  const classroomNames = [
    ...new Set(students.map((student) => student.classroom ?? "Sınıf atanmamış")),
  ];
  const classroomSummaries: ManagerClassroomSummary[] = classroomNames
    .map((name) => {
      const classroomStudents = studentSummaries.filter(
        (student) => student.classroom === name,
      );
      const classroomAssignments = assignments.filter(
        (row) => (userById.get(row.student_id)?.classroom ?? "Sınıf atanmamış") === name,
      );
      const classroomAttempts = attempts.filter(
        (row) => (userById.get(row.student_id)?.classroom ?? "Sınıf atanmamış") === name,
      );
      const scores = classroomAttempts
        .filter((row) => row.status === "sonuclandi" && row.final_score !== null)
        .map((row) => row.final_score as number);
      const submittedCount = classroomAttempts.filter(
        (row) => row.status !== "devam_ediyor",
      ).length;
      const completedCount = classroomAttempts.filter(
        (row) => row.status === "sonuclandi",
      ).length;

      return {
        name,
        studentCount: classroomStudents.length,
        examCount: new Set(classroomAssignments.map((row) => row.exam_id)).size,
        assignedCount: classroomAssignments.length,
        submittedCount,
        completedCount,
        completionRate: percentage(submittedCount, classroomAssignments.length),
        evaluationRate: percentage(completedCount, submittedCount),
        averageScore: average(scores),
        atRiskStudentCount: classroomStudents.filter(
          (student) => student.riskLevel === "risk",
        ).length,
        pendingReviewCount: (submissionsByClassroom.get(name) ?? []).filter(
          (row) => row.status === "ai_degerlendirildi",
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.atRiskStudentCount - a.atRiskStudentCount ||
        a.name.localeCompare(b.name, "tr"),
    );

  const assignmentsByExam = groupBy(assignments, (row) => row.exam_id);
  const attemptsByExam = groupBy(attempts, (row) => row.exam_id);
  const submissionsByExam = groupBy(submissions, (row) => row.exam_id);
  const examSummaries: ManagerExamSummary[] = selectedExams
    .map((exam) => {
      const examAssignments = assignmentsByExam.get(exam.id) ?? [];
      const examAttempts = attemptsByExam.get(exam.id) ?? [];
      const submittedCount = examAttempts.filter(
        (attempt) => attempt.status !== "devam_ediyor",
      ).length;
      const completed = examAttempts.filter(
        (attempt) => attempt.status === "sonuclandi" && attempt.final_score !== null,
      );
      return {
        examId: exam.id,
        title: exam.title,
        subject: exam.subject ?? "Ders belirtilmemiş",
        isPublished: exam.is_published,
        classrooms: [
          ...new Set(
            examAssignments.map(
              (row) => userById.get(row.student_id)?.classroom ?? "Sınıf atanmamış",
            ),
          ),
        ].sort((a, b) => a.localeCompare(b, "tr")),
        assignedCount: examAssignments.length,
        submittedCount,
        completedCount: completed.length,
        completionRate: percentage(submittedCount, examAssignments.length),
        averageScore: average(completed.map((attempt) => attempt.final_score as number)),
        pendingReviewCount: (submissionsByExam.get(exam.id) ?? []).filter(
          (row) => row.status === "ai_degerlendirildi",
        ).length,
        endsAt: exam.ends_at,
      };
    })
    .filter((exam) => exam.assignedCount > 0 || exam.completedCount > 0)
    .sort(
      (a, b) =>
        b.pendingReviewCount - a.pendingReviewCount ||
        b.assignedCount - a.assignedCount,
    );

  const trend: ManagerTrendPoint[] = examSummaries
    .filter((exam) => exam.averageScore !== null && exam.completedCount > 0)
    .map((summary) => {
      const relatedAttempts = attemptsByExam.get(summary.examId) ?? [];
      const completedAt = relatedAttempts
        .map((attempt) => attempt.completed_at)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? examById.get(summary.examId)?.created_at ?? "";
      return {
        examId: summary.examId,
        label:
          summary.title.length > 18
            ? `${summary.title.slice(0, 17)}…`
            : summary.title,
        fullLabel: summary.title,
        subject: summary.subject,
        averageScore: summary.averageScore as number,
        completedCount: summary.completedCount,
        completedAt,
      };
    })
    .sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    )
    .slice(-8);

  const submittedCount = attempts.filter(
    (attempt) => attempt.status !== "devam_ediyor",
  ).length;
  const completedAttempts = attempts.filter(
    (attempt) => attempt.status === "sonuclandi" && attempt.final_score !== null,
  );
  const pendingReviewCount = submissions.filter(
    (submission) => submission.status === "ai_degerlendirildi",
  ).length;

  return {
    overview: {
      classroomCount: classroomSummaries.length,
      studentCount: studentSummaries.length,
      assignedCount: assignments.length,
      submittedCount,
      completedCount: completedAttempts.length,
      completionRate: percentage(submittedCount, assignments.length),
      evaluationRate: percentage(completedAttempts.length, submittedCount),
      averageScore: average(
        completedAttempts.map((attempt) => attempt.final_score as number),
      ),
      atRiskStudentCount: studentSummaries.filter(
        (student) => student.riskLevel === "risk",
      ).length,
      weakOutcomeCount: outcomes.filter((outcome) => outcome.isActionableWeak).length,
      pendingReviewCount,
      draftAnswerCount: submissions.filter(
        (submission) => submission.status === "gonderildi",
      ).length,
      excludedOutcomeEvidenceCount: outcomes.reduce(
        (total, outcome) => total + outcome.excludedEvidenceCount,
        0,
      ),
    },
    classrooms: classroomSummaries,
    students: studentSummaries.sort(compareStudents),
    exams: examSummaries,
    outcomes,
    trend,
    masteryThreshold,
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
          date: examDate(exam),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    },
  };
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return map;
}

function compareStudents(a: ManagerStudentSummary, b: ManagerStudentSummary): number {
  const order: Record<ManagerRiskLevel, number> = {
    risk: 0,
    watch: 1,
    unmeasured: 2,
    good: 3,
  };
  return order[a.riskLevel] - order[b.riskLevel] || a.name.localeCompare(b.name, "tr");
}

function normalizeThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_MASTERY_THRESHOLD;
  return Math.min(90, Math.max(40, value as number));
}

function isExamInDateRange(
  exam: Exam,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): boolean {
  const reference = new Date(examDate(exam)).getTime();
  if (!Number.isFinite(reference)) return !dateFrom && !dateTo;

  const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : null;
  if (from !== null && Number.isFinite(from) && reference < from) return false;
  if (to !== null && Number.isFinite(to) && reference > to) return false;
  return true;
}

function examDate(exam: Exam): string {
  return exam.ends_at ?? exam.starts_at ?? exam.created_at;
}

function hasOutcomeOverlap(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const rightSet = new Set(right);
  return left.some((outcomeId) => rightSet.has(outcomeId));
}
