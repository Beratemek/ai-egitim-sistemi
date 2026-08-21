/**
 * Uygulama genelinde kullanilan domain tipleri.
 * `supabase/schema.sql` ile birebir hizali tutulmalidir.
 */

import type { DeneyapCategory } from "@/lib/deneyap";

/* -------------------------------------------------------------------------- */
/*  Roller                                                                    */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = [
  "icerik_uzmani",
  "egitmen",
  "ogrenci",
  "egitim_yoneticisi",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Rol onay durumu.
 *
 * Ogrenci disindaki roller egitim yoneticisi onayi ister; onaya kadar etkin
 * rol 'ogrenci' kalir ve kullanici bekleme ekranina alinir.
 */
export const ROLE_STATUSES = [
  "secilmedi",
  "beklemede",
  "onayli",
  "reddedildi",
] as const;

export type RoleStatus = (typeof ROLE_STATUSES)[number];

export function isRoleStatus(value: unknown): value is RoleStatus {
  return (
    typeof value === "string" && (ROLE_STATUSES as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/*  Enum benzeri birlesim tipleri                                             */
/* -------------------------------------------------------------------------- */

export const QUESTION_TYPES = ["test", "acik_uclu"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_STATUSES = ["taslak", "onayli", "reddedildi"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const SUBMISSION_STATUSES = [
  "gonderildi",
  "ai_degerlendirildi",
  "egitmen_onayli",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const EXAM_ATTEMPT_STATUSES = [
  "devam_ediyor",
  "degerlendiriliyor",
  "sonuclandi",
] as const;
export type ExamAttemptStatus = (typeof EXAM_ATTEMPT_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Tablo modelleri                                                           */
/* -------------------------------------------------------------------------- */

/** Test sorularindaki tek bir sik. `questions.options_json` icinde saklanir. */
export type QuestionOption = {
  key: string; // "A" | "B" | "C" | "D"
  text: string;
};

export type UserProfile = {
  id: string;
  /** Etkin rol. Onay bekleyen kullanicida 'ogrenci' kalir. */
  role: UserRole;
  role_status: RoleStatus;
  /** Kullanicinin talep ettigi rol; onaylaninca `role` olur. */
  requested_role: UserRole | null;
  role_reviewed_by: string | null;
  role_reviewed_at: string | null;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningOutcome = {
  id: string;
  /** DENEYAP atolye dali. */
  category: DeneyapCategory | null;
  topic: string;
  outcome_text: string;
  source_text: string;
  created_by: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  /** DENEYAP atolye dali (bkz. lib/deneyap.ts). Eski kayitlarda null olabilir. */
  category: DeneyapCategory | null;
  /** Ders adi. Havuz "dal -> ders -> konu -> soru" olarak kirilir. */
  subject: string;
  topic: string;
  text: string;
  type: QuestionType;
  /** Sadece `type === "test"` icin dolu. */
  options_json: QuestionOption[] | null;
  /** Sadece `type === "test"` icin dolu; dogru sikkin `key` degeri. */
  correct_answer: string | null;
  /** Sadece `type === "acik_uclu"` icin dolu. */
  rubric: string | null;
  status: QuestionStatus;
  outcome_id: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type Exam = {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type ExamQuestion = {
  exam_id: string;
  question_id: string;
  position: number;
  points: number;
};

export type ExamAssignment = {
  id: string;
  exam_id: string;
  student_id: string;
  assigned_by: string | null;
  assigned_at: string;
  due_at: string | null;
};

export type ExamAttempt = {
  id: string;
  exam_id: string;
  student_id: string;
  status: ExamAttemptStatus;
  started_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  earned_points: number | null;
  total_points: number | null;
  final_score: number | null;
  created_at: string;
  updated_at: string;
};

export type Submission = {
  id: string;
  exam_id: string;
  question_id: string | null;
  student_id: string;
  answer_text: string;
  ai_score: number | null;
  ai_feedback: string | null;
  /** AI on degerlendirmesinin rubrik maddesi bazindaki kirilimi. */
  ai_criteria_json: GradingResult["criteria"];
  instructor_approved_score: number | null;
  instructor_note: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ExamStatistics = {
  exam_id: string;
  exam_title: string;
  instructor_id: string;
  student_count: number;
  submission_count: number;
  approved_count: number;
  average_score: number | null;
};

/* -------------------------------------------------------------------------- */
/*  Tercih hafizasi (AI'in icerik uzmanindan ogrenmesi)                       */
/* -------------------------------------------------------------------------- */

export const PREFERENCE_VERDICTS = ["begendi", "begenmedi"] as const;
export type PreferenceVerdict = (typeof PREFERENCE_VERDICTS)[number];

export type QuestionPreference = {
  id: string;
  user_id: string;
  verdict: PreferenceVerdict;
  question_text: string;
  question_type: QuestionType;
  topic: string;
  difficulty: string;
  options_json: QuestionOption[] | null;
  rubric: string | null;
  note: string | null;
  outcome_id: string | null;
  created_at: string;
};

/** Modele few-shot olarak verilecek ornek kumesi. */
export interface StyleGuide {
  liked: QuestionPreference[];
  disliked: QuestionPreference[];
}

/* -------------------------------------------------------------------------- */
/*  Yapay zeka cikti tipleri                                                  */
/* -------------------------------------------------------------------------- */

/** `generateQuestions` ciktisindaki tek bir soru taslagi (henuz DB'ye yazilmamis). */
export interface GeneratedQuestion {
  topic: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[] | null;
  correct_answer: string | null;
  rubric: string | null;
  /** Modelin kendi zorluk tahmini. */
  difficulty: "kolay" | "orta" | "zor";
}

/** `gradeAnswer` ciktisi. */
export interface GradingResult {
  /** 0-100 arasi puan. */
  score: number;
  /** Ogrenciye gosterilecek gerekce / geri bildirim. */
  feedback: string;
  /** Rubrik maddesi bazinda kirilim - egitmenin onay ekraninda gosterilir. */
  criteria: Array<{
    criterion: string;
    earned: number;
    max: number;
    comment: string;
  }>;
}

/* -------------------------------------------------------------------------- */
/*  API sozlesmeleri                                                          */
/* -------------------------------------------------------------------------- */

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface GenerateQuestionsRequest {
  context: string;
  kazanim: string;
  /** DENEYAP atolye dali. */
  category?: DeneyapCategory;
  topic?: string;
  count?: number;
  type?: QuestionType | "karisik";
}

export interface GradeAnswerRequest {
  studentAnswer: string;
  rubric: string;
  questionText?: string;
  maxScore?: number;
}

/* -------------------------------------------------------------------------- */
/*  Supabase generic semasi                                                   */
/*  `createClient<Database>()` ile sorgu sonuclari tipli hale gelir.          */
/* -------------------------------------------------------------------------- */

type Insertable<T, Optional extends keyof T> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>;

/**
 * postgrest-js `GenericTable` kisiti `Relationships` alanini zorunlu kilar.
 * Iliskili tablolari `select("*, exams(*)")` gibi gomulu sorgularla cekmeyi
 * planlamiyorsak bos birakmak yeterlidir.
 */
type TableDefinition<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  /** supabase-js'in PostgREST surumunu cozmesi icin kullandigi ic alan. */
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      users: TableDefinition<
        UserProfile,
        Insertable<UserProfile, "created_at" | "updated_at" | "email" | "role">
      >;
      learning_outcomes: TableDefinition<
        LearningOutcome,
        Insertable<
          LearningOutcome,
          "id" | "created_at" | "created_by" | "source_text" | "category"
        >
      >;
      questions: TableDefinition<
        Question,
        Insertable<
          Question,
          | "id"
          | "created_at"
          | "updated_at"
          | "category"
          | "subject"
          | "status"
          | "outcome_id"
          | "created_by"
          | "reviewed_by"
          | "ai_generated"
          | "options_json"
          | "correct_answer"
          | "rubric"
        >
      >;
      exams: TableDefinition<
        Exam,
        Insertable<
          Exam,
          "id" | "created_at" | "description" | "is_published" | "starts_at" | "ends_at"
        >
      >;
      exam_questions: TableDefinition<
        ExamQuestion,
        Insertable<ExamQuestion, "position" | "points">
      >;
      exam_assignments: TableDefinition<
        ExamAssignment,
        Insertable<ExamAssignment, "id" | "assigned_at" | "assigned_by" | "due_at">
      >;
      exam_attempts: TableDefinition<
        ExamAttempt,
        Insertable<
          ExamAttempt,
          | "id"
          | "status"
          | "started_at"
          | "submitted_at"
          | "completed_at"
          | "earned_points"
          | "total_points"
          | "final_score"
          | "created_at"
          | "updated_at"
        >
      >;
      submissions: TableDefinition<
        Submission,
        Insertable<
          Submission,
          | "id"
          | "created_at"
          | "updated_at"
          | "question_id"
          | "answer_text"
          | "ai_score"
          | "ai_feedback"
          | "ai_criteria_json"
          | "instructor_approved_score"
          | "instructor_note"
          | "status"
          | "reviewed_by"
        >
      >;
      question_preferences: TableDefinition<
        QuestionPreference,
        Insertable<
          QuestionPreference,
          | "id"
          | "created_at"
          | "topic"
          | "difficulty"
          | "options_json"
          | "rubric"
          | "note"
          | "outcome_id"
        >
      >;
    };
    Views: {
      /** Salt okunur gorunum: Insert/Update tanimlanmaz. */
      exam_statistics: {
        Row: ExamStatistics;
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
      has_role: {
        Args: { target: UserRole };
        Returns: boolean;
      };
      request_role: {
        Args: { target: UserRole };
        Returns: RoleStatus;
      };
      review_role_request: {
        Args: { target_user: string; approve: boolean };
        Returns: RoleStatus;
      };
      start_exam_attempt: {
        Args: { target_exam: string };
        Returns: string;
      };
      submit_exam_attempt: {
        Args: { target_exam: string };
        Returns: string;
      };
      recalculate_exam_attempt_result: {
        Args: { target_exam: string; target_student: string };
        Returns: boolean;
      };
      get_student_exam_questions: {
        Args: { target_exam: string };
        Returns: Array<{
          id: string;
          subject: string;
          topic: string;
          text: string;
          type: QuestionType;
          options_json: QuestionOption[] | null;
          outcome_id: string | null;
          position: number;
          points: number;
        }>;
      };
      get_my_submissions: {
        Args: { target_exam?: string | null };
        Returns: Submission[];
      };
    };
    Enums: {
      deneyap_category: DeneyapCategory;
      user_role: UserRole;
      role_status: RoleStatus;
      question_type: QuestionType;
      question_status: QuestionStatus;
      submission_status: SubmissionStatus;
      exam_attempt_status: ExamAttemptStatus;
      preference_verdict: PreferenceVerdict;
    };
  };
}
