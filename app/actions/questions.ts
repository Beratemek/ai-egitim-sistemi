"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { findSimilarOutcome } from "@/lib/outcome-core";
import { subjectKey } from "@/lib/subjects";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";
import type {
  GeneratedQuestion,
  LearningOutcome,
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
  /**
   * Geri bildirimin verildigi ders. Tarz hafizasi ders bazinda okundugu icin
   * bu alan bos gecerse kayit yalnizca "genel" havuzda kalir.
   */
  subject?: string;
}

/**
 * Icerik uzmaninin bir AI taslagina verdigi begeni/red kaydini saklar.
 * Bu kayitlar sonraki uretimlerde modele ornek olarak geri verilir.
 *
 * Ders ve konu birlikte yazilir: `getStyleGuide()` once ayni konunun, sonra
 * ayni dersin orneklerini kullanir. Boylece tarih dersinde "sozel olsun"
 * denmesi matematik uretimini etkilemez.
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
    subject: input.subject?.trim() || null,
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

/**
 * Bir tercih kaydini duzenler: karar ve/veya gerekce.
 *
 * Kayit SILINIP yeniden yazilmaz cunku `outcome_id`, `question_text` ve
 * uretim zamani gibi alanlar kaybolurdu; yalnizca verilen alanlar guncellenir.
 *
 * Gerekce de duzenlenebilir olmali: o metin modele "bu taslak neden kotu"
 * diye gidiyor. Aceleyle yazilmis bir not ("kotu") modele hicbir sey
 * ogretmiyordu ve tek care kaydi silmekti.
 */
export async function updatePreference(
  id: string,
  patch: { verdict?: PreferenceVerdict; note?: string | null },
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!id) return { ok: false, error: "Kayıt seçilmedi." };

  const alanlar: { verdict?: PreferenceVerdict; note?: string | null } = {};
  if (patch.verdict) alanlar.verdict = patch.verdict;
  // `note` bilerek `undefined` ile ayirt ediliyor: bos metin "notu sil"
  // demektir ve gecerli bir istektir.
  if (patch.note !== undefined) alanlar.note = patch.note?.trim() || null;

  if (Object.keys(alanlar).length === 0) {
    return { ok: false, error: "Değişiklik yok." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("question_preferences")
    .update(alanlar)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/icerik-uzmani");
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/*  Havuza kaydetme                                                           */
/* -------------------------------------------------------------------------- */

export interface SaveQuestionsInput {
  questions: GeneratedQuestion[];
  /** Bu partideki tum sorularin yazilacagi ders. Zorunlu. */
  subject: string;
  /**
   * Bu partideki tum sorularin yazilacagi konu.
   * Verilmezse modelin soru basina urettigi konu kullanilir - ama o zaman
   * havuz konu bazinda parcalanir, bu yuzden formda zorunlu tutuluyor.
   */
  topic?: string;
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

  const subject = input.subject?.trim() ?? "";
  if (!subject) {
    return {
      ok: false,
      error: "Ders alani zorunlu. Sorularin hangi derse yazilacagini belirtin.",
    };
  }

  const topic = input.topic?.trim() ?? "";

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  const rows = input.questions.map((question) => ({
    subject,
    // Havuz ders -> konu olarak kirildigi icin parti genelinde TEK konu
    // anahtari kullanilir; model her soruya farkli bir konu adi uydurursa
    // havuz gereksiz yere dagilir.
    topic: topic || question.topic,
    text: question.text,
    type: question.type,
    options_json: question.options,
    correct_answer: question.correct_answer,
    rubric: question.rubric,
    visual_json: question.visual,
    status: "taslak" as const,
    outcome_id: input.outcomeId ?? null,
    created_by: current.user.id,
    ai_generated: true,
  }));

  /*
    Modelin zorluk tahmini ARTIK SAKLANIYOR. Eskiden yalnizca
    question_preferences (begeni hafizasi) tarafina yaziliyordu; soru havuza
    kaydedilirken dusuyor, havuzda hicbir sorunun zorlugu bilinmiyordu.

    Zorluk AYRI bir adimda ekleniyor ki sutun henuz yokken (asagidaki geri
    dusus) zorluksuz satirlar hazir olsun.
  */
  const zorluklu = rows.map((row, index) => ({
    ...row,
    difficulty: input.questions[index]?.difficulty ?? "orta",
  }));

  let { data, error } = await supabase
    .from("questions")
    .insert(zorluklu)
    .select("id");

  /*
    GERI DUSUS: `difficulty` sutunu sonradan eklendi
    (supabase/migrations/BEKLEYEN-2-soru-zorluk.sql). O SQL henuz elle
    calistirilmadiysa Postgres "column does not exist" (42703) der ve
    PostgREST bunu PGRST204 olarak yansitir.

    Bu durumda kaydi tamamen basarisiz saymak yanlis olurdu: icerik uzmani
    migration yuzunden hic soru kaydedemezdi. Sutunsuz tekrar denenir;
    zorluk o partide kaybolur ama sorular durur ve okuyan taraf zaten
    "orta" varsayar (bkz. lib/question-pool.ts -> difficultyOf).
  */
  const sutunYok =
    error !== null &&
    (error.code === "PGRST204" ||
      error.code === "42703" ||
      /difficulty/i.test(error.message));

  if (sutunYok) {
    ({ data, error } = await supabase.from("questions").insert(rows).select("id"));
  }

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

  // RLS bir satirla eslesmezse PostgREST hata dondurmez, sessizce 0 satir
  // gunceller. `.select()` olmadan onay/red basarili sanilir ama kaydedilmez.
  const { data: updated, error } = await supabase
    .from("questions")
    .update({ status, reviewed_by: current.user.id })
    .eq("id", questionId)
    .select("id");

  if (error) return { ok: false, error: error.message };

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error:
        "Soru guncellenemedi: bu soruyu onaylama yetkiniz yok ya da soru artik mevcut degil.",
    };
  }

  revalidatePath("/dashboard/icerik-uzmani");
  revalidatePath("/dashboard/egitmen/soru-havuzu");
  revalidatePath("/dashboard/egitmen");
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/*  Kazanim olusturma                                                         */
/* -------------------------------------------------------------------------- */

export interface CreateOutcomeInput {
  /** Kazanimin ait oldugu ders. Uretim formunda liste bununla suzulur. */
  subject: string;
  topic: string;
  outcomeText: string;
  sourceText?: string;
  /**
   * Tekrar uyarisini gecerek yine de kaydet.
   *
   * Uyari BAGLAYICI DEGIL: bazen iki kazanim gercekten farklidir ve kelime
   * benzerligi yanilir. Karar hocada; sistem yalnizca haberdar eder.
   */
  force?: boolean;
}

/** Tekrar bulundugunda hangi kazanimla cakistigini cagirana bildirir. */
export interface DuplicateOutcome {
  id: string;
  outcomeText: string;
}

/**
 * `createOutcome` sonucu.
 *
 * Hata dalinda `duplicate` tasiyor: arayuz boylece yalnizca "kaydedilemedi"
 * demekle kalmayip cakisan kazanimi gosterip "bunu kullan" diyebiliyor.
 * `ActionResult` hata dalinda ek alan tasiyamadigi icin ayri tanimlandi.
 */
export type CreateOutcomeResult =
  | { ok: true; data: { id: string; outcome: LearningOutcome } }
  | { ok: false; error: string; duplicate?: DuplicateOutcome };

/**
 * Yeni bir kazanim tanimlar.
 *
 * Kazanim, uretimin OLCME HEDEFIdir: soru havuzundaki her soru bir kazanima
 * baglanir (`questions.outcome_id`) ve ogrencinin gelisim ekrani basariyi
 * kazanim bazinda kirar. Serbest metin olarak yazilan kazanim bu zincirin
 * hicbir halkasina giremiyordu; bu yuzden ayri bir kayit olarak tutuluyor.
 */
export async function createOutcome(
  input: CreateOutcomeInput,
): Promise<CreateOutcomeResult> {
  if (!isSupabaseConfigured) return demoGuard();

  const subject = input.subject?.trim() ?? "";
  const topic = input.topic?.trim() ?? "";
  const outcomeText = input.outcomeText?.trim() ?? "";

  if (!subject || !topic || !outcomeText) {
    return { ok: false, error: "Ders, konu ve kazanim alanlari zorunludur." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();

  /*
    TEKRAR KONTROLU SUNUCUDA.

    Arayuz de uyariyor, ama tek koruma orada olamaz: istemci kontrolu
    atlanabilir ve kazanim havuzu TUM hocalarin paylastigi bir kaynak. Bir
    kisinin yanlislikla ikinci kez tanimladigi kazanim, o konudaki butun
    basari yuzdelerini ikiye boler.

    Karsilastirma AYNI DERS + AYNI KONU icinde yapiliyor: "Fotosentez
    bilgisi" iki farkli derste ayni sey olmak zorunda degil.
  */
  if (!input.force) {
    /*
      Konu ile suzuluyor, ders JS tarafinda karsilastiriliyor: dersi BOS olan
      eski kayitlar da hesaba katilmali. `.eq("subject", subject)` onlari
      disliyordu ve migration'dan onceki kazanimlar tekrar kontrolunden
      kaciyordu.
    */
    const { data: siblings } = await supabase
      .from("learning_outcomes")
      .select("id, outcome_text, subject")
      .eq("topic", topic);

    const candidates = (siblings ?? []).filter(
      (row) => !row.subject || subjectKey(row.subject) === subjectKey(subject),
    );

    const similar = findSimilarOutcome(outcomeText, candidates);
    if (similar) {
      return {
        ok: false,
        error: "Bu konuda cok benzer bir kazanim zaten tanimli.",
        duplicate: { id: similar.id, outcomeText: similar.outcome_text },
      };
    }
  }

  const { data, error } = await supabase
    .from("learning_outcomes")
    .insert({
      subject,
      topic,
      outcome_text: outcomeText,
      // Kaynak metin opsiyonel: kazanim once tanimlanip metin sonra
      // yuklenebiliyor. Sutun NOT NULL oldugu icin bos dize yaziliyor.
      source_text: input.sourceText?.trim() ?? "",
      created_by: current.user.id,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/icerik-uzmani");
  return { ok: true, data: { id: data.id, outcome: data } };
}
