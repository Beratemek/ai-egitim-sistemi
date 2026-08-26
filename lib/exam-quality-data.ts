import {
  evaluateExamQuality,
  type ExamQualityReport,
} from "@/lib/exam-quality";
import type { TypedServerClient } from "@/lib/supabase-server";
import type {
  Exam,
  ExamQuestion,
  LearningOutcome,
  Question,
} from "@/lib/types";

export interface ExamQualityBundle {
  exam: Exam;
  examQuestions: ExamQuestion[];
  questions: Question[];
  outcomes: LearningOutcome[];
  assignmentCount: number;
  report: ExamQualityReport;
}

/**
 * Yayın eylemi ile AI incelemesinin aynı sınav anlık görüntüsünü kullanmasını
 * sağlar. Yetki bu fonksiyonda genişletilmez; çağıranın Supabase istemcisinin
 * RLS kapsamı aynen geçerlidir.
 */
export async function loadExamQualityBundle(
  supabase: TypedServerClient,
  examId: string,
): Promise<ExamQualityBundle | null> {
  const examResult = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();
  if (examResult.error) {
    throw new Error(`Sınav kalite verisi yüklenemedi: ${examResult.error.message}`);
  }
  if (!examResult.data) return null;

  const [linksResult, assignmentsResult] = await Promise.all([
    supabase
      .from("exam_questions")
      .select("*")
      .eq("exam_id", examId)
      .order("position", { ascending: true }),
    supabase
      .from("exam_assignments")
      .select("student_id", { count: "exact", head: true })
      .eq("exam_id", examId),
  ]);
  if (linksResult.error || assignmentsResult.error) {
    throw new Error(
      `Sınav kalite verisi yüklenemedi: ${
        linksResult.error?.message ?? assignmentsResult.error?.message ?? "Bilinmeyen hata"
      }`,
    );
  }

  const examQuestions = linksResult.data ?? [];
  const questionIds = [...new Set(examQuestions.map((item) => item.question_id))];
  const questionsResult = questionIds.length
    ? await supabase.from("questions").select("*").in("id", questionIds)
    : { data: [], error: null };
  if (questionsResult.error) {
    throw new Error(`Sınav soruları yüklenemedi: ${questionsResult.error.message}`);
  }
  const questions = questionsResult.data ?? [];

  const outcomeIds = [
    ...new Set(
      questions
        .map((question) => question.outcome_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const outcomesResult = outcomeIds.length
    ? await supabase.from("learning_outcomes").select("*").in("id", outcomeIds)
    : { data: [], error: null };
  if (outcomesResult.error) {
    throw new Error(`Kazanım verileri yüklenemedi: ${outcomesResult.error.message}`);
  }

  const assignmentCount = assignmentsResult.count ?? 0;
  const report = evaluateExamQuality({
    exam: examResult.data,
    examQuestions,
    questions,
    assignmentCount,
  });

  return {
    exam: examResult.data,
    examQuestions,
    questions,
    outcomes: outcomesResult.data ?? [],
    assignmentCount,
    report,
  };
}
