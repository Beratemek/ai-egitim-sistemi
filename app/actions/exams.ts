"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateExamInput {
  title: string;
  description?: string;
  /** Kagittaki sirayla soru kimlikleri. */
  questionIds: string[];
  /** `questionIds` ile ayni sirada, her sorunun puani. */
  points: number[];
  /** ISO tarih (yyyy-aa-gg) veya bos. */
  date?: string;
}

/**
 * Egitmenin havuzdan sectigi sorularla bir sinav kaydeder.
 *
 * Once `exams`, sonra `exam_questions` yazilir. Ikinci adim patlarsa
 * sinav satiri geri silinir - yoksa soru tasimayan hayalet bir sinav kalir.
 */
export async function createExamFromPool(
  input: CreateExamInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error:
        "Sinav kaydi icin Supabase baglantisi gerekiyor. Kagidi yine de PDF olarak indirebilirsiniz.",
    };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Sinav basligi bos olamaz." };

  if (input.questionIds.length === 0) {
    return { ok: false, error: "Sinava en az bir soru eklemelisiniz." };
  }

  if (input.points.length !== input.questionIds.length) {
    return { ok: false, error: "Puan listesi soru listesiyle ayni uzunlukta olmali." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .insert({
      title,
      description: input.description?.trim() ?? "",
      instructor_id: current.user.id,
      starts_at: input.date ? new Date(`${input.date}T00:00:00`).toISOString() : null,
    })
    .select("id")
    .single();

  if (examError || !exam) {
    return { ok: false, error: examError?.message ?? "Sinav olusturulamadi." };
  }

  const { error: linkError } = await supabase.from("exam_questions").insert(
    input.questionIds.map((questionId, index) => ({
      exam_id: exam.id,
      question_id: questionId,
      position: index,
      points: input.points[index],
    })),
  );

  if (linkError) {
    await supabase.from("exams").delete().eq("id", exam.id);
    return { ok: false, error: linkError.message };
  }

  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/egitmen/soru-havuzu");

  return { ok: true, data: { id: exam.id } };
}
