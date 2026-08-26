import { coachMistake, describeAiError } from "@/lib/ai";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { STUDENT_MISTAKE_MASTERY_THRESHOLD } from "@/lib/student-mistakes";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase-server";
import type { MistakeCoachResult } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface MistakeCoachRequest {
  examId?: unknown;
  questionId?: unknown;
}

/**
 * Tamamlanmış sınavdaki düşük puanlı bir cevap için kişisel mini çalışma.
 * İstemci yalnız kimlikleri yollar; soru/cevap sahipliği ve sonuç durumu
 * sunucuda yeniden doğrulanır. Doğru cevap ile rubrik bu akışa hiç alınmaz.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["ogrenci"]);
  if (!guard.ok) return guard.response;
  if (!guard.user) return jsonError("Bu özellik tanıtım modunda kullanılamaz.", 503);

  try {
    const body = await readJson<MistakeCoachRequest>(request);
    const examId = typeof body.examId === "string" ? body.examId.trim() : "";
    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";
    if (!examId || !questionId) {
      return jsonError("Sınav ve soru seçimi zorunludur.");
    }

    const supabase = await createServerSupabaseClient();
    const studentId = guard.user.user.id;
    const attemptResult = await supabase
      .from("exam_attempts")
      .select("id, status")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .eq("status", "sonuclandi")
      .maybeSingle();
    if (attemptResult.error) {
      return jsonError("Sonuç doğrulanamadı. Lütfen yeniden deneyin.", 500);
    }
    if (!attemptResult.data) {
      return jsonError("Yalnızca açıklanmış kendi sonuçlarınız için çalışma oluşturabilirsiniz.", 403);
    }

    const [questionsResult, submissionsResult, examResult] = await Promise.all([
      supabase.rpc("get_student_exam_questions", { target_exam: examId }),
      supabase.rpc("get_my_submissions", { target_exam: examId }),
      supabase
        .from("exams")
        .select("id, subject")
        .eq("id", examId)
        .maybeSingle(),
    ]);
    if (questionsResult.error || submissionsResult.error || examResult.error) {
      return jsonError("Soru ve geri bildirim verileri yüklenemedi.", 500);
    }

    const question = (questionsResult.data ?? []).find(
      (item) => item.id === questionId,
    );
    if (!question) return jsonError("Bu sınavda erişilebilir soru bulunamadı.", 404);

    const submission = (submissionsResult.data ?? []).find(
      (item) => item.question_id === questionId && item.student_id === studentId,
    );
    if (submission && submission.status !== "egitmen_onayli") {
      return jsonError("Bu cevap henüz nihai olarak değerlendirilmedi.", 409);
    }
    const approvedScore = submission?.instructor_approved_score ?? 0;
    if (approvedScore >= STUDENT_MISTAKE_MASTERY_THRESHOLD) {
      return jsonError(
        "Yeterli öğrenme düzeyine ulaşılmış soru için yanlış çalışması oluşturulmaz.",
        409,
      );
    }

    // `learning_outcomes` ham kaynak metni de taşıdığı için öğrenci RLS'ine
    // kapalıdır. Yalnız güvenli soru RPC'sinin döndürdüğü kimliğe ait gösterim
    // metnini, seçili iki alanla ve sunucuda sınırlı biçimde okuruz.
    const outcomeResult =
      question.outcome_id && serverEnv.supabaseServiceRoleKey
        ? await createAdminSupabaseClient()
            .from("learning_outcomes")
            .select("outcome_text")
            .eq("id", question.outcome_id)
            .maybeSingle()
        : { data: null, error: null };
    if (outcomeResult.error) {
      return jsonError("Kazanım bilgisi yüklenemedi.", 500);
    }

    const result = await coachMistake({
      subject: question.subject || examResult.data?.subject || "Ders belirtilmedi",
      topic: question.topic || "Konu belirtilmedi",
      outcomeText: outcomeResult.data?.outcome_text ?? null,
      questionText: question.text,
      questionType: question.type,
      studentAnswer: submission?.answer_text ?? "",
      approvedScore,
      instructorNote: submission?.instructor_note ?? null,
    });

    return jsonOk<MistakeCoachResult>(result);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}
