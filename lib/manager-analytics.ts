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

export const MANAGER_RISK_SCORE = 60;
export const MANAGER_WEAK_OUTCOME_SCORE = 50;
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

export interface ManagerOutcomeSummary {
  outcomeId: string;
  outcomeText: string;
  subject: string;
  topic: string;
  averageScore: number | null;
  answerCount: number;
  pendingCount: number;
  studentCount: number;
  classroomCount: number;
  questionCount: number;
}

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
}

export interface ManagerAnalyticsScope {
  classroom?: string;
  studentId?: string;
}

export function buildManagerAnalytics(
  source: ManagerAnalyticsSource,
  scope: ManagerAnalyticsScope = {},
  now = Date.now(),
): ManagerAnalytics {
  const allStudents = source.users.filter((user) => user.roles.includes("ogrenci"));
  const students = allStudents.filter(
    (student) =>
      (!scope.classroom || student.classroom === scope.classroom) &&
      (!scope.studentId || student.id === scope.studentId),
  );
  const studentIds = new Set(students.map((student) => student.id));

  const assignments = source.assignments.filter((row) => studentIds.has(row.student_id));
  const attempts = source.attempts.filter((row) => studentIds.has(row.student_id));
  const submissions = source.submissions.filter((row) => studentIds.has(row.student_id));

  const examById = new Map(source.exams.map((exam) => [exam.id, exam]));
  const userById = new Map(allStudents.map((student) => [student.id, student]));
  const attemptByStudentExam = new Map(
    attempts.map((attempt) => [
      attempt.student_id + KEY_SEPARATOR + attempt.exam_id,
      attempt,
    ]),
  );

  const questionCounts = new Map<string, number>();
  const outcomeByQuestion = new Map<string, string>();
  for (const question of source.questions) {
    if (!question.outcome_id) continue;
    outcomeByQuestion.set(question.id, question.outcome_id);
    questionCounts.set(
      question.outcome_id,
      (questionCounts.get(question.outcome_id) ?? 0) + 1,
    );
  }

  type OutcomeBucket = {
    scores: number[];
    pending: number;
    students: Set<string>;
    classrooms: Set<string>;
  };
  const outcomeBuckets = new Map<string, OutcomeBucket>();
  const studentOutcomeScores = new Map<string, Map<string, number[]>>();

  for (const submission of submissions) {
    if (!submission.question_id) continue;
    const outcomeId = outcomeByQuestion.get(submission.question_id);
    if (!outcomeId) continue;

    let bucket = outcomeBuckets.get(outcomeId);
    if (!bucket) {
      bucket = {
        scores: [],
        pending: 0,
        students: new Set(),
        classrooms: new Set(),
      };
      outcomeBuckets.set(outcomeId, bucket);
    }

    bucket.students.add(submission.student_id);
    const classroom = userById.get(submission.student_id)?.classroom;
    if (classroom) bucket.classrooms.add(classroom);

    if (
      submission.status === "egitmen_onayli" &&
      submission.instructor_approved_score !== null
    ) {
      bucket.scores.push(submission.instructor_approved_score);
      let byOutcome = studentOutcomeScores.get(submission.student_id);
      if (!byOutcome) {
        byOutcome = new Map();
        studentOutcomeScores.set(submission.student_id, byOutcome);
      }
      const scores = byOutcome.get(outcomeId) ?? [];
      scores.push(submission.instructor_approved_score);
      byOutcome.set(outcomeId, scores);
    } else {
      bucket.pending += 1;
    }
  }

  const outcomes: ManagerOutcomeSummary[] = source.outcomes
    .map((outcome) => {
      const bucket = outcomeBuckets.get(outcome.id);
      return {
        outcomeId: outcome.id,
        outcomeText: outcome.outcome_text,
        subject: outcome.subject ?? "Ders belirtilmemiş",
        topic: outcome.topic,
        averageScore: average(bucket?.scores ?? []),
        answerCount: bucket?.scores.length ?? 0,
        pendingCount: bucket?.pending ?? 0,
        studentCount: bucket?.students.size ?? 0,
        classroomCount: bucket?.classrooms.size ?? 0,
        questionCount: questionCounts.get(outcome.id) ?? 0,
      };
    })
    .sort(compareOutcomes);

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
        };
      })
      .sort(
        (a, b) =>
          new Date(a.completedAt ?? a.startedAt).getTime() -
          new Date(b.completedAt ?? b.startedAt).getTime(),
      );

    const scores = history
      .map((item) => item.score)
      .filter((score): score is number => score !== null);
    const latestScore = scores.at(-1) ?? null;
    const previousScore = scores.at(-2) ?? null;
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

    const weakOutcomeCount = [...(studentOutcomeScores.get(student.id)?.values() ?? [])]
      .map((values) => average(values))
      .filter((score) => score !== null && score < MANAGER_WEAK_OUTCOME_SCORE).length;

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
  const examSummaries: ManagerExamSummary[] = source.exams
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
      weakOutcomeCount: outcomes.filter(
        (outcome) =>
          outcome.averageScore !== null &&
          outcome.averageScore < MANAGER_WEAK_OUTCOME_SCORE,
      ).length,
      pendingReviewCount,
    },
    classrooms: classroomSummaries,
    students: studentSummaries.sort(compareStudents),
    exams: examSummaries,
    outcomes,
    trend,
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

function compareOutcomes(a: ManagerOutcomeSummary, b: ManagerOutcomeSummary): number {
  if (a.averageScore === null && b.averageScore === null) {
    return a.outcomeText.localeCompare(b.outcomeText, "tr");
  }
  if (a.averageScore === null) return 1;
  if (b.averageScore === null) return -1;
  return a.averageScore - b.averageScore || b.answerCount - a.answerCount;
}
