import { isSupabaseConfigured } from "@/lib/env";
import {
  buildInstructorQuestionAnalytics,
  type InstructorQuestionAnalytics,
  type QuestionAnalyticsScope,
  type QuestionAnalyticsSource,
} from "@/lib/question-analytics";
import {
  createServerSupabaseClient,
  getCurrentUser,
} from "@/lib/supabase-server";

const EMPTY_SOURCE: QuestionAnalyticsSource = {
  exams: [],
  examQuestions: [],
  attempts: [],
  submissions: [],
  questions: [],
  outcomes: [],
  students: [],
};

export async function getInstructorQuestionAnalytics(
  scope: QuestionAnalyticsScope = {},
): Promise<InstructorQuestionAnalytics> {
  if (!isSupabaseConfigured) {
    return buildInstructorQuestionAnalytics(EMPTY_SOURCE, scope);
  }

  const current = await getCurrentUser();
  if (!current || !current.profile.roles.includes("egitmen")) {
    return buildInstructorQuestionAnalytics(EMPTY_SOURCE, scope);
  }

  const supabase = await createServerSupabaseClient();
  const examResult = await supabase
    .from("exams")
    .select("*")
    .eq("instructor_id", current.user.id)
    .order("created_at", { ascending: false });
  assertQuerySucceeded(examResult.error);
  const exams = examResult.data ?? [];
  const examIds = exams.map((exam) => exam.id);
  if (examIds.length === 0) {
    return buildInstructorQuestionAnalytics({ ...EMPTY_SOURCE, exams }, scope);
  }

  const [linksResult, attemptsResult, submissionsResult] = await Promise.all([
    supabase.from("exam_questions").select("*").in("exam_id", examIds),
    supabase.from("exam_attempts").select("*").in("exam_id", examIds),
    supabase.from("submissions").select("*").in("exam_id", examIds),
  ]);
  assertQuerySucceeded(linksResult.error);
  assertQuerySucceeded(attemptsResult.error);
  assertQuerySucceeded(submissionsResult.error);
  const links = linksResult.data ?? [];
  const questionIds = [...new Set(links.map((link) => link.question_id))];
  const studentIds = [
    ...new Set((attemptsResult.data ?? []).map((attempt) => attempt.student_id)),
  ];

  const [questionsResult, studentsResult] = await Promise.all([
    questionIds.length > 0
      ? supabase.from("questions").select("*").in("id", questionIds)
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase.from("users").select("*").in("id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);
  assertQuerySucceeded("error" in questionsResult ? questionsResult.error : null);
  assertQuerySucceeded("error" in studentsResult ? studentsResult.error : null);
  const questions = questionsResult.data ?? [];
  const outcomeIds = [
    ...new Set(
      questions
        .map((question) => question.outcome_id)
        .filter((outcomeId): outcomeId is string => Boolean(outcomeId)),
    ),
  ];
  const outcomesResult = outcomeIds.length > 0
    ? await supabase.from("learning_outcomes").select("*").in("id", outcomeIds)
    : { data: [] };
  assertQuerySucceeded("error" in outcomesResult ? outcomesResult.error : null);

  return buildInstructorQuestionAnalytics(
    {
      exams,
      examQuestions: links,
      attempts: attemptsResult.data ?? [],
      submissions: submissionsResult.data ?? [],
      questions,
      outcomes: outcomesResult.data ?? [],
      students: studentsResult.data ?? [],
    },
    scope,
  );
}

function assertQuerySucceeded(error: { message?: string } | null | undefined): void {
  if (!error) return;
  console.error("[instructor-question-analytics] Veri sorgusu başarısız:", error.message);
  throw new Error("Soru analizi verileri yüklenemedi. Lütfen yeniden deneyin.");
}
