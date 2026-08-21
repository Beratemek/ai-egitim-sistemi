"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { autoGrade } from "@/lib/grading";
import { MOCK_QUESTIONS } from "@/lib/mock-data";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
  getCurrentUser,
  type TypedServerClient,
} from "@/lib/supabase-server";
import type { GradingResult, Submission } from "@/lib/types";

async function getOwnExamSubmissions(
  supabase: TypedServerClient,
  examId: string,
): Promise<Submission[]> {
  const rpcResult = await supabase.rpc("get_my_submissions", {
    target_exam: examId,
  });
  if (!rpcResult.error) return rpcResult.data ?? [];

  const rpcIsUnavailable =
    ["PGRST202", "42883"].includes(rpcResult.error.code ?? "") ||
    /get_my_submissions.*(not find|does not exist|schema cache)/i.test(
      rpcResult.error.message ?? "",
    );
  if (!rpcIsUnavailable) return [];

  const legacyResult = await supabase
    .from("submissions")
    .select("*")
    .eq("exam_id", examId)
    .order("created_at", { ascending: false });
  return legacyResult.data ?? [];
}

/* -------------------------------------------------------------------------- */
/*  Ogrenci: cevap kaydetme ve sinavi bitirme                                */
/* -------------------------------------------------------------------------- */

export interface SubmitAnswerInput {
  examId: string;
  questionId: string;
  /** Coktan secmelide secenek anahtari ("B"), acik ucluda serbest metin. */
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
 * Ogrenci cevabini TASLAK olarak kaydeder. AI degerlendirmesi bu adimda
 * calismaz; ogrenci sinavi bitirene kadar cevabini degistirebilir.
 *
 * `gonderildi` durumu mevcut semada henuz AI'a gonderilmemis, duzenlenebilir
 * cevabi temsil eder. `finalizeExam` sonrasinda `ai_degerlendirildi` olur.
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

  const { data: assignment, error: assignmentError } = await supabase
    .from("exam_assignments")
    .select("due_at")
    .eq("exam_id", input.examId)
    .eq("student_id", current.user.id)
    .maybeSingle();
  const effectiveEndsAt = assignmentError
    ? exam.ends_at
    : assignment?.due_at ?? exam.ends_at;

  const now = Date.now();
  if (exam.starts_at && now < new Date(exam.starts_at).getTime()) {
    return { ok: false, error: "Sinav henuz baslamadi." };
  }
  if (effectiveEndsAt && now >= new Date(effectiveEndsAt).getTime()) {
    return { ok: false, error: "Sinav suresi doldu." };
  }

  // Istemciden gelen questionId'nin bu sinava ait oldugunu dogrula. Yalnizca
  // sorunun varligini kontrol etmek, baska bir sinavdaki soruya cevap kaydi
  // yazilabilmesine izin verirdi.
  const { data: examQuestion } = await supabase
    .from("exam_questions")
    .select("question_id")
    .eq("exam_id", input.examId)
    .eq("question_id", input.questionId)
    .maybeSingle();

  if (!examQuestion) {
    return { ok: false, error: "Bu soru sinava ait degil." };
  }

  const { error: attemptError } = await supabase.rpc("start_exam_attempt", {
    target_exam: input.examId,
  });
  if (attemptError && !isStudentFlowUnavailable(attemptError)) {
    return { ok: false, error: attemptError.message };
  }

  const safeQuestionResult = await supabase.rpc("get_student_exam_questions", {
    target_exam: input.examId,
  });
  const question = safeQuestionResult.data?.find(
    (item) => item.id === input.questionId,
  );

  if (safeQuestionResult.error || !question) {
    return { ok: false, error: "Soru bulunamadi." };
  }

  if (question.type === "acik_uclu" && answerText.length < 10) {
    return {
      ok: false,
      error: "Acik uclu cevap en az 10 karakter olmalidir.",
    };
  }

  if (
    question.type === "test" &&
    !(question.options_json ?? []).some((option) => option.key === answerText)
  ) {
    return { ok: false, error: "Gecerli bir secenek secin." };
  }

  const existing = (await getOwnExamSubmissions(supabase, input.examId)).find(
    (submission) => submission.question_id === input.questionId,
  );

  if (existing && existing.status !== "gonderildi") {
    return {
      ok: false,
      error: "Sinav teslim edildigi icin bu cevap artik degistirilemez.",
    };
  }

  const { error } = existing
    ? await supabase
        .from("submissions")
        .update({ answer_text: answerText })
        .eq("id", existing.id)
        .eq("student_id", current.user.id)
        .eq("status", "gonderildi")
    : await supabase.from("submissions").insert({
        exam_id: input.examId,
        question_id: input.questionId,
        student_id: current.user.id,
        answer_text: answerText,
        ai_score: null,
        ai_feedback: null,
        ai_criteria_json: [],
        status: "gonderildi",
      });

  if (error) {
    // Tekrar gonderim kisiti (submissions_one_per_question_uniq) okunabilir mesaja cevrilir.
    if (error.code === "23505") {
      return { ok: false, error: "Bu cevap baska bir oturumda kaydedildi." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/ogrenci");
  revalidatePath(`/dashboard/ogrenci/sinav/${input.examId}`);
  return {
    ok: true,
    data: { persisted: true, score: null, feedback: null, criteria: [] },
  };
}

export interface StartExamResult {
  attemptId: string | null;
}

/** Atanmis sinav icin geri donulemez ogrenci oturumunu baslatir. */
export async function startExam(
  examId: string,
): Promise<ActionResult<StartExamResult>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId) return { ok: false, error: "Sinav id'si zorunludur." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("start_exam_attempt", {
    target_exam: examId,
  });

  if (error) {
    return {
      ok: false,
      error: isStudentFlowUnavailable(error)
        ? "Sinav oturumu altyapisi ortak veritabaninda henuz etkin degil."
        : error.message,
    };
  }

  revalidatePath("/dashboard/ogrenci");
  revalidatePath(`/dashboard/ogrenci/sinav/${examId}`);
  return { ok: true, data: { attemptId: data ?? null } };
}

function gradeToResult(grade: Awaited<ReturnType<typeof autoGrade>>) {
  return {
    score: grade.score,
    feedback: grade.feedback,
    criteria: grade.criteria,
  };
}

export interface FinalizeExamResult {
  evaluatedCount: number;
}

export interface FinalizeExamOptions {
  reason?: "student_submit" | "time_expired";
}

/**
 * Tum cevaplari kaydedilmis sinavi AI on degerlendirmesine gonderir.
 *
 * Cevaplar bu islemden ONCE veritabaninda oldugu icin AI servisi hata verse
 * bile ogrencinin emegi kaybolmaz; taslaklar duzenlenebilir halde kalir.
 */
export async function finalizeExam(
  examId: string,
  options: FinalizeExamOptions = {},
): Promise<ActionResult<FinalizeExamResult>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId) return { ok: false, error: "Sinav id'si zorunludur." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();
  // Guvenlik migration'i sonrasi ogrenci AI puani/status yazamaz. Gizli soru
  // alanlarini okuma ve puanlama yazmalari yalnizca sunucudaki service role ile
  // yapilir. Migration uygulanana kadar eski kurulumlarla geriye uyumludur.
  const gradingClient = serverEnv.supabaseServiceRoleKey
    ? createAdminSupabaseClient()
    : supabase;
  const { data: exam } = await supabase
    .from("exams")
    .select("is_published, starts_at, ends_at")
    .eq("id", examId)
    .maybeSingle();

  if (!exam || !exam.is_published) {
    return { ok: false, error: "Bu sinav su an teslim edilemez." };
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("exam_assignments")
    .select("due_at")
    .eq("exam_id", examId)
    .eq("student_id", current.user.id)
    .maybeSingle();
  const effectiveEndsAt = assignmentError
    ? exam.ends_at
    : assignment?.due_at ?? exam.ends_at;

  const now = Date.now();
  if (exam.starts_at && now < new Date(exam.starts_at).getTime()) {
    return { ok: false, error: "Sinav henuz baslamadi." };
  }
  const isExpired = Boolean(
    effectiveEndsAt && now >= new Date(effectiveEndsAt).getTime(),
  );
  if (isExpired && options.reason !== "time_expired") {
    return {
      ok: false,
      error: "Sinav suresi doldu; kaydedilen cevaplar otomatik teslim ediliyor.",
    };
  }
  if (!isExpired && options.reason === "time_expired") {
    return { ok: false, error: "Sinav suresi henuz dolmadi." };
  }

  const { data: links } = await supabase
    .from("exam_questions")
    .select("question_id")
    .eq("exam_id", examId);
  const questionIds = (links ?? []).map((link) => link.question_id);

  if (questionIds.length === 0) {
    return { ok: false, error: "Sinavda soru bulunmuyor." };
  }

  let currentSubmissions = await getOwnExamSubmissions(supabase, examId);
  currentSubmissions = currentSubmissions.filter(
    (submission) =>
      submission.question_id !== null && questionIds.includes(submission.question_id),
  );
  let answerByQuestion = new Map(
    currentSubmissions
      .filter((submission) => submission.question_id !== null)
      .map((submission) => [submission.question_id as string, submission]),
  );
  const missingCount = questionIds.filter(
    (questionId) => !answerByQuestion.get(questionId)?.answer_text.trim(),
  ).length;

  if (missingCount > 0 && options.reason !== "time_expired") {
    return {
      ok: false,
      error: `Sinavi bitirmeden once ${missingCount} eksik cevabi tamamlayin.`,
    };
  }

  if (missingCount > 0 && options.reason === "time_expired") {
    const missingQuestionIds = questionIds.filter(
      (questionId) => !answerByQuestion.get(questionId)?.answer_text.trim(),
    );
    const { error: missingInsertError } = await gradingClient
      .from("submissions")
      .insert(
        missingQuestionIds.map((questionId) => ({
          exam_id: examId,
          question_id: questionId,
          student_id: current.user.id,
          answer_text: "Cevap verilmedi.",
          ai_score: 0,
          ai_feedback: "Sure doldugu icin bu soru yanitsiz teslim edildi.",
          ai_criteria_json: [],
          status: "ai_degerlendirildi" as const,
        })),
      );

    if (missingInsertError && missingInsertError.code !== "23505") {
      return {
        ok: false,
        error: `Yanitsiz sorular teslim edilemedi: ${missingInsertError.message}`,
      };
    }

    const { data: refreshed, error: refreshError } = await gradingClient
      .from("submissions")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", current.user.id)
      .in("question_id", questionIds);
    if (refreshError) return { ok: false, error: refreshError.message };
    currentSubmissions = refreshed ?? [];
    answerByQuestion = new Map(
      currentSubmissions
        .filter((submission) => submission.question_id !== null)
        .map((submission) => [submission.question_id as string, submission]),
    );
  }

  const drafts = currentSubmissions.filter(
    (submission) => submission.status === "gonderildi",
  );
  if (drafts.length === 0) {
    return { ok: true, data: { evaluatedCount: currentSubmissions.length } };
  }

  const draftQuestionIds = drafts
    .map((submission) => submission.question_id)
    .filter((questionId): questionId is string => questionId !== null);
  const { data: questions } = await gradingClient
    .from("questions")
    .select("id, text, type, rubric, correct_answer")
    .in("id", draftQuestionIds);
  const questionById = new Map((questions ?? []).map((question) => [question.id, question]));

  let grades: Array<{
    submissionId: string;
    grade: Awaited<ReturnType<typeof autoGrade>>;
  }>;

  try {
    grades = await Promise.all(
      drafts.map(async (submission) => {
        const question = submission.question_id
          ? questionById.get(submission.question_id)
          : null;
        if (!question) throw new Error("Sinav sorularindan biri bulunamadi.");
        if (question.type === "acik_uclu" && submission.answer_text.trim().length < 10) {
          throw new Error("Acik uclu cevaplar en az 10 karakter olmalidir.");
        }
        return {
          submissionId: submission.id,
          grade: await autoGrade(question, submission.answer_text),
        };
      }),
    );
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Cevaplariniz kayitli, ancak degerlendirme baslatilamadi: ${error.message}`
          : "Cevaplariniz kayitli, ancak degerlendirme baslatilamadi.",
    };
  }

  const updates = await Promise.all(
    grades.map(({ submissionId, grade }) =>
      gradingClient
        .from("submissions")
        .update({
          ai_score: grade.score,
          ai_feedback: grade.feedback,
          ai_criteria_json: grade.criteria,
          // Rubriksiz cevap da egitmenin inceleme listesine dusmelidir.
          status: "ai_degerlendirildi",
        })
        .eq("id", submissionId)
        .eq("student_id", current.user.id)
        .eq("status", "gonderildi"),
    ),
  );
  const failedUpdate = updates.find((result) => result.error)?.error;

  if (failedUpdate) {
    return {
      ok: false,
      error: `Cevaplar kayitli ancak bazilari degerlendirmeye gonderilemedi: ${failedUpdate.message}`,
    };
  }

  const { error: attemptError } = await supabase.rpc("submit_exam_attempt", {
    target_exam: examId,
  });
  if (attemptError && !isStudentFlowUnavailable(attemptError)) {
    return {
      ok: false,
      error: `Cevaplar degerlendirmeye gonderildi ancak sinav durumu guncellenemedi: ${attemptError.message}`,
    };
  }

  revalidatePath("/dashboard/ogrenci");
  revalidatePath(`/dashboard/ogrenci/sinav/${examId}`);
  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/yonetici");

  return { ok: true, data: { evaluatedCount: grades.length } };
}

function isStudentFlowUnavailable(error: { code?: string; message?: string }): boolean {
  return (
    ["PGRST202", "42P01", "42883"].includes(error.code ?? "") ||
    /exam_attempt|start_exam_attempt|submit_exam_attempt/i.test(error.message ?? "") &&
      /not find|does not exist|schema cache/i.test(error.message ?? "")
  );
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

  const { data: submission } = await supabase
    .from("submissions")
    .select("exam_id, student_id")
    .eq("id", input.submissionId)
    .maybeSingle();

  if (!submission) return { ok: false, error: "Cevap bulunamadi." };

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

  const { error: attemptError } = await supabase.rpc(
    "recalculate_exam_attempt_result",
    {
      target_exam: submission.exam_id,
      target_student: submission.student_id,
    },
  );
  if (attemptError && !isStudentFlowUnavailable(attemptError)) {
    return { ok: false, error: attemptError.message };
  }

  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/ogrenci");
  revalidatePath("/dashboard/yonetici");

  return { ok: true, data: undefined };
}
