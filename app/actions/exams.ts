"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { getSubjectOptions } from "@/lib/queries";
import { canonicalizeSubject } from "@/lib/subjects";
import type { Exam } from "@/lib/types";
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
  /**
   * Sinavin dersi. Ders yetkisinin dayanagi budur: yalnizca bu derse
   * yetkili egitmenler sinavi ve cevaplarini gorur. Bos birakilirsa sinav
   * tum egitmenlere acik kalir.
   */
  subject?: string;
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

  /**
   * Elle yazilan ders adi bilinen bir dersin farkli yazimiysa KANONIK
   * yazima oturtulur. Aksi halde "biyoloji" yazan egitmenin sinavi,
   * yoneticinin "Biyoloji" olarak verdigi yetkiyle eslesmeyebilirdi.
   */
  const subject = input.subject
    ? canonicalizeSubject(input.subject, await getSubjectOptions())
    : "";

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("exams")
    .insert({
      title,
      description: input.description?.trim() ?? "",
      subject: subject || null,
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

  // RLS bir satirla eslesmezse PostgREST hata dondurmez; `.select()` olmadan
  // yayina alma basarili sanilir ama sinav taslak kalir.
  const { data: updated, error } = await supabase
    .from("exams")
    .update({ is_published: isPublished })
    .eq("id", examId)
    .select("id");

  if (error) return { ok: false, error: error.message };

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error:
        "Sinav guncellenemedi: bu sinav uzerinde yetkiniz yok ya da sinav artik mevcut degil.",
    };
  }

  revalidateExamPaths(examId);
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/*  Sinifa atama                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Sinavi bir sinifin TUM ogrencilerine atar.
 *
 * Ogrenciyi tek tek secmek yerine sinif secilir; veritabani fonksiyonu o
 * siniftaki onayli ogrencileri bulup atamalari acar. Zaten atanmis ogrenciler
 * sessizce atlanir, boylece ayni sinif ikinci kez atandiginda hata olmaz.
 */
export async function assignExamToClassroom(
  examId: string,
  classroom: string,
  dueAt?: string,
): Promise<ActionResult<{ assigned: number }>> {
  if (!isSupabaseConfigured) return demoGuard();

  if (!examId) return { ok: false, error: "Sınav seçilmedi." };
  if (!classroom.trim()) return { ok: false, error: "Sınıf seçilmedi." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("assign_exam_to_classroom", {
    target_exam: examId,
    target_classroom: classroom.trim(),
    ...(dueAt ? { due_at: dueAt } : {}),
  });

  if (error) return { ok: false, error: error.message };

  revalidateExamPaths(examId);
  return { ok: true, data: { assigned: Number(data ?? 0) } };
}

/**
 * Sinifin atamasini kaldirir.
 * Sinava baslamis ogrencinin atamasi KORUNUR - cevabi ortada kalmasin.
 */
export async function unassignExamFromClassroom(
  examId: string,
  classroom: string,
): Promise<ActionResult<{ removed: number }>> {
  if (!isSupabaseConfigured) return demoGuard();

  if (!examId) return { ok: false, error: "Sınav seçilmedi." };
  if (!classroom.trim()) return { ok: false, error: "Sınıf seçilmedi." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("unassign_exam_from_classroom", {
    target_exam: examId,
    target_classroom: classroom.trim(),
  });

  if (error) return { ok: false, error: error.message };

  revalidateExamPaths(examId);
  return { ok: true, data: { removed: Number(data ?? 0) } };
}

/**
 * Sinavin dersini degistirir.
 *
 * Ders yetkisinin dayanagi budur ve olusturma aninda atlanmis olabilir.
 * Duzeltilemeseydi dersi bos birakilan bir sinav KALICI olarak tum
 * egitmenlere acik kalirdi - yanlislikla acilmis bir kapi kapatilamazdi.
 */
export async function setExamSubject(
  examId: string,
  subject: string,
): Promise<ActionResult<{ subject: string | null }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId) return { ok: false, error: "Sinav secilmedi." };

  const canonical = subject.trim()
    ? canonicalizeSubject(subject, await getSubjectOptions())
    : "";

  const supabase = await createServerSupabaseClient();

  // `.select()` sart: RLS eslesmezse PostgREST hata dondurmez, sessizce
  // 0 satir gunceller ve egitmen "kaydedildi" sanir.
  const { data: updated, error } = await supabase
    .from("exams")
    .update({ subject: canonical || null })
    .eq("id", examId)
    .select("id, subject");

  if (error) return { ok: false, error: error.message };

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error:
        "Ders kaydedilemedi: bu sinav uzerinde yetkiniz yok ya da sinav artik mevcut degil.",
    };
  }

  revalidateExamPaths(examId);
  return { ok: true, data: { subject: updated[0]?.subject ?? null } };
}

export interface ExamSettingsInput {
  /** Ogrenci basina sure (dakika). null: yalnizca pencere gecerli. */
  durationMinutes?: number | null;
  /** Kamera+mikrofon zorunlulugu. */
  proctored?: boolean;
}

/**
 * Sinav ayarlarini gunceller.
 *
 * Tek fonksiyon, cunku ayarlar tek panelde birlikte duzenleniyor; her alan
 * icin ayri bir eylem, ayni ekrandan pes pese istek atilmasina yol acardi.
 * Yalnizca VERILEN alanlar yazilir - kismi guncelleme, dokunulmayan ayarin
 * sifirlanmamasi icin.
 */
export async function updateExamSettings(
  examId: string,
  input: ExamSettingsInput,
): Promise<ActionResult<{ durationMinutes: number | null; proctored: boolean }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId) return { ok: false, error: "Sinav secilmedi." };

  const patch: Partial<Pick<Exam, "duration_minutes" | "proctored">> = {};

  if (input.durationMinutes !== undefined) {
    const dakika = input.durationMinutes;

    if (dakika !== null) {
      if (!Number.isInteger(dakika) || dakika < 1 || dakika > 600) {
        return { ok: false, error: "Sure 1 ile 600 dakika arasinda olmalidir." };
      }
    }
    patch.duration_minutes = dakika;
  }

  if (input.proctored !== undefined) patch.proctored = input.proctored;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Degistirilecek ayar verilmedi." };
  }

  const supabase = await createServerSupabaseClient();

  // `.select()` sart: RLS eslesmezse PostgREST hata dondurmez, sessizce
  // 0 satir gunceller ve egitmen "kaydedildi" sanir.
  const { data: updated, error } = await supabase
    .from("exams")
    .update(patch)
    .eq("id", examId)
    .select("id, duration_minutes, proctored");

  if (error) return { ok: false, error: error.message };

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error:
        "Ayar kaydedilemedi: bu sinav uzerinde yetkiniz yok ya da sinav artik mevcut degil.",
    };
  }

  revalidateExamPaths(examId);
  revalidatePath("/dashboard/ogrenci", "layout");

  return {
    ok: true,
    data: {
      durationMinutes: updated[0]?.duration_minutes ?? null,
      proctored: updated[0]?.proctored ?? false,
    },
  };
}

/**
 * Bir sorunun sinavdaki puanini degistirir.
 *
 * Puanlar sinava OZELDIR (exam_questions), soruya degil: ayni soru bir
 * sinavda 5, digerinde 20 puan olabilir. Sifir puana izin verilmez -
 * toplam sifir olursa sonuc hesaplama bolme yapamaz ve sinav asla
 * sonuclanmaz; kural veritabaninda da check kisitiyla var.
 */
export async function setExamQuestionPoints(
  examId: string,
  questionId: string,
  points: number,
): Promise<ActionResult<{ points: number }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId || !questionId) return { ok: false, error: "Soru secilmedi." };

  if (!Number.isInteger(points) || points < 1 || points > 100) {
    return { ok: false, error: "Puan 1 ile 100 arasinda bir tam sayi olmalidir." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: updated, error } = await supabase
    .from("exam_questions")
    .update({ points })
    .eq("exam_id", examId)
    .eq("question_id", questionId)
    .select("question_id, points");

  if (error) return { ok: false, error: error.message };

  /**
   * Elle puan verildigi anda otomatik dagitim kapanir.
   *
   * Aksi halde egitmen puanlari ayarladiktan sonra sinava bir soru eklese
   * butun emegi silinir, puanlar yeniden esit dagitilirdi. Geri acmak icin
   * "Eşit dağıt" var.
   */
  if (updated && updated.length > 0) {
    await supabase.from("exams").update({ points_auto: false }).eq("id", examId);
  }

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error:
        "Puan kaydedilemedi: bu sinav uzerinde yetkiniz yok ya da soru artik sinavda degil.",
    };
  }

  revalidateExamPaths(examId);
  return { ok: true, data: { points: updated[0]?.points ?? points } };
}

/**
 * Puanlari soru sayisina gore yeniden esit dagitir (toplam 100).
 *
 * Otomatik dagitimi da yeniden ACAR: egitmen bundan sonra soru ekleyip
 * cikardikca puanlar kendiliginden guncellenir. Elle bir puana dokundugu
 * anda tekrar kapanir.
 */
export async function resetExamPoints(
  examId: string,
): Promise<ActionResult<{ total: number }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId) return { ok: false, error: "Sinav secilmedi." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("reset_exam_points", {
    target_exam: examId,
  });

  if (error) {
    if (error.code === "42501") {
      return { ok: false, error: "Bu sinavin puanlarini degistirme yetkiniz yok." };
    }
    return { ok: false, error: error.message };
  }

  revalidateExamPaths(examId);
  return { ok: true, data: { total: (data as number | null) ?? 0 } };
}
