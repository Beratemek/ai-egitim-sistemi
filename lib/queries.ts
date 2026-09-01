/**
 * Sunucu tarafi okuma katmani.
 *
 * Her fonksiyon Supabase yapilandirilmamissa `lib/mock-data.ts` icindeki demo
 * veriye duser; boylece anahtar girmeden klonlanan proje de calisir hale gelir.
 * Sayfalar dogrudan `supabase.from(...)` cagirmaz, hep buradan okur.
 */

import { cache } from "react";

import {
  courseFeedbackPeriodKey,
  courseFeedbackScopeKey,
} from "@/lib/course-feedback";
import { bookletOptions, bookletQuestionOrder, isBooklet } from "@/lib/booklet";
import { isSupabaseConfigured } from "@/lib/env";
import { ALL_SUBJECTS, subjectKey } from "@/lib/subjects";
import { selectStyleScope, type StyleScopeInput } from "@/lib/style-scope";
import { analyzeOutcomes, type OutcomeAnalysisRow } from "@/lib/outcome-analysis";
import {
  computeActualResults,
  summarizeCalibration,
  type CalibrationEntry,
  type CalibrationSummary,
} from "@/lib/exam-calibration";
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
  CourseExperienceFeedback,
  Exam,
  ExamAssignment,
  ExamAttempt,
  ExamQuestion,
  ExamStatistics,
  LearningOutcome,
  PreferenceStats,
  Question,
  QuestionOption,
  QuestionPreference,
  QuestionStatus,
  QuestionType,
  StyleGuide,
  Submission,
  UserProfile,
} from "@/lib/types";
import type { QuestionVisual } from "@/lib/visual";

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

export const getQuestions = cache(async function getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
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
})

/* -------------------------------------------------------------------------- */
/*  Sinavlar                                                                  */
/* -------------------------------------------------------------------------- */

export const getExams = cache(async function getExams(options: {
  onlyPublished?: boolean;
  /** Arsivlenmis sinavlar da dahil edilsin mi? Varsayilan: hayir. */
  includeArchived?: boolean;
} = {}): Promise<Exam[]> {
  if (!isSupabaseConfigured) {
    return MOCK_EXAMS.filter((exam) => !options.onlyPublished || exam.is_published);
  }

  const supabase = await createServerSupabaseClient();
  let query = supabase.from("exams").select("*").order("created_at", { ascending: false });

  if (options.onlyPublished) query = query.eq("is_published", true);

  const { data } = await query;
  const exams = data ?? [];

  /*
   * Arsiv suzgeci SQL'de DEGIL burada.
   *
   * `.is("archived_at", null)` yazilsaydi, uygulandi/2026-08-26-sinav-arsivi.sql
   * uygulanmadan once sutun olmadigi icin PostgREST 400 doner ve sinav
   * listesi tamamen bosalirdi. Sutun yoksa alan `undefined` gelir, hicbir
   * sinav elenmez; yani migration beklerken davranis aynen korunur.
   */
  if (options.includeArchived) return exams;
  return exams.filter((exam) => !exam.archived_at);
})

export interface ExamDetail {
  exam: Exam;
  /** Kopmuş bağlantıları da kalite kontrolünde görebilmek için ham bağlar. */
  examQuestions: ExamQuestion[];
  /** Sinavdaki sorular, `position` sirasina gore. */
  questions: (Question & { points: number; position: number })[];
}

export async function getExamDetail(examId: string): Promise<ExamDetail | null> {
  if (!isSupabaseConfigured) {
    const exam = MOCK_EXAMS.find((item) => item.id === examId);
    if (!exam) return null;

    return {
      exam,
      examQuestions: MOCK_QUESTIONS.filter((q) => q.status === "onayli").map(
        (question, index) => ({
          exam_id: examId,
          question_id: question.id,
          points: 10,
          position: index,
        }),
      ),
      questions: MOCK_QUESTIONS.filter((q) => q.status === "onayli").map(
        (question, index) => ({ ...question, points: 10, position: index }),
      ),
    };
  }

  const supabase = await createServerSupabaseClient();

  // Sinav ile soru baglantilari birbirine bagli degil; sirali beklemek bir
  // tur (uzak Supabase ornekte yaklasik 150 ms) fazladan maliyetti.
  const [{ data: exam }, { data: links }] = await Promise.all([
    supabase.from("exams").select("*").eq("id", examId).maybeSingle(),
    supabase
      .from("exam_questions")
      .select("exam_id, question_id, position, points")
      .eq("exam_id", examId)
      .order("position", { ascending: true }),
  ]);

  if (!exam) return null;

  const questionIds = (links ?? []).map((link) => link.question_id);
  if (questionIds.length === 0) return { exam, examQuestions: [], questions: [] };

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

  return { exam, examQuestions: links ?? [], questions: ordered };
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

  const [supabase, current] = await Promise.all([
    createServerSupabaseClient(),
    getCurrentUser(),
  ]);

  if (!current) return [];

  // Kimlik filtresi ACIKCA veriliyor; RLS ayricalikli hesaplarda daha genis
  // oldugu icin baskasinin atamasi bu listeye karisabiliyordu.
  const assignmentResult = await supabase
    .from("exam_assignments")
    .select("*")
    .eq("student_id", current.user.id);
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
    supabase
      .from("exam_attempts")
      .select("*")
      .in("exam_id", examIds)
      .eq("student_id", current.user.id),
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
  /**
   * Sorunun dersi. Kitapcik karistirmasi bu grubun ICINDE kalir: bir sinav
   * birden fazla dersten soru tasiyabilir ve ogrenci hala "once Biyoloji,
   * sonra Robotik" gormelidir.
   */
  subject: string;
  topic: string;
  text: string;
  type: QuestionType;
  options_json: QuestionOption[] | null;
  /**
   * Soru gorseli.
   *
   * Guvenli RPC bu alani ancak gorsel migration'i uygulandiktan sonra
   * donduruyor; oncesinde undefined gelir ve `?? null` ile bosaltilir.
   */
  visual_json: QuestionVisual | null;
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
          subject: question.subject,
          topic: question.topic,
          text: question.text,
          type: question.type,
          options_json: question.options_json,
          visual_json: question.visual_json,
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

  const [supabase, current] = await Promise.all([
    createServerSupabaseClient(),
    getCurrentUser(),
  ]);

  if (!current) return null;

  /*
    Ogrenci kimligiyle ACIKCA filtreleniyor.

    Onceden yalnizca `exam_id` ile sorulup kapsama RLS'e birakiliyordu. Ama
    RLS ayricalikli kullanicilarda GENIS: egitmen ya da yonetici rolu de
    olan bir hesap sinavin BUTUN atamalarini goruyor. O durumda
    `.maybeSingle()` "birden fazla satir" hatasi veriyor, `data` null
    donuyor ve atama yokmus gibi davraniliyordu. Sonuc: sinava baslama
    paneli hic cikmiyor, sorular da bos geliyordu (soru RPC'si denemesi
    olmayan ogrenciye satir dondurmez) ve ekranda "bu sinava henuz soru
    eklenmemis" yaziyordu - oysa sinavda 50 soru vardi.
  */
  const [assignmentResult, attemptResult] = await Promise.all([
    supabase
      .from("exam_assignments")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", current.user.id)
      .maybeSingle(),
    supabase
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", current.user.id)
      .maybeSingle(),
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
        .select("id, subject, topic, text, type, options_json, visual_json")
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
        // Guvenli RPC `subject` alanini zaten donduruyordu, arayuze
        // tasinmiyordu; kitapcik karistirmasinin ders sinirini bilmesi icin
        // gerekli.
        subject: question.subject ?? "",
        topic: question.topic,
        text: question.text,
        type: question.type,
        options_json: question.options_json,
        visual_json: question.visual_json ?? null,
        position: link.position,
        points: link.points,
      };
    })
    .filter((item): item is StudentQuestion => item !== null);

  /*
    KITAPCIK.

    Ogrenciye atanmis harf (`exam_assignments.booklet`) varsa sorular ve
    siklar ona gore karistirilir. Karistirma BURADA yapiliyor cunku ogrenci
    sinavini okuyan tek yol bu fonksiyon - sayfa da, cevap formu da ayni
    diziyi goruyor ve sira hicbir yerde ikinci kez hesaplanmiyor.

    Harf yoksa (uygulandi/2026-08-26-kitapcik.sql henuz uygulanmamis ya da eski bir
    atama) hicbir sey karistirilmaz: sinav bugunku gibi calisir.
  */
  const booklet = assignmentResult.data?.booklet;
  const sorular = isBooklet(booklet)
    ? bookletQuestionOrder(ordered, examId, booklet).map((question) => ({
        ...question,
        options_json: question.options_json
          ? bookletOptions(question.options_json, examId, question.id, booklet)
          : null,
      }))
    : ordered;

  return {
    exam: effectiveExam,
    questions: sorular,
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
  courseFeedback: CourseExperienceFeedback | null;
}

/** Yalnizca egitmen onayi tamamlanmis sinav sonuclarini dondurur. */
export async function getStudentResults(): Promise<StudentResultSummary[]> {
  if (!isSupabaseConfigured) return [];

  const [supabase, current] = await Promise.all([
    createServerSupabaseClient(),
    getCurrentUser(),
  ]);

  if (!current) return [];

  /*
    Kimlik filtresi ACIKCA veriliyor. Kapsam RLS'e birakilsaydi, egitmen ya
    da yonetici rolu de olan bir hesap BASKA ogrencilerin sonuclarini kendi
    "Sonuclarim" ekraninda gorurdu - exam_attempts politikasi o roller icin
    sinifin tamamini aciyor.
  */
  const { data: attempts, error } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("student_id", current.user.id)
    .eq("status", "sonuclandi")
    .order("completed_at", { ascending: false });

  if (error || !attempts || attempts.length === 0) return [];

  const examIds = [...new Set(attempts.map((attempt) => attempt.exam_id))];
  const [{ data: exams }, feedbackResult] = await Promise.all([
    supabase.from("exams").select("*").in("id", examIds),
    supabase
      .from("course_experience_feedback")
      .select("*")
      .eq("student_id", current.user.id),
  ]);
  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));
  const feedbackByScope = new Map(
    (feedbackResult.data ?? []).map((feedback) => [
      courseFeedbackScopeKey(
        feedback.instructor_id,
        feedback.subject,
        feedback.academic_period,
      ),
      feedback,
    ]),
  );

  return attempts
    .map((attempt) => {
      const exam = examById.get(attempt.exam_id);
      if (!exam) return null;

      const period = attempt.completed_at
        ? courseFeedbackPeriodKey(attempt.completed_at)
        : null;
      const courseFeedback = period
        ? feedbackByScope.get(
            courseFeedbackScopeKey(
              exam.instructor_id,
              exam.subject ?? "Ders belirtilmemiş",
              period,
            ),
          ) ?? null
        : null;

      return { exam, attempt, courseFeedback };
    })
    .filter((item): item is StudentResultSummary => item !== null);
}

export interface CourseFeedbackSummary {
  instructorId: string;
  instructorName: string;
  subject: string;
  academicPeriod: string;
  responseCount: number;
  clarityAverage: number | null;
  paceAverage: number | null;
  materialsAverage: number | null;
  assessmentFairnessAverage: number | null;
  overallAverage: number | null;
  helpfulComments: string[];
  improvementComments: string[];
}

/** Eğitmen ve yöneticinin yalnızca anonim, eşik uygulanmış özetini döndürür. */
export async function getCourseFeedbackSummaries(): Promise<
  CourseFeedbackSummary[]
> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "get_course_experience_feedback_summary",
  );
  if (error || !data) return [];

  return data.map((row) => ({
    instructorId: row.instructor_id,
    instructorName: row.instructor_name,
    subject: row.subject,
    academicPeriod: row.academic_period,
    responseCount: Number(row.response_count),
    clarityAverage: row.clarity_average,
    paceAverage: row.pace_average,
    materialsAverage: row.materials_average,
    assessmentFairnessAverage: row.assessment_fairness_average,
    overallAverage: row.overall_average,
    helpfulComments: Array.isArray(row.helpful_comments)
      ? row.helpful_comments.filter(
          (comment): comment is string => typeof comment === "string",
        )
      : [],
    improvementComments: Array.isArray(row.improvement_comments)
      ? row.improvement_comments.filter(
          (comment): comment is string => typeof comment === "string",
        )
      : [],
  }));
}

export interface StudentGrowthTopic {
  topic: string;
  subject: string;
  outcomeId: string | null;
  outcomeText: string | null;
  averageScore: number;
  approvedAnswerCount: number;
  /** Bu alanla ilgili en son tamamlanan sinav; geri bildirim aksiyonunun hedefi. */
  latestExamId: string | null;
  /** Ilk ve son tamamlanan sinavdaki alan ortalamasi arasindaki fark. */
  scoreChange: number | null;
}

/** Egitmen onayli cevaplardan kazanim (yoksa konu) bazli gelisimi hesaplar. */
export async function getStudentGrowth(): Promise<StudentGrowthTopic[]> {
  if (!isSupabaseConfigured) return [];
  const current = await getCurrentUser();
  if (!current) return [];

  const supabase = await createServerSupabaseClient();
  const { data: completedAttempts, error: attemptError } = await supabase
    .from("exam_attempts")
    .select("exam_id, completed_at")
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
  const safeQuestions = safeResults.flatMap((result, index) =>
    (result.data ?? []).map((question) => ({
      ...question,
      examId: examIds[index],
    })),
  );
  const fallbackQuestions =
    safeQuestions.length > 0
      ? []
      : (
          await supabase
            .from("questions")
            .select("id, topic, subject, outcome_id")
            .in("id", questionIds)
        ).data ?? [];
  const questions =
    safeQuestions.length > 0
      ? safeQuestions
      : fallbackQuestions.flatMap((question) =>
          examIds.map((examId) => ({ ...question, examId, points: 1 })),
        );
  const questionByExamAndId = new Map(
    questions.map((question) => [`${question.examId}:${question.id}`, question]),
  );
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
      entries: Array<{
        score: number;
        points: number;
        examId: string;
        completedAt: string | null;
      }>;
    }
  >();

  const completedAtByExam = new Map(
    completedAttempts.map((attempt) => [attempt.exam_id, attempt.completed_at]),
  );

  for (const submission of approved) {
    const question = submission.question_id
      ? questionByExamAndId.get(`${submission.exam_id}:${submission.question_id}`)
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
      entries: [],
    };
    bucket.entries.push({
      score: Math.min(100, Math.max(0, submission.instructor_approved_score)),
      points: Math.max(0, question.points ?? 1),
      examId: submission.exam_id,
      completedAt: completedAtByExam.get(submission.exam_id) ?? null,
    });
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => {
      const pointTotal = bucket.entries.reduce(
        (total, entry) => total + entry.points,
        0,
      );
      const weightedTotal = bucket.entries.reduce(
        (total, entry) => total + entry.score * entry.points,
        0,
      );
      const averageScore =
        Math.round(
          (pointTotal > 0
            ? weightedTotal / pointTotal
            : bucket.entries.reduce((total, entry) => total + entry.score, 0) /
              bucket.entries.length) * 10,
        ) / 10;

      const byExam = new Map<
        string,
        { weightedTotal: number; pointTotal: number; completedAt: string | null }
      >();
      for (const entry of bucket.entries) {
        const current = byExam.get(entry.examId) ?? {
          weightedTotal: 0,
          pointTotal: 0,
          completedAt: entry.completedAt,
        };
        current.weightedTotal += entry.score * entry.points;
        current.pointTotal += entry.points;
        byExam.set(entry.examId, current);
      }

      const history = [...byExam.entries()]
        .map(([examId, entry]) => ({
          examId,
          completedAt: entry.completedAt,
          score: entry.pointTotal > 0 ? entry.weightedTotal / entry.pointTotal : 0,
        }))
        .sort(
          (a, b) =>
            new Date(a.completedAt ?? 0).getTime() -
            new Date(b.completedAt ?? 0).getTime(),
        );
      const first = history[0];
      const latest = history.at(-1);

      return {
        topic: bucket.topic,
        subject: bucket.subject,
        outcomeId: bucket.outcomeId,
        outcomeText: bucket.outcomeText,
        averageScore,
        approvedAnswerCount: bucket.entries.length,
        latestExamId: latest?.examId ?? null,
        scoreChange:
          first && latest && first.examId !== latest.examId
            ? Math.round((latest.score - first.score) * 10) / 10
            : null,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);
}

/* -------------------------------------------------------------------------- */
/*  Kullanicilar                                                              */
/* -------------------------------------------------------------------------- */

export const getUsers = cache(async function getUsers(): Promise<UserProfile[]> {
  if (!isSupabaseConfigured) return [...MOCK_USERS];

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });

  return data ?? [];
})

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

/* -------------------------------------------------------------------------- */
/*  Kestirim kalibrasyonu                                                     */
/* -------------------------------------------------------------------------- */

export interface ExamCalibrationData {
  /** Bu sinav icin en son kestirim ve -varsa- gerceklesen sonuc. */
  latest: CalibrationEntry | null;
  /** Egitmenin olculmus butun kestirimlerinden ozet; hic yoksa null. */
  summary: CalibrationSummary | null;
  /**
   * Kayit tablosu erisilebilir mi.
   *
   * `false` ise migration henuz uygulanmamis demektir (bkz.
   * supabase/migrations/BEKLEYEN-1-sinav-kestirimi.sql). Arayuz bunu
   * "kalibrasyon kapali" diye gosterir; hata olarak degil, cunku kestirimin
   * kendisi bu tablo olmadan da calisir.
   */
  available: boolean;
}

const BOS_KALIBRASYON: ExamCalibrationData = {
  latest: null,
  summary: null,
  available: false,
};

/** Kalibrasyon hesabina alinacak en fazla sinav sayisi. */
const CALIBRATION_EXAM_LIMIT = 20;

/**
 * Kestirim tahminlerini gerceklesen sonuclarla karsilastirir.
 *
 * HER SINAVDAN YALNIZCA EN SON KESTIRIM sayilir. Ayni sinav uzerinde bes kez
 * kestirim calistirilirsa ve sinav bir kez yapilirsa, bes kaydin hepsini
 * ozete katmak o tek sinavi bes kat agirlikli yapardi; ozet de en cok
 * denenen sinava dogru kayardi.
 */
export async function getExamCalibration(
  examId: string,
): Promise<ExamCalibrationData> {
  if (!isSupabaseConfigured) return BOS_KALIBRASYON;

  const supabase = await createServerSupabaseClient();

  const simulationsResult = await supabase
    .from("exam_simulations")
    .select("id, exam_id, cohort_kind, cohort_label, predicted_average, student_count, created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  // Tablo yoksa ya da okunamiyorsa kestirim calismaya devam eder.
  if (simulationsResult.error || !simulationsResult.data) return BOS_KALIBRASYON;

  const sonKestirimler = new Map<string, (typeof simulationsResult.data)[number]>();
  for (const row of simulationsResult.data) {
    if (!sonKestirimler.has(row.exam_id)) sonKestirimler.set(row.exam_id, row);
  }

  const secilen = [...sonKestirimler.values()].slice(0, CALIBRATION_EXAM_LIMIT);
  if (secilen.length === 0) return { latest: null, summary: null, available: true };

  const examIds = secilen.map((row) => row.exam_id);

  const [examsResult, linksResult, submissionsResult] = await Promise.all([
    supabase.from("exams").select("id, title").in("id", examIds),
    supabase.from("exam_questions").select("exam_id, question_id, points").in("exam_id", examIds),
    supabase
      .from("submissions")
      .select("exam_id, student_id, question_id, instructor_approved_score, status")
      .in("exam_id", examIds)
      .limit(8_000),
  ]);

  const titleById = new Map(
    (examsResult.data ?? []).map((exam) => [exam.id, exam.title]),
  );

  const actualByExam = new Map(
    computeActualResults(
      (submissionsResult.data ?? []).map((submission) => ({
        examId: submission.exam_id,
        studentId: submission.student_id,
        questionId: submission.question_id,
        approvedScore: submission.instructor_approved_score,
        status: submission.status,
      })),
      (linksResult.data ?? []).map((link) => ({
        examId: link.exam_id,
        questionId: link.question_id,
        points: link.points,
      })),
    ).map((result) => [result.examId, result]),
  );

  const entries: CalibrationEntry[] = secilen.map((row) => {
    const actual = actualByExam.get(row.exam_id) ?? null;
    return {
      simulationId: row.id,
      examId: row.exam_id,
      examTitle: titleById.get(row.exam_id) ?? "Sınav",
      cohortKind: row.cohort_kind,
      cohortLabel: row.cohort_label,
      predicted: Number(row.predicted_average),
      actual: actual?.average ?? null,
      studentCount: actual?.studentCount ?? 0,
      createdAt: row.created_at,
    };
  });

  return {
    latest: entries.find((entry) => entry.examId === examId) ?? null,
    summary: summarizeCalibration(entries),
    available: true,
  };
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
/** En fazla kac gecmis kayit taranir. Tek sorgu, bellekte kapsama ayrilir. */
const TARAMA_SINIRI = 200;

/**
 * Icerik uzmaninin tarz hafizasini KAPSAMA GORE getirir.
 *
 * Onceden hicbir filtre yoktu: son 6 begeni + son 6 red, ders ayrimi olmadan
 * modele gidiyordu. Sonuc, tarih dersinde "sozel olsun" diye verilen geri
 * bildirimin matematik uretimini de sekillendirmesiydi - iki dersin soru
 * tarzi ayni olmadigi icin bu bir kusurdu.
 *
 * Kademeli daralma:
 *
 *   1. AYNI DERS + AYNI KONU  - en az 2 ornek varsa yalnizca bunlar
 *   2. AYNI DERS              - en az 1 ornek varsa yalnizca bunlar
 *   3. GENEL                  - ders hakkinda hic geri bildirim yoksa
 *
 * 3. adima yalnizca ders TAMAMEN bossa dusuluyor: o derste tek bir ornek bile
 * varsa baska derslerin tarzi karismiyor. Hicbir ornek olmamasi, yanlis
 * dersin ornegini almaktan iyi degil - bu yuzden son basamak duruyor.
 */
export async function getStyleGuide(
  scope: StyleScopeInput = {},
  limit = 6,
): Promise<StyleGuide> {
  if (!isSupabaseConfigured) return { liked: [], disliked: [], scope: "genel" };

  const supabase = await createServerSupabaseClient();

  // Tek sorgu: kapsam ayrimi bellekte yapiliyor. Tablo kullaniciya ozel
  // (RLS user_id = auth.uid()), bu yuzden satir sayisi kucuk kaliyor.
  const { data } = await supabase
    .from("question_preferences")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(TARAMA_SINIRI);

  const { rows, scope: resolvedScope } = selectStyleScope(data ?? [], scope);

  return {
    liked: rows.filter((row) => row.verdict === "begendi").slice(0, limit),
    disliked: rows.filter((row) => row.verdict === "begenmedi").slice(0, limit),
    scope: resolvedScope,
  };
}

/**
 * Tercih kayitlarini (begeni + red) tek listede dondurur.
 *
 * `getStyleGuide` modele verilecek ORNEKLERI ayirir ve az sayida tutar;
 * bu ise arayuzde gosterilip KARARI DEGISTIRILEBILSIN diye var, o yuzden
 * ikisi tek listede ve daha genis bir limitle geliyor.
 */
export async function getPreferences(limit = 50): Promise<QuestionPreference[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("question_preferences")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/** Tercih istatistikleri - arayuzde "AI su kadar ornekten ogrendi" gostergesi. */
export async function getPreferenceStats(): Promise<PreferenceStats> {
  if (!isSupabaseConfigured) return { liked: 0, disliked: 0, bySubject: {} };

  const supabase = await createServerSupabaseClient();

  // Kirilim gerektigi icin sayac sorgusu (head: true) yetmiyor; ders ve
  // karar sutunlari okunup bellekte toplaniyor.
  const { data, error } = await supabase
    .from("question_preferences")
    .select("subject, verdict");

  /*
    `subject` sutunu migration ile geliyor. SQL henuz calistirilmadiysa
    PostgREST "column does not exist" dondurur ve bu sayfa tumuyle patlardi.
    O durumda kirilimsiz sayima dusuluyor: arayuz "ders bazli ornek yok" der,
    calismaya devam eder.
  */
  if (error) {
    const { data: fallback } = await supabase
      .from("question_preferences")
      .select("verdict");

    return (fallback ?? []).reduce<PreferenceStats>(
      (stats, row) => {
        stats[row.verdict === "begendi" ? "liked" : "disliked"] += 1;
        return stats;
      },
      { liked: 0, disliked: 0, bySubject: {} },
    );
  }

  const stats: PreferenceStats = { liked: 0, disliked: 0, bySubject: {} };

  for (const row of data ?? []) {
    const field = row.verdict === "begendi" ? "liked" : "disliked";
    stats[field] += 1;

    if (!row.subject) continue;
    const key = subjectKey(row.subject);
    const bucket = (stats.bySubject[key] ??= { liked: 0, disliked: 0 });
    bucket[field] += 1;
  }

  return stats;
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
/**
 * Sinifi atanmamis ogrencilerin toplandigi kutu.
 *
 * Bu kutu olmasaydi sinifsiz ogrencinin cevaplari kontrol ekranindan HIC
 * erisilemezdi: kutular sinif adindan turedigi icin null sinif satiri
 * sessizce dusurulurdu. Soru havuzundaki "Ders atanmamis" kutusuyla ayni
 * mantik - veri gorunmez olmaktansa adlandirilmis bir kutuda dursun.
 */
export const UNASSIGNED_CLASSROOM = "Sınıf atanmamış";

/** Bilesik Map anahtarlarinda kullanilan ayirac; ders/sinif adlarinda gecmez. */
const KEY_SEPARATOR = "\u0000";

export async function getClassroomExamReviews(): Promise<ClassroomExamReview[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createServerSupabaseClient();

  // Kontrol sayfasi ARSIVLENMISLERI DE gorur: egitmen sinavi listesinden
  // kaldirdiginda cevaplar burada durmaya devam etmeli, yoksa "silinen sinav"
  // ogrencinin verisini de goz onunden kaldirirdi.
  const [exams, users] = await Promise.all([
    getExams({ includeArchived: true }),
    getUsers(),
  ]);
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

  /**
   * "<examId><AYIRAC><sinif>" -> birikmis sayaclar.
   *
   * Ayirac olarak bosluk KULLANILAMAZ: sinif adi bosluk icerebilir
   * ("Derslik 3") ve "a b|c" ile "a|b c" ayni anahtara duserdi.
   */
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
    const exam = examById.get(examId);
    // Gorulemeyen sinav kutu olusturmaz; sinifi olmayan ogrenci ise
    // "Sinif atanmamis" kutusuna duser - bkz. UNASSIGNED_CLASSROOM.
    if (!exam) return null;

    const classroom = classroomOf.get(studentId) || UNASSIGNED_CLASSROOM;

    const key = examId + KEY_SEPARATOR + classroom;
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

  const inClassroom =
    classroom === UNASSIGNED_CLASSROOM
      ? users.filter((user) => !user.classroom)
      : users.filter((user) => user.classroom === classroom);

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

  /**
   * Sorunun sinav icindeki agirligi (puan degeri).
   *
   * Onizleme puani, `recalculate_exam_attempt_result` fonksiyonunun
   * hesapladigi NIHAI notla ayni formulu kullanmali; aksi halde egitmen
   * onaydan once 83, onaydan sonra 85 goruyor ve hangisinin dogru oldugunu
   * bilemiyor.
   */
  const pointsOf = new Map(detail.questions.map((q) => [q.id, q.points]));

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
        .map((submission) => ({
          score: submission.ai_score,
          points: pointsOf.get(submission.question_id ?? "") ?? 0,
        }))
        .filter((entry): entry is { score: number; points: number } =>
          entry.score !== null,
        );

      const approvedScores = submissions
        .map((submission) => ({
          score: submission.instructor_approved_score,
          points: pointsOf.get(submission.question_id ?? "") ?? 0,
        }))
        .filter((entry): entry is { score: number; points: number } =>
          entry.score !== null,
        );

      return {
        studentId: user.id,
        studentName: user.full_name || user.email || "Bilinmiyor",
        attempt: attemptOf.get(user.id) ?? null,
        submissions,
        pendingCount: submissions.filter(
          (submission) => submission.status === "ai_degerlendirildi",
        ).length,
        aiAverage: studentScore(aiScores),
        approvedAverage: studentScore(approvedScores),
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

/**
 * Tek bir ogrencinin sinav puani: soru puanlariyla AGIRLIKLI, TAM SAYI.
 *
 * Iki kural birden:
 *
 * 1. AGIRLIKLI. Duz ortalama, 40 puanlik bir acik uclu soruyla 5 puanlik bir
 *    coktan secmeliyi esit sayardi. Veritabanindaki
 *    `recalculate_exam_attempt_result` her zaman agirlikli hesapliyor; bu
 *    onizleme ondan farkli bir sayi gosterirse egitmen onaydan once ve sonra
 *    iki ayri not gorur.
 *
 * 2. TAM SAYI. Ogrencinin bireysel notu ondalikli olmamali - 83.33 bir sey
 *    anlatmiyor. Yuvarlama yarim degerlerde ogrencinin lehinedir ve tam puani
 *    ERISILEBILIR birakir: kusursuz cevaplanmis bir sinav 100 doner.
 *
 * Tum sorularin puani 0 ise (veri hatasi) duz ortalamaya dusulur; boylece
 * egitmen bos ekran yerine yine de bir sayi gorur.
 */
function studentScore(
  entries: readonly { score: number; points: number }[],
): number | null {
  if (entries.length === 0) return null;

  const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);

  if (totalPoints <= 0) {
    const total = entries.reduce((sum, entry) => sum + entry.score, 0);
    return Math.round(total / entries.length);
  }

  const earned = entries.reduce(
    (sum, entry) => sum + entry.score * entry.points,
    0,
  );

  return Math.round(earned / totalPoints);
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
  // Iki okuma birbirine bagli degil; sirali beklemek bir tur (yaklasik
  // 150 ms) fazladan maliyet demekti.
  const [questions, exams] = await Promise.all([getQuestions(), getExams()]);

  const seen = new Map<string, string>();
  for (const question of questions) {
    const subject = question.subject?.trim();
    // Joker deger bir ders adi degil; secenek listesine dusmemeli.
    if (!subject || subject === ALL_SUBJECTS) continue;
    // Tekillestirme kurali VERITABANIYLA ayni olmali; bkz. lib/subjects.ts.
    seen.set(subjectKey(subject), subject);
  }

  for (const exam of exams) {
    const subject = exam.subject?.trim();
    if (!subject || subject === ALL_SUBJECTS) continue;
    seen.set(subjectKey(subject), subject);
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

/* -------------------------------------------------------------------------- */
/*  Kazanim bazli analiz                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Kazanim bazli basari tablosu.
 *
 * Uc kaynak birlestiriliyor: kazanimlar, sorular (kazanim baglantisi icin) ve
 * cevaplar. Uc ayri sorgu yerine mevcut okuma fonksiyonlari kullaniliyor;
 * `getQuestions` React `cache()` ile sarilmis oldugu icin ayni istekte ikinci
 * kez cagrilirsa veritabanina gitmiyor.
 *
 * Gruplama mantigi `lib/outcome-analysis.ts` icinde ve saf - burada yalnizca
 * veri toplaniyor.
 */
export async function getOutcomeAnalysis(): Promise<OutcomeAnalysisRow[]> {
  const [outcomes, questions, submissions] = await Promise.all([
    getOutcomes(),
    getQuestions(),
    getSubmissions(),
  ]);

  return analyzeOutcomes(outcomes, questions, submissions);
}
