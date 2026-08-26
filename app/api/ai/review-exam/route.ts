import {
  describeAiError,
  reviewExamQuality,
  type ExamAiReviewResult,
} from "@/lib/ai";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { loadExamQualityBundle } from "@/lib/exam-quality-data";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReviewExamRequest {
  examId?: unknown;
}

/** AI incelemesi yalnız sınav taslağını görür; öğrenci/cevap verisi yüklenmez. */
export async function POST(request: Request) {
  const guard = await requireRole(["egitmen"]);
  if (!guard.ok) return guard.response;
  if (!guard.user) return jsonError("Bu özellik tanıtım modunda kullanılamaz.", 503);

  try {
    const body = await readJson<ReviewExamRequest>(request);
    const examId = typeof body.examId === "string" ? body.examId.trim() : "";
    if (!examId) return jsonError("İncelenecek sınav seçilmedi.");

    const supabase = await createServerSupabaseClient();
    const bundle = await loadExamQualityBundle(supabase, examId);
    if (!bundle) return jsonError("Sınav bulunamadı.", 404);

    const isAdmin =
      guard.user.actualRole === "admin" || guard.user.profile.roles.includes("admin");
    if (bundle.exam.instructor_id !== guard.user.user.id && !isAdmin) {
      return jsonError("Yalnızca kendi sınav taslağınızı inceleyebilirsiniz.", 403);
    }
    if (bundle.questions.length === 0) {
      return jsonError("AI incelemesi için önce sınava soru ekleyin.", 409);
    }

    const linkByQuestion = new Map(
      bundle.examQuestions.map((link) => [link.question_id, link]),
    );
    const outcomeById = new Map(
      bundle.outcomes.map((outcome) => [outcome.id, outcome.outcome_text]),
    );
    const review = await reviewExamQuality({
      title: bundle.exam.title,
      description: bundle.exam.description,
      subject: bundle.exam.subject ?? "",
      durationMinutes: bundle.exam.duration_minutes,
      questions: bundle.questions
        .map((question) => {
          const link = linkByQuestion.get(question.id);
          if (!link) return null;
          return {
            position: link.position + 1,
            points: link.points,
            text: question.text,
            type: question.type,
            options:
              question.options_json?.map((option) => ({
                key: option.key,
                text: option.text,
              })) ?? null,
            correctAnswer: question.correct_answer,
            rubric: question.rubric,
            difficulty: question.difficulty ?? null,
            outcomeText: question.outcome_id
              ? outcomeById.get(question.outcome_id) ?? null
              : null,
            subject: question.subject,
            topic: question.topic,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    });

    return jsonOk<ExamAiReviewResult>(review);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}
