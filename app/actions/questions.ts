"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";
import type {
  GeneratedQuestion,
  PreferenceVerdict,
  QuestionStatus,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Tercih hafizasi                                                           */
/* -------------------------------------------------------------------------- */

export interface RecordPreferenceInput {
  question: GeneratedQuestion;
  verdict: PreferenceVerdict;
  note?: string;
  outcomeId?: string;
}

/**
 * Icerik uzmaninin bir AI taslagina verdigi begeni/red kaydini saklar.
 * Bu kayitlar sonraki uretimlerde modele ornek olarak geri verilir.
 */
export async function recordPreference(
  input: RecordPreferenceInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("question_preferences").insert({
    user_id: current.user.id,
    verdict: input.verdict,
    question_text: input.question.text,
    question_type: input.question.type,
    topic: input.question.topic,
    difficulty: input.question.difficulty,
    options_json: input.question.options,
    rubric: input.question.rubric,
    note: input.note ?? null,
    outcome_id: input.outcomeId ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/icerik-uzmani");
  return { ok: true, data: undefined };
}

/** Bir tercih kaydini geri alir (yanlislikla basilmissa). */
export async function deletePreference(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("question_preferences").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/icerik-uzmani");
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/*  Havuza kaydetme                                                           */
/* -------------------------------------------------------------------------- */

export interface SaveQuestionsInput {
  questions: GeneratedQuestion[];
  outcomeId?: string;
}

/**
 * AI taslaklarini soru havuzuna "taslak" durumunda yazar.
 * Egitmen onayindan sonra sinavlarda kullanilabilir hale gelirler.
 */
export async function saveGeneratedQuestions(
  input: SaveQuestionsInput,
): Promise<ActionResult<{ saved: number }>> {
  if (!isSupabaseConfigured) return demoGuard();

  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    return { ok: false, error: "Kaydedilecek soru secilmedi." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const rows = input.questions.map((question) => ({
    topic: question.topic,
    text: question.text,
    type: question.type,
    options_json: question.options,
    correct_answer: question.correct_answer,
    rubric: question.rubric,
    status: "taslak" as const,
    outcome_id: input.outcomeId ?? null,
    created_by: current.user.id,
    ai_generated: true,
  }));

  const { data, error } = await supabase.from("questions").insert(rows).select("id");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/icerik-uzmani");
  revalidatePath("/dashboard/egitmen/soru-havuzu");
  revalidatePath("/dashboard/egitmen");

  return { ok: true, data: { saved: data?.length ?? 0 } };
}

/* -------------------------------------------------------------------------- */
/*  Egitmen onayi                                                             */
/* -------------------------------------------------------------------------- */

/** Egitmenin bir taslagi onaylamasi / reddetmesi. */
export async function updateQuestionStatus(
  questionId: string,
  status: QuestionStatus,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("questions")
    .update({ status, reviewed_by: current.user.id })
    .eq("id", questionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/egitmen/soru-havuzu");
  revalidatePath("/dashboard/egitmen");
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/*  Kazanim olusturma                                                         */
/* -------------------------------------------------------------------------- */

export interface CreateOutcomeInput {
  topic: string;
  outcomeText: string;
  sourceText: string;
}

export async function createOutcome(
  input: CreateOutcomeInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured) return demoGuard();

  if (!input.topic.trim() || !input.outcomeText.trim()) {
    return { ok: false, error: "Konu ve kazanim alanlari zorunludur." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("learning_outcomes")
    .insert({
      topic: input.topic.trim(),
      outcome_text: input.outcomeText.trim(),
      source_text: input.sourceText,
      created_by: current.user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/icerik-uzmani");
  return { ok: true, data: { id: data.id } };
}
