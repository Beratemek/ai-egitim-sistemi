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
import {
  createServerSupabaseClient,
  getCurrentUser,
  type TypedServerClient,
} from "@/lib/supabase-server";
import type {
  Exam,
  ExamAssignment,
  ExamAttempt,
  ExamStatistics,
  LearningOutcome,
  Question,
  QuestionOption,
  QuestionStatus,
  QuestionType,
  StyleGuide,
  Submission,
  UserProfile,
} from "@/lib/types";

/**
 * Ogrencinin cevaplarini sonuc gorunurluk kurallarindan geciren RPC'den okur.
 *
 * Guvenlik migration'i ortak veritabanina uygulanana kadar eski sorguya
 * yalnizca "fonksiyon bulunamadi" hatasinda geri doner. Migration sonrasi
 * `submissions` tablosunun ogrenci SELECT yetkisi kapatilacagi icin tum okumalar
 * otomatik olarak guvenli RPC uzerinden devam eder.
 */
async function getOwnSubmissions(
  supabase: TypedServerClient,
  examId: string | null = null,
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

  let legacyQuery = supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (examId) legacyQuery = legacyQuery.eq("exam_id", examId);

  const legacyResult = await legacyQuery;
  return legacyResult.data ?? [];
}

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
/*  Sinav listeleri                                                           */
/* -------------------------------------------------------------------------- */

/** Egitmenin sinav listesi icin ozet satiri. */
export interface ExamSummary extends Exam {
  questionCount: number;
  submissionCount: number;
}

/**
 * Egitmenin sinavlarini soru ve cevap sayilariyla dondurur.
 * Sayimlar tek tek sorgu yerine iki toplu okumadan JS tarafinda cikarilir.
 */
export async function getExamSummaries(): Promise<ExamSummary[]> {
  const exams = await getExams();

  if (!isSupabaseConfigured) {
    const approved = MOCK_QUESTIONS.filter((q) => q.status === "onayli").length;
    return exams.map((exam) => ({
      ...exam,
      questionCount: approved,
      submissionCount: MOCK_SUBMISSIONS.filter((s) => s.exam_id === exam.id).length,
    }));
  }

  if (exams.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const examIds = exams.map((exam) => exam.id);

  const [links, submissions] = await Promise.all([
    supabase.from("exam_questions").select("exam_id").in("exam_id", examIds),
    supabase.from("submissions").select("exam_id").in("exam_id", examIds),
  ]);

  const countBy = (rows: { exam_id: string }[] | null): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.exam_id, (map.get(row.exam_id) ?? 0) + 1);
    }
    return map;
  };

  const questionCounts = countBy(links.data);
  const submissionCounts = countBy(submissions.data);

  return exams.map((exam) => ({
    ...exam,
    questionCount: questionCounts.get(exam.id) ?? 0,
    submissionCount: submissionCounts.get(exam.id) ?? 0,
  }));
}

/** Ogrencinin sinav kartlari: kac soru var, kacini yanitladi. */
export interface StudentExamCard extends Exam {
  questionCount: number;
  answeredCount: number;
  /** AI degerlendirmesine gonderilmis (veya egitmen onayli) cevap sayisi. */
  evaluatedCount: number;
  /** Egitmen tarafindan nihai puani onaylanan cevap sayisi. */
  approvedCount: number;
  assignment: ExamAssignment | null;
  attempt: ExamAttempt | null;
}

/**
 * Ogrencinin girebilecegi (yayindaki) sinavlar.
 * `submissions` uzerindeki RLS politikasi ogrencinin yalnizca kendi
 * cevaplarini gormesini sagladigi icin sayim dogrudan kendi ilerlemesidir.
 */
export async function getStudentExams(): Promise<StudentExamCard[]> {
  const exams = await getExams({ onlyPublished: true });

  if (!isSupabaseConfigured) {
    const approved = MOCK_QUESTIONS.filter((q) => q.status === "onayli").length;
    return exams.map((exam) => ({
      ...exam,
      questionCount: approved,
      answeredCount: MOCK_SUBMISSIONS.filter((s) => s.exam_id === exam.id).length,
      evaluatedCount: MOCK_SUBMISSIONS.filter(
        (s) => s.exam_id === exam.id && s.status !== "gonderildi",
      ).length,
      approvedCount: MOCK_SUBMISSIONS.filter(
        (s) => s.exam_id === exam.id && s.status === "egitmen_onayli",
      ).length,
      assignment: null,
      attempt: null,
    }));
  }

  if (exams.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const assignmentResult = await supabase
    .from("exam_assignments")
    .select("*");
  // Migration henuz uzak projeye uygulanmadiysa eski "tum yayinlananlar"
  // davranisina geri don; uygulandiginda yalnizca atanmis sinavlar gorunur.
  const assignments = assignmentResult.error ? null : (assignmentResult.data ?? []);
  const assignmentByExam = new Map(
    (assignments ?? []).map((assignment) => [assignment.exam_id, assignment]),
  );
  const visibleExams = assignments
    ? exams.filter((exam) => assignmentByExam.has(exam.id))
    : exams;

  if (visibleExams.length === 0) return [];
  const examIds = visibleExams.map((exam) => exam.id);

  const [links, submissions, attemptsResult] = await Promise.all([
    supabase.from("exam_questions").select("exam_id").in("exam_id", examIds),
    getOwnSubmissions(supabase),
    supabase.from("exam_attempts").select("*").in("exam_id", examIds),
  ]);

  const countBy = (rows: { exam_id: string }[] | null): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.exam_id, (map.get(row.exam_id) ?? 0) + 1);
    }
    return map;
  };

  const questionCounts = countBy(links.data);
  const answered = countBy(submissions);
  const evaluated = countBy(
    submissions.filter((row) => row.status !== "gonderildi"),
  );
  const approved = countBy(
    submissions.filter((row) => row.status === "egitmen_onayli"),
  );
  const attemptByExam = new Map(
    (attemptsResult.data ?? []).map((attempt) => [attempt.exam_id, attempt]),
  );

  return visibleExams.map((exam) => ({
    ...exam,
    ends_at: assignmentByExam.get(exam.id)?.due_at ?? exam.ends_at,
    questionCount: questionCounts.get(exam.id) ?? 0,
    answeredCount: answered.get(exam.id) ?? 0,
    evaluatedCount: evaluated.get(exam.id) ?? 0,
    approvedCount: approved.get(exam.id) ?? 0,
    assignment: assignmentByExam.get(exam.id) ?? null,
    attempt: attemptByExam.get(exam.id) ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Ogrencinin sinav ekrani                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ogrenciye gonderilen soru alani.
 *
 * `correct_answer` ve `rubric` BILINCLI OLARAK YOK: bu nesne istemciye kadar
 * gidiyor ve ikisi de tarayici kaynagindan okunabilir olurdu. Puanlama zaten
 * sunucuda, veritabanindan okunan rubrik/dogru cevap ile yapiliyor
 * (bkz. lib/grading.ts).
 */
export interface StudentQuestion {
  id: string;
  topic: string;
  text: string;
  type: QuestionType;
  options_json: QuestionOption[] | null;
  position: number;
  points: number;
}

export interface StudentExamDetail {
  exam: Exam;
  questions: StudentQuestion[];
  questionCount: number;
  totalPoints: number;
  /** Ogrencinin bu sinavda daha once verdigi cevaplar. */
  submissions: Submission[];
  assignment: ExamAssignment | null;
  attempt: ExamAttempt | null;
}

export async function getStudentExamDetail(
  examId: string,
): Promise<StudentExamDetail | null> {
  if (!isSupabaseConfigured) {
    const exam = MOCK_EXAMS.find((item) => item.id === examId);
    if (!exam) return null;

    return {
      exam,
      questions: MOCK_QUESTIONS.filter((q) => q.status === "onayli").map(
        (question, index) => ({
          id: question.id,
          topic: question.topic,
          text: question.text,
          type: question.type,
          options_json: question.options_json,
          position: index,
          points: 10,
        }),
      ),
      submissions: MOCK_SUBMISSIONS.filter((s) => s.exam_id === examId),
      questionCount: MOCK_QUESTIONS.filter((q) => q.status === "onayli").length,
      totalPoints: MOCK_QUESTIONS.filter((q) => q.status === "onayli").length * 10,
      assignment: null,
      attempt: null,
    };
  }

  const supabase = await createServerSupabaseClient();

  const [assignmentResult, attemptResult] = await Promise.all([
    supabase
      .from("exam_assignments")
      .select("*")
      .eq("exam_id", examId)
      .maybeSingle(),
    supabase.from("exam_attempts").select("*").eq("exam_id", examId).maybeSingle(),
  ]);

  if (!assignmentResult.error && !assignmentResult.data) return null;

  const { data: exam } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();

  if (!exam) return null;
  const effectiveExam = {
    ...exam,
    ends_at: assignmentResult.data?.due_at ?? exam.ends_at,
  };

  const [{ data: links }, submissions] = await Promise.all([
    supabase
      .from("exam_questions")
      .select("question_id, position, points")
      .eq("exam_id", examId)
      .order("position", { ascending: true }),
    getOwnSubmissions(supabase, examId),
  ]);

  const questionIds = (links ?? []).map((link) => link.question_id);
  const totalPoints = (links ?? []).reduce((total, link) => total + link.points, 0);
  if (questionIds.length === 0) {
    return {
      exam: effectiveExam,
      questions: [],
      submissions,
      questionCount: 0,
      totalPoints: 0,
      assignment: assignmentResult.data ?? null,
      attempt: attemptResult.data ?? null,
    };
  }

  const safeQuestionsResult = await supabase.rpc("get_student_exam_questions", {
    target_exam: examId,
  });
  const legacyQuestionsResult = safeQuestionsResult.error
    ? await supabase
        .from("questions")
        .select("id, topic, text, type, options_json")
        .in("id", questionIds)
    : null;
  const questions = safeQuestionsResult.error
    ? (legacyQuestionsResult?.data ?? [])
    : (safeQuestionsResult.data ?? []);

  const byId = new Map(questions.map((question) => [question.id, question]));

  const ordered = (links ?? [])
    .map((link): StudentQuestion | null => {
      const question = byId.get(link.question_id);
      if (!question) return null;
      return {
        id: question.id,
        topic: question.topic,
        text: question.text,
        type: question.type,
        options_json: question.options_json,
        position: link.position,
        points: link.points,
      };
    })
    .filter((item): item is StudentQuestion => item !== null);

  return {
    exam: effectiveExam,
    questions: ordered,
    submissions,
    questionCount: questionIds.length,
    totalPoints,
    assignment: assignmentResult.data ?? null,
    attempt: attemptResult.data ?? null,
  };
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

  const [supabase, current] = await Promise.all([
    createServerSupabaseClient(),
    getCurrentUser(),
  ]);

  if (current?.actualRole === "ogrenci") {
    const data = await getOwnSubmissions(supabase, filters.examId ?? null);
    return data.filter(
      (submission) =>
        (!filters.studentId || submission.student_id === filters.studentId) &&
        (!filters.pendingApprovalOnly || submission.status === "ai_degerlendirildi"),
    );
  }

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
/*  Ogrenci sonuclari ve gelisimi                                             */
/* -------------------------------------------------------------------------- */

export interface StudentResultSummary {
  exam: Exam;
  attempt: ExamAttempt;
}

/** Yalnizca egitmen onayi tamamlanmis sinav sonuclarini dondurur. */
export async function getStudentResults(): Promise<StudentResultSummary[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();
  const { data: attempts, error } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("status", "sonuclandi")
    .order("completed_at", { ascending: false });

  if (error || !attempts || attempts.length === 0) return [];

  const examIds = [...new Set(attempts.map((attempt) => attempt.exam_id))];
  const { data: exams } = await supabase.from("exams").select("*").in("id", examIds);
  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));

  return attempts
    .map((attempt) => {
      const exam = examById.get(attempt.exam_id);
      return exam ? { exam, attempt } : null;
    })
    .filter((item): item is StudentResultSummary => item !== null);
}

export interface StudentGrowthTopic {
  topic: string;
  subject: string;
  outcomeId: string | null;
  outcomeText: string | null;
  averageScore: number;
  approvedAnswerCount: number;
}

/** Egitmen onayli cevaplardan kazanim (yoksa konu) bazli gelisimi hesaplar. */
export async function getStudentGrowth(): Promise<StudentGrowthTopic[]> {
  if (!isSupabaseConfigured) return [];
  const current = await getCurrentUser();
  if (!current) return [];

  const supabase = await createServerSupabaseClient();
  const { data: completedAttempts, error: attemptError } = await supabase
    .from("exam_attempts")
    .select("exam_id")
    .eq("student_id", current.user.id)
    .eq("status", "sonuclandi");
  if (attemptError || !completedAttempts?.length) return [];

  const completedExamIds = completedAttempts.map((attempt) => attempt.exam_id);
  const ownSubmissions = await getOwnSubmissions(supabase);

  const completedExamSet = new Set(completedExamIds);
  const approved = ownSubmissions.filter(
    (submission) =>
      completedExamSet.has(submission.exam_id) &&
      submission.status === "egitmen_onayli" &&
      submission.question_id !== null &&
      submission.instructor_approved_score !== null,
  );
  if (approved.length === 0) return [];

  const questionIds = approved.map((submission) => submission.question_id as string);
  const examIds = [...new Set(approved.map((submission) => submission.exam_id))];
  const safeResults = await Promise.all(
    examIds.map((examId) =>
      supabase.rpc("get_student_exam_questions", { target_exam: examId }),
    ),
  );
  const safeQuestions = safeResults.flatMap((result) => result.data ?? []);
  const questions =
    safeQuestions.length > 0
      ? safeQuestions
      : (
          await supabase
            .from("questions")
            .select("id, topic, subject, outcome_id")
            .in("id", questionIds)
        ).data ?? [];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const outcomeIds = [
    ...new Set(
      questions
        .map((question) => question.outcome_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const { data: outcomes } = outcomeIds.length
    ? await supabase
        .from("learning_outcomes")
        .select("id, outcome_text")
        .in("id", outcomeIds)
    : { data: [] };
  const outcomeById = new Map(
    (outcomes ?? []).map((outcome) => [outcome.id, outcome.outcome_text]),
  );
  const buckets = new Map<
    string,
    {
      topic: string;
      subject: string;
      outcomeId: string | null;
      outcomeText: string | null;
      scores: number[];
    }
  >();

  for (const submission of approved) {
    const question = submission.question_id
      ? questionById.get(submission.question_id)
      : null;
    if (!question || submission.instructor_approved_score === null) continue;
    const outcomeText = question.outcome_id
      ? outcomeById.get(question.outcome_id) ?? null
      : null;
    const key = question.outcome_id ?? `${question.subject}\u0000${question.topic}`;
    const bucket = buckets.get(key) ?? {
      topic: question.topic,
      subject: question.subject,
      outcomeId: question.outcome_id,
      outcomeText,
      scores: [],
    };
    bucket.scores.push(submission.instructor_approved_score);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      topic: bucket.topic,
      subject: bucket.subject,
      outcomeId: bucket.outcomeId,
      outcomeText: bucket.outcomeText,
      averageScore:
        Math.round(
          (bucket.scores.reduce((total, score) => total + score, 0) /
            bucket.scores.length) *
            10,
        ) / 10,
      approvedAnswerCount: bucket.scores.length,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
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

/**
 * Karara baglanmayi bekleyen rol talepleri.
 *
 * Yalnizca egitim yoneticisi anlamli bir sonuc alir; digerlerinde RLS
 * satirlari zaten filtreler. Demo modunda bos doner - mock veride bekleyen
 * talep yok.
 */
export async function getRoleRequests(): Promise<UserProfile[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("role_status", "beklemede")
    .order("updated_at", { ascending: true });

  return data ?? [];
}

/**
 * Havuzdaki tekil sinif adlari.
 *
 * Ayri bir `classrooms` tablosu yok: sinif ogrencinin profilinde duran serbest
 * metin. Liste ogrencilerden turetilir, boylece sinifi kalmayan bir derslik
 * kendiliginden kaybolur.
 */
export async function getClassrooms(): Promise<string[]> {
  const users = await getUsers();

  return [
    ...new Set(
      users
        .filter((user) => user.role === "ogrenci" && user.classroom)
        .map((user) => user.classroom as string),
    ),
  ].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Bir sinavin atandigi ogrencilerin kimlikleri. */
export async function getExamAssignedStudentIds(examId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("exam_assignments")
    .select("student_id")
    .eq("exam_id", examId);

  return (data ?? []).map((row) => row.student_id);
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

/* -------------------------------------------------------------------------- */
/*  Sinif bazli sinav kontrolu                                                */
/* -------------------------------------------------------------------------- */

/**
 * Egitmenin kontrol ekranindaki bir kutucuk: "Derslik-3 - Biyoloji Sinavi".
 *
 * Egitmen tek tek cevap onaylamak yerine ONCE bir sinif+sinav kutusuna girer,
 * sonra o sinavi butun olarak degerlendirir. Bu tip o kutunun ozetidir.
 */
export interface ClassroomExamReview {
  classroom: string;
  exam: Exam;
  /** Sinavin atandigi, bu sinifta bulunan ogrenci sayisi. */
  assignedCount: number;
  /** Sinavi teslim etmis ogrenci sayisi. */
  submittedCount: number;
  /** Egitmen onayi bekleyen cevap sayisi. */
  pendingCount: number;
  /** Onaylanmis cevap sayisi. */
  approvedCount: number;
  /** Sonuclanmis denemelerin puan ortalamasi; henuz yoksa null. */
  averageScore: number | null;
}

/**
 * Egitmenin gorebildigi her (sinif, sinav) ciftini ozetler.
 *
 * Kutucuklar ATAMALARDAN turetilir: bir sinav bir sinifa atanmamissa o
 * sinif icin kutu hic olusmaz. Boylece "ici bos derslik" gorunmez.
 */
export async function getClassroomExamReviews(): Promise<ClassroomExamReview[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();

  const [exams, users] = await Promise.all([getExams(), getUsers()]);
  if (exams.length === 0) return [];

  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const classroomOf = new Map(users.map((user) => [user.id, user.classroom]));

  const examIds = exams.map((exam) => exam.id);

  const [assignmentRows, attemptRows, submissionRows] = await Promise.all([
    supabase.from("exam_assignments").select("exam_id, student_id").in("exam_id", examIds),
    supabase
      .from("exam_attempts")
      .select("exam_id, student_id, status, final_score")
      .in("exam_id", examIds),
    supabase
      .from("submissions")
      .select("exam_id, student_id, status")
      .in("exam_id", examIds),
  ]);

  /** "<examId> <sinif>" -> birikmis sayaclar. */
  const buckets = new Map<
    string,
    {
      classroom: string;
      exam: Exam;
      students: Set<string>;
      submitted: Set<string>;
      pending: number;
      approved: number;
      scores: number[];
    }
  >();

  function bucketFor(examId: string, studentId: string) {
    const classroom = classroomOf.get(studentId);
    const exam = examById.get(examId);
    // Sinifi atanmamis ogrenci veya gorulemeyen sinav kutu olusturmaz.
    if (!classroom || !exam) return null;

    const key = `${examId} ${classroom}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        classroom,
        exam,
        students: new Set(),
        submitted: new Set(),
        pending: 0,
        approved: 0,
        scores: [],
      };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  for (const row of assignmentRows.data ?? []) {
    bucketFor(row.exam_id, row.student_id)?.students.add(row.student_id);
  }

  for (const row of attemptRows.data ?? []) {
    const bucket = bucketFor(row.exam_id, row.student_id);
    if (!bucket) continue;

    // Atama silinmis ama deneme duruyorsa ogrenci yine de sayilmali.
    bucket.students.add(row.student_id);

    if (row.status !== "devam_ediyor") bucket.submitted.add(row.student_id);
    if (row.status === "sonuclandi" && row.final_score !== null) {
      bucket.scores.push(row.final_score);
    }
  }

  for (const row of submissionRows.data ?? []) {
    const bucket = bucketFor(row.exam_id, row.student_id);
    if (!bucket) continue;

    if (row.status === "ai_degerlendirildi") bucket.pending += 1;
    if (row.status === "egitmen_onayli") bucket.approved += 1;
  }

  return [...buckets.values()]
    .map((bucket) => ({
      classroom: bucket.classroom,
      exam: bucket.exam,
      assignedCount: bucket.students.size,
      submittedCount: bucket.submitted.size,
      pendingCount: bucket.pending,
      approvedCount: bucket.approved,
      averageScore:
        bucket.scores.length > 0
          ? Math.round(
              (bucket.scores.reduce((sum, score) => sum + score, 0) /
                bucket.scores.length) *
                10,
            ) / 10
          : null,
    }))
    // Once onay bekleyenler; esitse sinif adina gore.
    .sort(
      (a, b) =>
        b.pendingCount - a.pendingCount ||
        a.classroom.localeCompare(b.classroom, "tr") ||
        a.exam.title.localeCompare(b.exam.title, "tr"),
    );
}

/** Kontrol ekraninda tek bir ogrencinin sinav butunu. */
export interface StudentExamReview {
  studentId: string;
  studentName: string;
  attempt: ExamAttempt | null;
  /** Ogrencinin bu sinavdaki cevaplari, soru sirasina gore. */
  submissions: Submission[];
  pendingCount: number;
  /** AI on puan ortalamasi (0-100). */
  aiAverage: number | null;
  /** Egitmen onayli puan ortalamasi (0-100); hic onay yoksa null. */
  approvedAverage: number | null;
}

export interface ClassroomExamDetail {
  classroom: string;
  exam: Exam;
  questions: (Question & { points: number; position: number })[];
  students: StudentExamReview[];
  /** Sinif genelinde onay bekleyen cevap sayisi. */
  pendingCount: number;
}

/**
 * Bir sinifin bir sinavdaki tum cevaplarini tek seferde getirir.
 *
 * Egitmen "Derslik-3 / Biyoloji" kutusuna girdiginde ekranin butun verisi
 * budur: sinavin sorulari, sinifin ogrencileri ve her ogrencinin cevaplari.
 */
export async function getClassroomExamDetail(
  classroom: string,
  examId: string,
): Promise<ClassroomExamDetail | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createServerSupabaseClient();

  const [detail, users] = await Promise.all([getExamDetail(examId), getUsers()]);
  if (!detail) return null;

  const inClassroom = users.filter((user) => user.classroom === classroom);
  if (inClassroom.length === 0) return null;

  const studentIds = inClassroom.map((user) => user.id);

  const [assignmentRows, attemptRows, submissionRows] = await Promise.all([
    supabase
      .from("exam_assignments")
      .select("student_id")
      .eq("exam_id", examId)
      .in("student_id", studentIds),
    supabase
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", examId)
      .in("student_id", studentIds),
    supabase
      .from("submissions")
      .select("*")
      .eq("exam_id", examId)
      .in("student_id", studentIds),
  ]);

  const attemptOf = new Map(
    (attemptRows.data ?? []).map((attempt) => [attempt.student_id, attempt]),
  );

  const submissionsOf = new Map<string, Submission[]>();
  for (const submission of submissionRows.data ?? []) {
    const list = submissionsOf.get(submission.student_id) ?? [];
    list.push(submission);
    submissionsOf.set(submission.student_id, list);
  }

  // Sinav sirasi soru sirasidir; cevaplar buna gore dizilir ki her ogrenci
  // satirinda 1., 2., 3. soru ayni yerde olsun.
  const orderOf = new Map(detail.questions.map((q, index) => [q.id, index]));

  // Sinavi alan herkes listelenir: atanmis olanlar + atama silinmis olsa da
  // cevabi/denemesi bulunanlar.
  const relevant = new Set([
    ...(assignmentRows.data ?? []).map((row) => row.student_id),
    ...attemptOf.keys(),
    ...submissionsOf.keys(),
  ]);

  const students: StudentExamReview[] = inClassroom
    .filter((user) => relevant.has(user.id))
    .map((user) => {
      const submissions = (submissionsOf.get(user.id) ?? []).sort(
        (a, b) =>
          (orderOf.get(a.question_id ?? "") ?? Number.MAX_SAFE_INTEGER) -
          (orderOf.get(b.question_id ?? "") ?? Number.MAX_SAFE_INTEGER),
      );

      const aiScores = submissions
        .map((submission) => submission.ai_score)
        .filter((score): score is number => score !== null);

      const approvedScores = submissions
        .map((submission) => submission.instructor_approved_score)
        .filter((score): score is number => score !== null);

      return {
        studentId: user.id,
        studentName: user.full_name || user.email || "Bilinmiyor",
        attempt: attemptOf.get(user.id) ?? null,
        submissions,
        pendingCount: submissions.filter(
          (submission) => submission.status === "ai_degerlendirildi",
        ).length,
        aiAverage: average(aiScores),
        approvedAverage: average(approvedScores),
      };
    })
    .sort(
      (a, b) =>
        b.pendingCount - a.pendingCount ||
        a.studentName.localeCompare(b.studentName, "tr"),
    );

  return {
    classroom,
    exam: detail.exam,
    questions: detail.questions,
    students,
    pendingCount: students.reduce((sum, student) => sum + student.pendingCount, 0),
  };
}

/** Bos diziyi 0 yerine null sayar - "hic puan yok" ile "0 puan" ayri seyler. */
function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/*  Ders yetkisi                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Sistemde gecen ders adlari.
 *
 * Ayri bir "dersler" tablosu YOK: dersler soru havuzundan turetilir, tipki
 * havuzdaki kutucuklar gibi. Boylece icerik uzmani yeni bir ders adiyla soru
 * uretince o ders kendiliginden secilebilir hale gelir; altinda sorusu
 * olmayan ders ise hic gorunmez.
 */
export async function getSubjectOptions(): Promise<string[]> {
  const questions = await getQuestions();

  const seen = new Map<string, string>();
  for (const question of questions) {
    const subject = question.subject?.trim();
    if (!subject) continue;
    // Ayni dersin farkli yazimlarini tek kayda indir ("Matematik"/"matematik").
    seen.set(subject.toLocaleLowerCase("tr"), subject);
  }

  const exams = await getExams();
  for (const exam of exams) {
    const subject = exam.subject?.trim();
    if (!subject) continue;
    seen.set(subject.toLocaleLowerCase("tr"), subject);
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Etkin kullanicinin yetkili oldugu dersler. */
export async function getMySubjects(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("my_subjects");

  // RPC henuz kurulmamis ortamlarda (migration calistirilmadi) bos don:
  // profil ekrani "ders atanmamis" der, hata gostermez.
  if (error) return [];
  return data ?? [];
}

/**
 * Kullanici kimligi -> yetkili oldugu dersler.
 *
 * Sistem yoneticisinin kullanici tablosu icin. Tabloyu satir basina sorgu
 * atmadan doldurabilmek adina tek okumada gelir.
 */
export async function getInstructorSubjectMap(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured) return {};

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("instructor_subjects")
    .select("user_id, subject");

  if (error) return {};

  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (map[row.user_id] ??= []).push(row.subject);
  }

  for (const subjects of Object.values(map)) {
    subjects.sort((a, b) => a.localeCompare(b, "tr"));
  }

  return map;
}
