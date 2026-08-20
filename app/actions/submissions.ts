"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { autoGrade } from "@/lib/grading";
import { MOCK_QUESTIONS } from "@/lib/mock-data";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";
import type { GradingResult } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Ogrenci: cevap gonderme                                                  */
/* -------------------------------------------------------------------------- */

export interface SubmitAnswerInput {
  examId: string;
  questionId: string;
  /** Coktan secmelide sik anahtari ("B"), acik ucluda serbest metin. */
  answerText: string;
}

export interface SubmitAnswerResult {
  /** Cevap veritabanina yazildi mi? Demo modunda false doner. */
  persisted: boolean;
  score: number | null;
  feedback: string | null;
  criteria: GradingResult["criteria"];
}

/**
 * Ogrenci cevabini kaydeder ve on degerlendirmesini dondurur.
 *
 * GUVENLIK: rubrik ve dogru cevap ISTEMCIDEN ALINMAZ, veritabanindan okunur;
 * aksi halde ogrenci kendi rubrigini gonderip puanini yukseltebilirdi.
 *
 * Demo modunda (Supabase yok) puanlama yine calisir ama kayit yapilmaz;
 * boylece anahtarsiz kurulumda da akis gosterilebilir.
 */
export async function submitAnswer(
  input: SubmitAnswerInput,
): Promise<ActionResult<SubmitAnswerResult>> {
  const answerText = input.answerText.trim();
  if (!answerText) return { ok: false, error: "Bos cevap gonderilemez." };

  if (!isSupabaseConfigured) {
    const question = MOCK_QUESTIONS.find((item) => item.id === input.questionId);
    if (!question) return { ok: false, error: "Soru bulunamadi." };

    const grade = await autoGrade(question, answerText);
    return {
      ok: true,
      data: { persisted: false, ...gradeToResult(grade) },
    };
  }

  if (!input.examId || !input.questionId) {
    return { ok: false, error: "examId ve questionId zorunludur." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  /**
   * Sinav gercekten girilebilir mi?
   *
   * `exams_select` RLS politikasi ogrenciye yalnizca YAYINDAKI sinavlari
   * gosterdigi icin bu okuma ayni zamanda yetki kontrolu islevi gorur:
   * yayinlanmamis bir sinavin id'si tahmin edilse bile satir donmez.
   */
  const { data: exam } = await supabase
    .from("exams")
    .select("is_published, starts_at, ends_at")
    .eq("id", input.examId)
    .maybeSingle();

  if (!exam || !exam.is_published) {
    return { ok: false, error: "Bu sinav su an cevaplamaya acik degil." };
  }

  const now = Date.now();
  if (exam.starts_at && now < new Date(exam.starts_at).getTime()) {
    return { ok: false, error: "Sinav henuz baslamadi." };
  }
  if (exam.ends_at && now > new Date(exam.ends_at).getTime()) {
    return { ok: false, error: "Sinav suresi doldu." };
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("text, type, rubric, correct_answer")
    .eq("id", input.questionId)
    .single();

  if (questionError || !question) {
    return { ok: false, error: "Soru bulunamadi." };
  }

  const grade = await autoGrade(question, answerText);

  const { error } = await supabase.from("submissions").insert({
    exam_id: input.examId,
    question_id: input.questionId,
    student_id: current.user.id,
    answer_text: answerText,
    ai_score: grade.score,
    ai_feedback: grade.feedback,
    status: grade.status,
  });

  if (error) {
    // Tekrar gonderim kisiti (submissions_one_per_question_uniq) okunabilir mesaja cevrilir.
    if (error.code === "23505") {
      return { ok: false, error: "Bu soruyu daha once yanitladiniz." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/ogrenci");
  revalidatePath(`/dashboard/ogrenci/sinav/${input.examId}`);
  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/yonetici");

  return { ok: true, data: { persisted: true, ...gradeToResult(grade) } };
}

function gradeToResult(grade: Awaited<ReturnType<typeof autoGrade>>) {
  return {
    score: grade.score,
    feedback: grade.feedback,
    criteria: grade.criteria,
  };
}

/* -------------------------------------------------------------------------- */
/*  Egitmen: nihai puan onayi                                                */
/* -------------------------------------------------------------------------- */

export interface ApproveSubmissionInput {
  submissionId: string;
  /** Egitmenin belirledigi nihai puan (0-100). AI puanini kabul veya duzeltme. */
  score: number;
  note?: string;
}

/**
 * AI'in on puanini egitmen onayindan gecirir.
 * Bu adim tamamlanmadan puan NIHAI degildir - urunun temel iddiasi budur.
 */
export async function approveSubmission(
  input: ApproveSubmissionInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();

  if (!input.submissionId) return { ok: false, error: "Cevap id'si zorunludur." };

  if (!Number.isFinite(input.score) || input.score < 0 || input.score > 100) {
    return { ok: false, error: "Puan 0 ile 100 arasinda olmalidir." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("submissions")
    .update({
      instructor_approved_score: Math.round(input.score * 100) / 100,
      instructor_note: input.note?.trim() || null,
      status: "egitmen_onayli",
      reviewed_by: current.user.id,
    })
    .eq("id", input.submissionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/ogrenci");
  revalidatePath("/dashboard/yonetici");

  return { ok: true, data: undefined };
}
