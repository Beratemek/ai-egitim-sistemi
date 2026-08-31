/**
 * Sinav kestirimi icin veri yukleme.
 *
 * Iki is yapar:
 *   - Sinav taslagini simulasyonun bekledigi bicime cevirir.
 *   - Gercek bir siniftan DIJITAL IKIZ kadro turetir.
 *
 * KISISEL VERI: ikiz kurulurken ogrenci adi, e-postasi ya da kimligi modele
 * GITMEZ. Yalnizca sayilar (ortalama, ders bazinda ortalama, bos birakma
 * orani) toplanip yetkinlik dilimlerine cevrilir; uretilen profiller "en ust
 * %20", "en alt %20" gibi anonim adlar tasir. Ad gondermenin simulasyona
 * hicbir faydasi yok, riski ise gercek.
 *
 * Yetki bu dosyada genisletilmez: cagiranin Supabase istemcisinin RLS kapsami
 * aynen gecerlidir.
 */

import { isBlankAnswer } from "./outcome-diagnostics.ts";
import {
  buildClassroomTwin,
  type ClassroomTwinResult,
} from "./student-profiles.ts";
import type { StudentPerformanceSample } from "@/lib/student-profiles";
import type { ExamQualityBundle } from "@/lib/exam-quality-data";
import type { ExamSimulationReport, SimulationQuestion } from "@/lib/exam-simulation";
import type { TypedServerClient } from "@/lib/supabase-server";
import type { SimulationCohortKind } from "@/lib/types";

/**
 * Ikiz kurarken taranacak en fazla cevap sayisi.
 *
 * Sinif buyuk ve gecmis uzunsa sorgu binlerce satir dondurebilir; kestirim
 * icin gereken sey ogrencinin genel duzeyi, tam dokumu degil. En yeni
 * cevaplar oncelikli.
 */
const MAX_SUBMISSIONS = 4_000;

/** Sinav taslagini simulasyon sorularina cevirir. */
export function toSimulationQuestions(
  bundle: ExamQualityBundle,
): SimulationQuestion[] {
  const linkByQuestion = new Map(
    bundle.examQuestions.map((link) => [link.question_id, link]),
  );
  const outcomeById = new Map(
    bundle.outcomes.map((outcome) => [outcome.id, outcome.outcome_text]),
  );

  return bundle.questions
    .map((question): SimulationQuestion | null => {
      const link = linkByQuestion.get(question.id);
      if (!link) return null;

      return {
        questionId: question.id,
        position: link.position + 1,
        text: question.text,
        type: question.type,
        options:
          question.options_json?.map((option) => ({
            key: option.key,
            text: option.text,
          })) ?? null,
        correctAnswer: question.correct_answer,
        rubric: question.rubric,
        difficulty: question.difficulty ?? null,
        subject: question.subject,
        topic: question.topic,
        outcomeId: question.outcome_id,
        outcomeText: question.outcome_id
          ? outcomeById.get(question.outcome_id) ?? null
          : null,
        points: link.points,
      };
    })
    .filter((question): question is SimulationQuestion => question !== null)
    .sort((a, b) => a.position - b.position);
}

export interface ClassroomTwinBundle extends ClassroomTwinResult {
  classroom: string;
}

/**
 * Gercek sinifin gecmis basarisindan temsilci kadro uretir.
 *
 * PUAN KAYNAGI yalnizca EGITMEN ONAYLI cevaplar - `lib/outcome-analysis.ts`
 * ile ayni kural. AI on puani nihai degil; onaylanmamis puanla kadro kurmak,
 * hocanin vermedigi bir karari ona atfetmek olurdu.
 */
export async function loadClassroomTwin(
  supabase: TypedServerClient,
  classroom: string,
  options: { size?: number } = {},
): Promise<ClassroomTwinBundle> {
  const studentsResult = await supabase
    .from("users")
    .select("id, role, classroom")
    .eq("classroom", classroom);

  if (studentsResult.error) {
    throw new Error(`Sınıf listesi yüklenemedi: ${studentsResult.error.message}`);
  }

  const studentIds = (studentsResult.data ?? [])
    .filter((user) => user.role === "ogrenci")
    .map((user) => user.id);

  if (studentIds.length === 0) {
    return {
      classroom,
      cohort: [],
      studentCount: 0,
      skippedCount: 0,
      classAverage: null,
    };
  }

  const submissionsResult = await supabase
    .from("submissions")
    .select("student_id, question_id, answer_text, instructor_approved_score, status")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false })
    .limit(MAX_SUBMISSIONS);

  if (submissionsResult.error) {
    throw new Error(`Geçmiş sonuçlar yüklenemedi: ${submissionsResult.error.message}`);
  }

  const submissions = submissionsResult.data ?? [];
  const questionIds = [
    ...new Set(
      submissions
        .map((submission) => submission.question_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const questionsResult = questionIds.length
    ? await supabase.from("questions").select("id, subject").in("id", questionIds)
    : { data: [], error: null };

  if (questionsResult.error) {
    throw new Error(`Soru dersleri yüklenemedi: ${questionsResult.error.message}`);
  }

  const subjectByQuestion = new Map(
    (questionsResult.data ?? []).map((question) => [question.id, question.subject]),
  );

  const samples = buildPerformanceSamples(
    studentIds,
    submissions.map((submission) => ({
      studentId: submission.student_id,
      approvedScore:
        submission.status === "egitmen_onayli"
          ? submission.instructor_approved_score
          : null,
      blank: isBlankAnswer(submission.answer_text ?? ""),
      subject: submission.question_id
        ? subjectByQuestion.get(submission.question_id) ?? null
        : null,
    })),
  );

  return {
    classroom,
    ...buildClassroomTwin(samples, {
      ...(options.size ? { size: options.size } : {}),
    }),
  };
}

/** Ikiz kurulurken kullanilan, kimliksiz tek cevap ozeti. */
export interface RawSubmissionSample {
  studentId: string;
  /** Egitmen onayli puan; onaylanmamissa null. */
  approvedScore: number | null;
  blank: boolean;
  subject: string | null;
}

/**
 * Ham cevaplari ogrenci basina ozetler.
 *
 * SAF: veritabanindan ayri tutuluyor ki esikler ve gruplama birim testiyle
 * dogrulanabilsin (tests/exam-simulation.test.ts).
 *
 * Bos birakma orani ONAYLI/ONAYSIZ ayrimi yapmadan butun cevaplardan
 * hesaplaniyor: bos birakmak bir dikkat/zaman sinyalidir ve egitmenin onayi
 * beklenmeden de gozlenebilir.
 */
export function buildPerformanceSamples(
  studentIds: readonly string[],
  rows: readonly RawSubmissionSample[],
): StudentPerformanceSample[] {
  type Bucket = {
    scores: number[];
    bySubject: Map<string, number[]>;
    total: number;
    blank: number;
  };

  const buckets = new Map<string, Bucket>();
  for (const studentId of studentIds) {
    buckets.set(studentId, { scores: [], bySubject: new Map(), total: 0, blank: 0 });
  }

  for (const row of rows) {
    const bucket = buckets.get(row.studentId);
    if (!bucket) continue;

    bucket.total += 1;
    if (row.blank) bucket.blank += 1;

    if (row.approvedScore === null) continue;
    bucket.scores.push(row.approvedScore);

    if (row.subject) {
      const list = bucket.bySubject.get(row.subject) ?? [];
      list.push(row.approvedScore);
      bucket.bySubject.set(row.subject, list);
    }
  }

  return [...buckets.entries()].map(([studentId, bucket]): StudentPerformanceSample => {
    const bySubject: Record<string, number> = {};
    for (const [subject, scores] of bucket.bySubject) {
      bySubject[subject] = average(scores);
    }

    return {
      studentId,
      averageScore: bucket.scores.length > 0 ? average(bucket.scores) : null,
      bySubject,
      blankRate: bucket.total > 0 ? bucket.blank / bucket.total : 0,
      answerCount: bucket.scores.length,
    };
  });
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/* -------------------------------------------------------------------------- */
/*  Kestirim kaydi                                                            */
/* -------------------------------------------------------------------------- */

export interface RecordSimulationInput {
  examId: string;
  createdBy: string;
  cohortKind: SimulationCohortKind;
  report: ExamSimulationReport;
}

/**
 * Kestirimi kaydeder - kalibrasyonun hammaddesi.
 *
 * KAYIT BASARISIZ OLURSA KESTIRIM DUSMEZ. Iki sebep var: (1) tablo henuz
 * ortak veritabanina uygulanmamis olabilir (bkz.
 * supabase/migrations/BEKLEYEN-1-sinav-kestirimi.sql), (2) kayit ozelligin
 * KENDISI degil, uzerine kurulan olcum. Kullanicinin bekledigi raporu, arka
 * plandaki bir kayit hatasi yuzunden goremez hale getirmek yanlis olur.
 *
 * Hata sessizce yutulmuyor, sunucu gunlugune yaziliyor.
 */
export async function recordExamSimulation(
  supabase: TypedServerClient,
  input: RecordSimulationInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("exam_simulations").insert({
      exam_id: input.examId,
      created_by: input.createdBy,
      cohort_kind: input.cohortKind,
      cohort_label: input.report.cohortLabel,
      student_count: input.report.studentCount,
      predicted_average: input.report.distribution.mean,
      report: input.report,
    });

    if (error) {
      console.warn("[kestirim] Kayit basarisiz:", error.message);
    }
  } catch (caught) {
    console.warn("[kestirim] Kayit basarisiz:", caught);
  }
}
