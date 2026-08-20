import { errorMessage, jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import { autoGrade } from "@/lib/grading";
import { MOCK_SUBMISSIONS } from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Submission } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/submissions?examId=...
 * Egitmen/yonetici tum cevaplari, ogrenci yalnizca kendi cevaplarini gorur
 * (RLS tarafindan zorlanir).
 */
export async function GET(request: Request) {
  const guard = await requireRole(["ogrenci", "egitmen", "egitim_yoneticisi"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonOk<Submission[]>([...MOCK_SUBMISSIONS]);
  }

  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId");

    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (examId) query = query.eq("exam_id", examId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return jsonOk<Submission[]>(data ?? []);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}

interface CreateSubmissionBody {
  examId: string;
  questionId: string;
  /** Coktan secmelide sik anahtari ("B"), acik ucluda serbest metin. */
  answerText: string;
}

/**
 * POST /api/submissions
 *
 * Ogrenci cevabini kaydeder ve AI on degerlendirmesini calistirir.
 * Sonuc `ai_degerlendirildi` durumunda egitmen onayina duser.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["ogrenci"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonError("Supabase yapilandirilmadigi icin kayit yapilamiyor.", 503);
  }

  try {
    const body = await readJson<CreateSubmissionBody>(request);

    if (!body.examId || !body.questionId) {
      return jsonError("examId ve questionId zorunludur.");
    }

    if (typeof body.answerText !== "string" || body.answerText.trim().length === 0) {
      return jsonError("Bos cevap gonderilemez.");
    }

    const studentId = guard.user?.user.id;
    if (!studentId) return jsonError("Oturum acmaniz gerekiyor.", 401);

    const supabase = await createServerSupabaseClient();

    // Rubrik ve dogru cevap SORUDAN okunur - istemciden gelene guvenilmez.
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("text, type, rubric, correct_answer")
      .eq("id", body.questionId)
      .single();

    if (questionError || !question) {
      return jsonError("Soru bulunamadi.", 404);
    }

    const grade = await autoGrade(question, body.answerText);

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        exam_id: body.examId,
        question_id: body.questionId,
        student_id: studentId,
        answer_text: body.answerText,
        ai_score: grade.score,
        ai_feedback: grade.feedback,
        status: grade.status,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return jsonOk<Submission>(data, 201);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}

interface ApproveSubmissionBody {
  id: string;
  /** Egitmenin belirledigi nihai puan (0-100). */
  score: number;
  note?: string;
}

/**
 * PATCH /api/submissions
 * Egitmenin AI puanini onaylamasi veya duzeltmesi.
 */
export async function PATCH(request: Request) {
  const guard = await requireRole(["egitmen"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonError("Supabase yapilandirilmadigi icin guncelleme yapilamiyor.", 503);
  }

  try {
    const body = await readJson<ApproveSubmissionBody>(request);

    if (!body.id) return jsonError("Cevap id'si zorunludur.");

    if (typeof body.score !== "number" || body.score < 0 || body.score > 100) {
      return jsonError("Puan 0 ile 100 arasinda olmalidir.");
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("submissions")
      .update({
        instructor_approved_score: body.score,
        instructor_note: body.note ?? null,
        status: "egitmen_onayli",
        reviewed_by: guard.user?.user.id ?? null,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return jsonOk<Submission>(data);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}
