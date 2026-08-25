"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { loadExamQualityBundle } from "@/lib/exam-quality-data";
import { getSubjectOptions } from "@/lib/queries";
import { canonicalizeSubject } from "@/lib/subjects";
import type { Exam } from "@/lib/types";
import {
  createServerSupabaseClient,
  getCurrentUser,
  type TypedServerClient,
} from "@/lib/supabase-server";

const EXAM_STRUCTURE_LOCKED_ERROR =
  "Bu sinava bir ogrenci baslamis veya cevap kaydi olusmus. Soru yapisi ve puanlar artik degistirilemez.";

/**
 * Kullaniciya veritabanindaki tetikleyiciden once acik bir hata verir.
 *
 * Bu kontrol tek basina guvenlik siniri degildir: kontrol ile yazma arasinda
 * bir ogrenci sinava baslayabilir. Asil atomik koruma migration'daki BEFORE
 * trigger'dir; buradaki kontrol yalnizca daha anlasilir arayuz geri bildirimi
 * saglar.
 */
async function guardExamStructureEditable(
  supabase: TypedServerClient,
  examId: string,
): Promise<ActionResult> {
  const [attempts, submissions] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId),
  ]);

  const error = attempts.error ?? submissions.error;
  if (error) {
    return {
      ok: false,
      error: `Sinav yapisi kilidi denetlenemedi: ${error.message}`,
    };
  }

  if ((attempts.count ?? 0) > 0 || (submissions.count ?? 0) > 0) {
    return { ok: false, error: EXAM_STRUCTURE_LOCKED_ERROR };
  }

  return { ok: true, data: undefined };
}

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

  const editable = await guardExamStructureEditable(supabase, examId);
  if (!editable.ok) return editable;

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

  const editable = await guardExamStructureEditable(supabase, examId);
  if (!editable.ok) return editable;

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
    try {
      const quality = await loadExamQualityBundle(supabase, examId);
      if (!quality) {
        return {
          ok: false,
          error: "Sınav bulunamadı veya bu sınav üzerinde yetkiniz yok.",
        };
      }
      if (!quality.report.canPublish) {
        const summary = quality.report.blockers
          .slice(0, 3)
          .map((issue) => issue.title)
          .join("; ");
        const remaining = Math.max(0, quality.report.blockers.length - 3);
        return {
          ok: false,
          error: `Yayın öncesi kalite kontrolü tamamlanmadı: ${summary}${
            remaining > 0 ? ` ve ${remaining} engel daha` : ""
          }. Kalite Kontrolü sekmesini inceleyin.`,
        };
      }
    } catch (caught) {
      return {
        ok: false,
        error:
          caught instanceof Error
            ? caught.message
            : "Yayın öncesi kalite kontrolü tamamlanamadı.",
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
  /** Sinavin acildigi an (ISO). null: sinav yayina alindigi anda acilir. */
  startsAt?: string | null;
  /** Sinavin kapandigi an (ISO). null: kendiliginden kapanmaz. */
  endsAt?: string | null;
}

/** ISO tarih dizesini dogrular; gecersizse null yerine undefined doner. */
function parseIsoOrNull(value: string | null): string | null | undefined {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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
): Promise<
  ActionResult<{
    durationMinutes: number | null;
    proctored: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>
> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!examId) return { ok: false, error: "Sinav secilmedi." };

  const patch: Partial<
    Pick<Exam, "duration_minutes" | "proctored" | "starts_at" | "ends_at">
  > = {};

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

  if (input.startsAt !== undefined) {
    const parsed = parseIsoOrNull(input.startsAt);
    if (parsed === undefined) return { ok: false, error: "Baslangic tarihi gecersiz." };
    patch.starts_at = parsed;
  }

  if (input.endsAt !== undefined) {
    const parsed = parseIsoOrNull(input.endsAt);
    if (parsed === undefined) return { ok: false, error: "Bitis tarihi gecersiz." };
    patch.ends_at = parsed;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Degistirilecek ayar verilmedi." };
  }

  const supabase = await createServerSupabaseClient();

  /*
    Pencere kismi guncellenebildigi icin (yalnizca bitis degistirilebilir)
    "bitis > baslangic" kurali YAZILACAK degerle degil, YAZILDIKTAN SONRAKI
    degerle sinanmali. Dokunulmayan ucu veritabanindan okuyoruz; aksi halde
    yalnizca bitisi geri ceken bir duzenleme sessizce ters pencere birakirdi.
  */
  if (patch.starts_at !== undefined || patch.ends_at !== undefined) {
    const { data: mevcut } = await supabase
      .from("exams")
      .select("starts_at, ends_at")
      .eq("id", examId)
      .maybeSingle();

    const baslangic =
      patch.starts_at !== undefined ? patch.starts_at : (mevcut?.starts_at ?? null);
    const bitis = patch.ends_at !== undefined ? patch.ends_at : (mevcut?.ends_at ?? null);

    if (baslangic && bitis && bitis <= baslangic) {
      return { ok: false, error: "Bitis tarihi baslangictan sonra olmalidir." };
    }
  }

  // `.select()` sart: RLS eslesmezse PostgREST hata dondurmez, sessizce
  // 0 satir gunceller ve egitmen "kaydedildi" sanir.
  const { data: updated, error } = await supabase
    .from("exams")
    .update(patch)
    .eq("id", examId)
    .select("id, duration_minutes, proctored, starts_at, ends_at");

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
      startsAt: updated[0]?.starts_at ?? null,
      endsAt: updated[0]?.ends_at ?? null,
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

  const editable = await guardExamStructureEditable(supabase, examId);
  if (!editable.ok) return editable;

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

  const editable = await guardExamStructureEditable(supabase, examId);
  if (!editable.ok) return editable;

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

export interface CreateExamWithQuestionsInput {
  title: string;
  description?: string;
  subject?: string;
  /** Ogrenci basina sure (dakika). Verilmezse sutun varsayilani (60) uygulanir. */
  durationMinutes?: number;
  /** Kamera+mikrofon zorunlulugu. */
  proctored?: boolean;
  /** Sinava eklenecek soru kimlikleri. */
  questionIds: readonly string[];
  /**
   * Soru basina puan (soru kimligi -> puan).
   *
   * Verilirse otomatik dagitim KAPATILIR: egitmen puanlari elle belirlemis
   * demektir ve sonradan soru eklemek onun girdigi degerleri silmemeli.
   * Verilmezse puanlar 100 uzerinden kendiliginden dagitilir.
   */
  points?: Readonly<Record<string, number>>;
}

/**
 * Sinavi olusturur ve secilen sorulari TEK ADIMDA ekler.
 *
 * Ayri ayri cagrilsa arada bir hata olustugunda ortada sorusuz bir sinav
 * kalirdi; egitmen de onu bulup silmek zorunda kalirdi. Soru ekleme
 * basarisiz olursa olusturulan sinav geri alinir.
 */
export async function createExamWithQuestions(
  input: CreateExamWithQuestionsInput,
): Promise<ActionResult<{ id: string; added: number }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Sinav basligi zorunludur." };

  const ids = [...new Set(input.questionIds)].filter(Boolean);
  if (ids.length === 0) return { ok: false, error: "En az bir soru secmelisiniz." };

  if (
    input.durationMinutes !== undefined &&
    (!Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 1 ||
      input.durationMinutes > 600)
  ) {
    return { ok: false, error: "Sure 1 ile 600 dakika arasinda olmalidir." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const subject = input.subject
    ? canonicalizeSubject(input.subject, await getSubjectOptions())
    : "";

  const supabase = await createServerSupabaseClient();

  const elle = input.points ?? null;

  const { data: exam, error } = await supabase
    .from("exams")
    .insert({
      title,
      description: input.description?.trim() ?? "",
      subject: subject || null,
      instructor_id: current.user.id,
      ...(input.proctored === undefined ? {} : { proctored: input.proctored }),
      ...(input.durationMinutes === undefined
        ? {}
        : { duration_minutes: input.durationMinutes }),
      // Elle puan verildiyse otomatik dagitim bastan kapali olmali; aksi
      // halde tetikleyici sorular eklenirken puanlari esitleyip yazardi.
      ...(elle ? { points_auto: false } : {}),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const added = await addExamQuestions(exam.id, ids);

  if (!added.ok) {
    // Sorusuz sinav birakma: olusturulani geri al.
    await supabase.from("exams").delete().eq("id", exam.id);
    return { ok: false, error: added.error };
  }

  if (elle) {
    // Ayni puani alan sorular tek istekte guncellenir; soru basina istek
    // 40 soruluk bir sinavda 40 gidis-donus demek olurdu.
    const gruplar = new Map<number, string[]>();

    for (const id of ids) {
      const puan = elle[id];
      if (!Number.isInteger(puan) || puan === undefined || puan < 1 || puan > 100) {
        continue;
      }
      const bucket = gruplar.get(puan) ?? [];
      bucket.push(id);
      gruplar.set(puan, bucket);
    }

    for (const [puan, grup] of gruplar) {
      const { error: puanError } = await supabase
        .from("exam_questions")
        .update({ points: puan })
        .eq("exam_id", exam.id)
        .in("question_id", grup);

      if (puanError) {
        return {
          ok: false,
          error: `Sinav olusturuldu ama puanlar yazilamadi: ${puanError.message}`,
        };
      }
    }
  }

  revalidateExamPaths(exam.id);
  return { ok: true, data: { id: exam.id, added: added.data.added } };
}
