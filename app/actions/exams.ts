"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";

/** Sinav degisikliklerinden etkilenen sayfalari tazeler. */
function revalidateExamPaths(examId?: string): void {
  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/egitmen/sinavlar");
  if (examId) revalidatePath(`/dashboard/egitmen/sinavlar/${examId}`);
  revalidatePath("/dashboard/ogrenci");
  revalidatePath("/dashboard/yonetici");
}

/* -------------------------------------------------------------------------- */
/*  Sinav olusturma                                                          */
/* -------------------------------------------------------------------------- */

export interface CreateExamInput {
  title: string;
  description?: string;
  /** ISO tarih-saat; bos birakilabilir. */
  startsAt?: string;
  endsAt?: string;
}

/**
 * Yeni sinav olusturur. Sinav "taslak" (yayinlanmamis) baslar; ogrenciler
 * yalnizca yayina alindiktan sonra gorur (bkz. `exams_select` RLS politikasi).
 */
export async function createExam(
  input: CreateExamInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Sinav basligi zorunludur." };

  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    return { ok: false, error: "Bitis tarihi baslangictan sonra olmalidir." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("exams")
    .insert({
      title,
      description: input.description?.trim() ?? "",
      instructor_id: current.user.id,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidateExamPaths(data.id);
  return { ok: true, data: { id: data.id } };
}

/* -------------------------------------------------------------------------- */
/*  Sinav - soru eslesmesi                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Havuzdan secilen onayli sorulari sinava ekler.
 *
 * `position` mevcut en buyuk sirayi takip eder; `points` veritabani
 * varsayilanina (10) birakilir. Zaten ekli sorular sessizce atlanir.
 */
export async function addExamQuestions(
  examId: string,
  questionIds: readonly string[],
): Promise<ActionResult<{ added: number }>> {
  if (!isSupabaseConfigured) return demoGuard();

  if (!examId) return { ok: false, error: "Sinav id'si zorunludur." };
  if (questionIds.length === 0) {
    return { ok: false, error: "Eklenecek soru secilmedi." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("exam_questions")
    .select("question_id, position")
    .eq("exam_id", examId);

  if (existingError) return { ok: false, error: existingError.message };

  const alreadyLinked = new Set((existing ?? []).map((row) => row.question_id));
  const fresh = questionIds.filter((id) => !alreadyLinked.has(id));

  if (fresh.length === 0) {
    return { ok: false, error: "Secilen sorular bu sinavda zaten var." };
  }

  const nextPosition =
    (existing ?? []).reduce((max, row) => Math.max(max, row.position), -1) + 1;

  const { error } = await supabase.from("exam_questions").insert(
    fresh.map((questionId, index) => ({
      exam_id: examId,
      question_id: questionId,
      position: nextPosition + index,
    })),
  );

  if (error) return { ok: false, error: error.message };

  revalidateExamPaths(examId);
  return { ok: true, data: { added: fresh.length } };
}

/** Bir soruyu sinavdan cikarir. Verilmis cevaplar silinmez. */
export async function removeExamQuestion(
  examId: string,
  questionId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("exam_questions")
    .delete()
    .eq("exam_id", examId)
    .eq("question_id", questionId);

  if (error) return { ok: false, error: error.message };

  revalidateExamPaths(examId);
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/*  Yayina alma                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Sinavi yayina alir veya yayindan cikarir.
 * Sorusu olmayan bir sinav yayina alinamaz - ogrenci bos ekran gormemeli.
 */
export async function setExamPublished(
  examId: string,
  isPublished: boolean,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();

  const supabase = await createServerSupabaseClient();

  if (isPublished) {
    const { count, error: countError } = await supabase
      .from("exam_questions")
      .select("*", { count: "exact", head: true })
      .eq("exam_id", examId);

    if (countError) return { ok: false, error: countError.message };
    if (!count) {
      return {
        ok: false,
        error: "Sinavi yayina almak icin en az bir soru eklemelisiniz.",
      };
    }
  }

  const { error } = await supabase
    .from("exams")
    .update({ is_published: isPublished })
    .eq("id", examId);

  if (error) return { ok: false, error: error.message };

  revalidateExamPaths(examId);
  return { ok: true, data: undefined };
}
