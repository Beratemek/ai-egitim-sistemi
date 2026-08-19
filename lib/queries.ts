/**
 * Sunucu tarafi okuma katmani.
 *
 * Her fonksiyon Supabase yapilandirilmamissa `lib/mock-data.ts` icindeki demo
 * veriye duser; boylece anahtar girmeden klonlanan proje de calisir hale gelir.
 * Sayfalar dogrudan `supabase.from(...)` cagirmaz, hep buradan okur.
 */

import { isSupabaseConfigured } from "@/lib/env";
import {
  MOCK_EXAMS,
  MOCK_OUTCOMES,
  MOCK_QUESTIONS,
  MOCK_SCORE_TREND,
  MOCK_STATISTICS,
  MOCK_SUBMISSIONS,
  MOCK_USERS,
  type ScoreTrendPoint,
} from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  Exam,
  ExamStatistics,
  LearningOutcome,
  Question,
  QuestionStatus,
  StyleGuide,
  Submission,
  UserProfile,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Kazanimlar                                                                */
/* -------------------------------------------------------------------------- */

export async function getOutcomes(): Promise<LearningOutcome[]> {
  if (!isSupabaseConfigured) return [...MOCK_OUTCOMES];

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("learning_outcomes")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/*  Sorular                                                                   */
/* -------------------------------------------------------------------------- */

export interface QuestionFilters {
  status?: QuestionStatus;
  topic?: string;
}

export async function getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  if (!isSupabaseConfigured) {
    return MOCK_QUESTIONS.filter(
      (question) =>
        (!filters.status || question.status === filters.status) &&
        (!filters.topic || question.topic === filters.topic),
    );
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.topic) query = query.eq("topic", filters.topic);

  const { data } = await query;
  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/*  Sinavlar                                                                  */
/* -------------------------------------------------------------------------- */

export async function getExams(options: { onlyPublished?: boolean } = {}): Promise<Exam[]> {
  if (!isSupabaseConfigured) {
    return MOCK_EXAMS.filter((exam) => !options.onlyPublished || exam.is_published);
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase.from("exams").select("*").order("created_at", { ascending: false });

  if (options.onlyPublished) query = query.eq("is_published", true);

  const { data } = await query;
  return data ?? [];
}

export interface ExamDetail {
  exam: Exam;
  /** Sinavdaki sorular, `position` sirasina gore. */
  questions: (Question & { points: number; position: number })[];
}

export async function getExamDetail(examId: string): Promise<ExamDetail | null> {
  if (!isSupabaseConfigured) {
    const exam = MOCK_EXAMS.find((item) => item.id === examId);
    if (!exam) return null;

    return {
      exam,
      questions: MOCK_QUESTIONS.filter((q) => q.status === "onayli").map(
        (question, index) => ({ ...question, points: 10, position: index }),
      ),
    };
  }

  const supabase = await createServerSupabaseClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();

  if (!exam) return null;

  const { data: links } = await supabase
    .from("exam_questions")
    .select("question_id, position, points")
    .eq("exam_id", examId)
    .order("position", { ascending: true });

  const questionIds = (links ?? []).map((link) => link.question_id);
  if (questionIds.length === 0) return { exam, questions: [] };

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .in("id", questionIds);

  const byId = new Map((questions ?? []).map((question) => [question.id, question]));

  const ordered = (links ?? [])
    .map((link) => {
      const question = byId.get(link.question_id);
      if (!question) return null;
      return { ...question, points: link.points, position: link.position };
    })
    .filter((item): item is Question & { points: number; position: number } => item !== null);

  return { exam, questions: ordered };
}

/* -------------------------------------------------------------------------- */
/*  Cevaplar                                                                  */
/* -------------------------------------------------------------------------- */

export interface SubmissionFilters {
  examId?: string;
  studentId?: string;
  pendingApprovalOnly?: boolean;
}

export async function getSubmissions(
  filters: SubmissionFilters = {},
): Promise<Submission[]> {
  if (!isSupabaseConfigured) {
    return MOCK_SUBMISSIONS.filter(
      (submission) =>
        (!filters.examId || submission.exam_id === filters.examId) &&
        (!filters.studentId || submission.student_id === filters.studentId) &&
        (!filters.pendingApprovalOnly || submission.status === "ai_degerlendirildi"),
    );
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.examId) query = query.eq("exam_id", filters.examId);
  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.pendingApprovalOnly) query = query.eq("status", "ai_degerlendirildi");

  const { data } = await query;
  return data ?? [];
}

/* -------------------------------------------------------------------------- */
/*  Kullanicilar                                                              */
/* -------------------------------------------------------------------------- */

export async function getUsers(): Promise<UserProfile[]> {
  if (!isSupabaseConfigured) return [...MOCK_USERS];

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });

  return data ?? [];
}

/** Id -> tam ad haritasi; tablolarda ogrenci adini gostermek icin. */
export async function getUserNameMap(): Promise<Record<string, string>> {
  const users = await getUsers();
  return Object.fromEntries(
    users.map((user) => [user.id, user.full_name || user.email || "Bilinmiyor"]),
  );
}

/* -------------------------------------------------------------------------- */
/*  Istatistikler                                                             */
/* -------------------------------------------------------------------------- */

export async function getExamStatistics(): Promise<ExamStatistics[]> {
  if (!isSupabaseConfigured) return [...MOCK_STATISTICS];

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("exam_statistics").select("*");
  return data ?? [];
}

/**
 * Haftalik puan trendi.
 *
 * `submissions` uzerinden hesaplanir: her cevabin olusturuldugu haftaya gore
 * AI on puani ve egitmen onayli puan ortalamasi. Veri yoksa bos dizi doner
 * (grafik kendi bos durumunu gosterir).
 */
export async function getScoreTrend(): Promise<ScoreTrendPoint[]> {
  if (!isSupabaseConfigured) return [...MOCK_SCORE_TREND];

  const submissions = await getSubmissions();
  if (submissions.length === 0) return [];

  const buckets = new Map<string, { ai: number[]; approved: number[] }>();

  for (const submission of submissions) {
    const date = new Date(submission.created_at);
    if (Number.isNaN(date.getTime())) continue;

    // ISO hafta yerine yil-hafta anahtari yeterli: yilin kacinci gunu / 7
    const start = new Date(date.getFullYear(), 0, 1);
    const week = Math.floor(
      (date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    const key = `${date.getFullYear()}-${String(week).padStart(2, "0")}`;

    const bucket = buckets.get(key) ?? { ai: [], approved: [] };
    if (submission.ai_score !== null) bucket.ai.push(submission.ai_score);
    if (submission.instructor_approved_score !== null) {
      bucket.approved.push(submission.instructor_approved_score);
    }
    buckets.set(key, bucket);
  }

  const average = (values: number[]): number =>
    values.length === 0
      ? 0
      : Math.round((values.reduce((total, v) => total + v, 0) / values.length) * 10) / 10;

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, bucket], index) => ({
      period: `${index + 1}. hafta`,
      aiScore: average(bucket.ai),
      approvedScore: average(
        bucket.approved.length > 0 ? bucket.approved : bucket.ai,
      ),
      _key: key,
    }))
    .map(({ period, aiScore, approvedScore }) => ({ period, aiScore, approvedScore }));
}

/* -------------------------------------------------------------------------- */
/*  Tercih hafizasi (AI'in ogrendigi tarz)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Oturum acmis kullanicinin son begeni/red kayitlarini dondurur.
 * Modele few-shot olarak verilecegi icin sayi bilincli olarak sinirlidir -
 * cok fazla ornek baglami sisirir ve maliyeti artirir.
 */
export async function getStyleGuide(limit = 6): Promise<StyleGuide> {
  if (!isSupabaseConfigured) return { liked: [], disliked: [] };

  const supabase = await createServerSupabaseClient();

  const [liked, disliked] = await Promise.all([
    supabase
      .from("question_preferences")
      .select("*")
      .eq("verdict", "begendi")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("question_preferences")
      .select("*")
      .eq("verdict", "begenmedi")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  return { liked: liked.data ?? [], disliked: disliked.data ?? [] };
}

/** Tercih istatistikleri - arayuzde "AI su kadar ornekten ogrendi" gostergesi. */
export async function getPreferenceStats(): Promise<{
  liked: number;
  disliked: number;
}> {
  if (!isSupabaseConfigured) return { liked: 0, disliked: 0 };

  const supabase = await createServerSupabaseClient();

  const [liked, disliked] = await Promise.all([
    supabase
      .from("question_preferences")
      .select("*", { count: "exact", head: true })
      .eq("verdict", "begendi"),
    supabase
      .from("question_preferences")
      .select("*", { count: "exact", head: true })
      .eq("verdict", "begenmedi"),
  ]);

  return { liked: liked.count ?? 0, disliked: disliked.count ?? 0 };
}
