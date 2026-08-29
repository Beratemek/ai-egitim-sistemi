/**
 * Uygulama genelinde kullanilan domain tipleri.
 * `supabase/schema.sql` ile birebir hizali tutulmalidir.
 */

import type { AiProvider } from "@/lib/ai-providers";
import type { ExamSimulationReport } from "@/lib/exam-simulation";
import type { QuestionVisual } from "@/lib/visual";

/* -------------------------------------------------------------------------- */
/*  Roller                                                                    */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = [
  "icerik_uzmani",
  "egitmen",
  "ogrenci",
  "veli",
  "egitim_yoneticisi",
  /**
   * Sistem yoneticisi. GIZLI roldur: kayit ve rol secim ekranlarinda
   * listelenmez, yalnizca veritabanindan atanir. Sitedeki her panele girer
   * ve tum yazma islemlerine yetkilidir (bkz. public.is_admin()).
   */
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Rol onay durumu.
 *
 * Kayit ekranindaki tum roller sistem yoneticisi onayi ister; onaya kadar
 * teknik bootstrap rol 'ogrenci' kalir ve kullanici bekleme ekranina alinir.
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

/** Test sorularindaki tek bir secenek. `questions.options_json` icinde saklanir. */
export type QuestionOption = {
  key: string; // "A" | "B" | "C" | "D"
  text: string;
  /**
   * Ogrenciye GOSTERILEN harf.
   *
   * Yalnizca kitapcik karistirmasindan gecmis siklarda dolar (bkz.
   * lib/booklet.ts): siklarin ICERIGI yer degistirir ama ekrandaki harfler
   * A, B, C, D sirasinda kalir. Bos ise `key` gosterilir - egitmenin
   * inceleme ekraninda karistirma yoktur.
   *
   * Cevap olarak her zaman `key` gonderilir. Kayit boylece sorunun KENDI
   * koordinatlarinda kalir; puanlama, inceleme ve istatistikler kitapcigi
   * bilmek zorunda olmaz. Ekrandaki harf kaydedilseydi cevabi okuyan her
   * yerin onu geri cevirmesi gerekirdi ve bir tanesi unutuldugunda ogrenci
   * sessizce yanlis puan alirdi.
   */
  label?: string;
  /**
   * Sikkin kendi gorseli.
   *
   * "Soru sozel, siklar gorsel olabilir" durumunu karsilar: soru metni
   * yazili, siklar birer sema ya da grafik. `options_json` zaten jsonb
   * oldugu icin ayri bir sutun gerekmiyor.
   */
  visual?: QuestionVisual | null;
};

export type UserProfile = {
  id: string;
  /**
   * Su an AKTIF olan rol. Yalnizca hangi panele dusulecegini ve basliklarda
   * ne yazacagini belirler - YETKI KAYNAGI DEGILDIR.
   */
  role: UserRole;
  /**
   * Kullaniciya VERILMIS roller. Yetki bu kumeye gore belirlenir; bir hesaba
   * birden fazla rol atanabilir (or. hem egitmen hem icerik uzmani).
   */
  roles: UserRole[];
  role_status: RoleStatus;
  /** Kullanicinin talep ettigi rol; onaylaninca `role` olur. */
  requested_role: UserRole | null;
  role_reviewed_by: string | null;
  role_reviewed_at: string | null;
  /** Ogrencinin sinifi/derslik adi. Sistem yoneticisi atar. */
  classroom: string | null;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningOutcome = {
  id: string;
  /**
   * ESKI SUTUN - artik yazilmiyor.
   *
   * Once "atolye dali" diye DENEYAP'a ozel bir kademe vardi. Urun tek bir
   * kuruma bagli olmadigi icin kaldirildi; kirilim ders -> konu oldu. Sutun
   * eski kayitlarin degerini korumak icin duruyor, arayuzde hicbir yerde
   * gosterilmiyor ve yeni kayitlarda null.
   */
  category: string | null;
  /**
   * Kazanimin ait oldugu ders. Uretim formunda kazanim listesi bununla
   * suzuluyor. Eski kayitlarda null olabilir.
   */
  subject: string | null;
  topic: string;
  outcome_text: string;
  source_text: string;
  created_by: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  /** ESKI SUTUN - artik yazilmiyor, arayuzde gosterilmiyor. */
  category: string | null;
  /** Ders adi. Havuz "ders -> konu -> soru" olarak kirilir. */
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
  /**
   * Soru govdesine eklenen gorsel (grafik / sema / fotograf).
   * Bicim: `lib/visual.ts` icindeki `QuestionVisual`. Gorseli olmayan
   * sorularda null.
   */
  visual_json: QuestionVisual | null;
  /**
   * Zorluk derecesi. AI uretirken tahmin eder; icerik uzmani duzeltebilir.
   *
   * OPSIYONEL cunku sutun sonradan eklendi (BEKLEYEN-2-soru-zorluk.sql).
   * Migration uygulanmadan once Supabase bu alani hic dondurmez; okuyan
   * taraf bu yuzden `difficultyOf()` ile varsayilana duser.
   */
  difficulty?: QuestionDifficulty;
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
  /**
   * Sinavin dersi. Ders yetkisinin dayanagi budur: egitmen yalnizca
   * yetkili oldugu dersteki sinavlari gorur. Atanmamissa (null) sinav
   * tum egitmenlere aciktir.
   */
  subject: string | null;
  /**
   * Sinav kamera+mikrofon acikken mi cozulecek?
   *
   * Egitmen belirler. Acikken ogrenci once kamera kontrolunden gecer ve
   * sinav boyunca akis kapanirsa cevap veremez.
   */
  proctored: boolean;
  /**
   * Ogrenci basina sinav suresi (dakika).
   *
   * Pencereden (starts_at/ends_at) farkli: pencere sinavin ACIK OLDUGU
   * araligi, bu ise her ogrenciye denemesini baslattigi andan itibaren
   * taninan sureyi tanimlar. Bos ise yalnizca pencere gecerlidir.
   */
  duration_minutes: number | null;
  /**
   * Puanlar soru sayisina gore kendiliginden mi dagitilsin?
   *
   * Egitmen bir soruya elle puan verdigi anda false olur; boylece sonradan
   * soru eklendiginde elle yapilan duzenleme silinmez. "Esit dagit" ile
   * yeniden acilabilir.
   */
  points_auto: boolean;
  instructor_id: string;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  /**
   * Sinav arsivlendiyse dolu.
   *
   * Egitmen "sil" dediginde sinav yok edilmez, arsivlenir: kendi listesinden
   * cikar ama kontrol sayfasi, yonetici raporlari ve ogrencinin sonuc ekrani
   * onu gormeye devam eder (bkz. uygulandi/2026-08-26-sinav-arsivi.sql).
   *
   * OPSIYONEL cunku sutun o migration ile geliyor; uygulanmamis bir
   * kurulumda PostgREST bu alani hic dondurmez ve `undefined` kalir.
   */
  archived_at?: string | null;
};

export type ExamQuestion = {
  exam_id: string;
  question_id: string;
  position: number;
  points: number;
};

/** Bir egitmene verilmis ders yetkisi. Sistem yoneticisi atar. */
export type InstructorSubject = {
  user_id: string;
  subject: string;
  granted_by: string | null;
  granted_at: string;
};

export type ExamAssignment = {
  id: string;
  exam_id: string;
  student_id: string;
  assigned_by: string | null;
  assigned_at: string;
  due_at: string | null;
  /**
   * Ogrencinin kitapcigi: A, B, C veya D.
   *
   * Soru ve sik sirasi bundan TURETILIR (bkz. lib/booklet.ts), saklanan tek
   * sey harftir. Ogrenciye GOSTERILMEZ; yalnizca sunucu karistirmayi
   * hesaplarken ve egitmen kontrol ekraninda kullanir.
   *
   * OPSIYONEL cunku sutun uygulandi/2026-08-26-kitapcik.sql ile geliyor; uygulanmamis
   * bir kurulumda alan hic donmez ve karistirma devreye girmez.
   */
  booklet?: string | null;
};

/** Sistem yöneticisinin kurduğu tek veli -> çok öğrenci bağlantısı. */
export type GuardianStudentLink = {
  student_id: string;
  guardian_id: string;
  linked_by: string | null;
  linked_at: string;
};

/** Veli panelindeki güvenli öğrenci kimlik özeti. */
export type GuardianStudentSummary = {
  guardian_id: string;
  guardian_name: string;
  student_id: string;
  student_name: string;
  classroom: string | null;
  assigned_exam_count: number;
  completed_exam_count: number;
  overdue_exam_count: number;
  average_score: number | null;
  latest_score: number | null;
  latest_completed_at: string | null;
};

/** Veliye açılan, soru ve cevap içermeyen sınav durumu/sonuç satırı. */
export type GuardianExamProgressStatus =
  | "baslanmadi"
  | "devam_ediyor"
  | "degerlendiriliyor"
  | "sonuclandi";

export type GuardianStudentExamRow = {
  exam_id: string;
  title: string;
  subject: string;
  due_at: string | null;
  progress_status: GuardianExamProgressStatus;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  final_score: number | null;
};

/** Yalnız nihai, eğitmen onaylı kanıttan üretilen kazanım özeti. */
export type GuardianStudentOutcomeRow = {
  outcome_id: string;
  outcome_text: string;
  subject: string;
  topic: string;
  average_score: number | null;
  approved_answer_count: number;
  measured_question_count: number;
  exam_count: number;
  evidence_level: "early" | "supported" | "strong";
  is_actionable_weak: boolean;
  latest_evidence_at: string | null;
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
  /**
   * Ogrencinin nihai sonuc ayrintisini ilk kez actigi an.
   * Eski Supabase kurulumlari migration uygulanana kadar bu alani donmeyebilir.
   */
  result_viewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseExperienceFeedback = {
  id: string;
  student_id: string;
  source_exam_id: string;
  instructor_id: string;
  subject: string;
  subject_key: string;
  academic_period: string;
  clarity_rating: number;
  pace_rating: number;
  materials_rating: number;
  assessment_fairness_rating: number;
  helpful_text: string | null;
  improvement_text: string | null;
  anonymous: true;
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

export const STUDY_PLAN_STATUSES = [
  "baslanmadi",
  "calisiliyor",
  "tamamlandi",
] as const;

export type StudyPlanStatus = (typeof STUDY_PLAN_STATUSES)[number];

/** Ogrencinin hesabina kaydedilen tek bir calisma plani maddesi. */
export type StudentStudyPlanRow = {
  id: string;
  student_id: string;
  /** Oneri yeniden uretildiginde ayni maddeyi bulmak icin kararli anahtar. */
  recommendation_key: string;
  title: string;
  context: string | null;
  action: string | null;
  evidence: string | null;
  outcome_id: string | null;
  latest_exam_id: string | null;
  status: StudyPlanStatus;
  saved_at: string;
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
  /**
   * Geri bildirimin verildigi ders. `getStyleGuide()` once AYNI DERSIN
   * orneklerini modele verir; eski kayitlarda null olabilir.
   */
  subject: string | null;
  /** ESKI SUTUN - artik yazilmiyor. */
  category: string | null;
  topic: string;
  difficulty: string;
  options_json: QuestionOption[] | null;
  rubric: string | null;
  note: string | null;
  outcome_id: string | null;
  created_at: string;
};

/**
 * Tarz rehberinin hangi kapsamdan toplandigi.
 *
 * `getStyleGuide()` kademeli olarak daraltir: once ayni ders + ayni konu,
 * yeterli ornek yoksa ayni ders, o da yoksa genel. Model promptunda hangi
 * kapsamin kullanildigi yaziliyor - "bu ornekler ayni konudan" bilgisi
 * modelin ornege ne kadar yaklasmasi gerektigini belirliyor.
 */
export type StyleScope = "konu" | "ders" | "genel";

/** Tek bir kapsamdaki begeni/red sayilari. */
export interface PreferenceCount {
  liked: number;
  disliked: number;
}

/**
 * Tercih istatistikleri.
 *
 * Tipler burada duruyor cunku uretim formu (istemci bileseni) bunlari
 * kullaniyor; `lib/queries.ts` sunucu tarafli ve istemciye alinamaz.
 */
export interface PreferenceStats extends PreferenceCount {
  /**
   * Ders adina gore kirilim. Uretim formu yazilan derse gore "bu derste N
   * ornekten ogrenildi" yazabilmek icin bunu kullanir; canli sorgu yerine
   * tek seferde gonderiliyor.
   *
   * Anahtar `subjectKey()` ile normalize edilmis ders adi.
   */
  bySubject: Record<string, PreferenceCount>;
}

/** Modele few-shot olarak verilecek ornek kumesi. */
export interface StyleGuide {
  liked: QuestionPreference[];
  disliked: QuestionPreference[];
  /** Orneklerin toplandigi kapsam; prompt'a ve arayuze yazilir. */
  scope: StyleScope;
}

/* -------------------------------------------------------------------------- */
/*  Sinav kestirimi kaydi                                                     */
/* -------------------------------------------------------------------------- */

export const SIMULATION_COHORT_KINDS = ["hazir", "elle", "ikiz"] as const;
export type SimulationCohortKind = (typeof SIMULATION_COHORT_KINDS)[number];

/**
 * Yayindan once yapilmis bir kestirimin kaydi.
 *
 * Kayit DEGISTIRILEMEZ (tabloda update politikasi yok): kalibrasyonun anlami
 * tahminin sonradan duzeltilememesinde.
 */
export type ExamSimulationRow = {
  id: string;
  exam_id: string;
  created_by: string;
  cohort_kind: SimulationCohortKind;
  cohort_label: string;
  /** Kadronun temsil ettigi ogrenci sayisi. */
  student_count: number;
  /** Kalibrasyonun karsilastirdigi sayi, 0-100. */
  predicted_average: number;
  /** Raporun tamami; sekli `lib/exam-simulation.ts` icinde. */
  report: ExamSimulationReport;
  created_at: string;
};

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
  /**
   * Soruya eklenecek gorsel; model uretmediyse ya da urettigi gorsel
   * dogrulamayi gecemediyse null.
   */
  visual: QuestionVisual | null;
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

/**
 * Istenen zorluk seviyesi.
 *
 * "karisik" -> model kolay/orta/zor dengesi kurar. Brief'in 2. maddesi
 * seviyeyi EGITMENIN tanimlamasini istiyor; onceden yalnizca modelin kendi
 * tahmini vardi ve talep edilemiyordu.
 */
export type DifficultyChoice = "kolay" | "orta" | "zor" | "karisik";

/**
 * Havuzdaki bir sorunun zorlugu.
 *
 * DifficultyChoice ile ayni DEGIL: orada bir de "karisik" var ve o bir
 * URETIM TALEBIdir ("bana karisik zorlukta 10 soru uret"). Tek bir sorunun
 * zorlugu karisik olamaz.
 */
export type QuestionDifficulty = "kolay" | "orta" | "zor";

/** Ekranda gosterilen etiketler. */
export const DIFFICULTY_LABELS: Readonly<Record<QuestionDifficulty, string>> = {
  kolay: "Kolay",
  orta: "Orta",
  zor: "Zor",
};

export interface GenerateQuestionsRequest {
  context: string;
  kazanim: string;
  /** Ders adi. Tarz hafizasi bu dersin orneklerinden secilir. */
  subject?: string;
  topic?: string;
  count?: number;
  type?: QuestionType | "karisik";
  /** Talep edilen zorluk. Verilmezse "karisik". */
  difficulty?: DifficultyChoice;
  /**
   * Bu uretimde kullanilacak model.
   *
   * Verilmezse sistem yoneticisinin panelde sectigi varsayilan model gecerli
   * olur. Icerik uzmani formdan yalnizca ANAHTARIN ERISEBILDIGI modeller
   * arasindan secebilir (bkz. lib/ai-model-catalog.ts).
   */
  model?: string;
  /**
   * Modelin ait oldugu saglayici.
   *
   * Model adiyla BIRLIKTE tasiniyor cunku ayni anda birden fazla saglayicinin
   * anahtari tanimli olabiliyor; "gpt-4o-mini" hem OpenAI hem OpenRouter
   * listesinde gecebilir ve hangi anahtarla cagrilacagi yalnizca buradan
   * anlasilir.
   */
  provider?: string;
}

export interface ReviseQuestionRequest {
  /** Revize edilecek taslak. */
  question: GeneratedQuestion;
  /** Hazir talimat anahtari: zorlastir | kolaylastir | kisalt | celdirici. */
  preset?: string;
  /** Uzmanin serbest talimati. `preset` ile birlikte de gonderilebilir. */
  instruction?: string;
  /** Sorunun olctugu kazanim - revizyonda hedef kaymasin. */
  kazanim?: string;
  /** Kaynak metin - model bilgi uydurmasin. */
  context?: string;
}

/**
 * Sanal sinif pilot uygulamasi istegi.
 *
 * Soru GOVDEDE tasiniyor cunku pilot, taslak henuz veritabanina yazilmadan
 * uretim ekraninda calisiyor.
 */
export interface VirtualClassRequest {
  /** Pilot uygulamaya sokulacak taslak. */
  question: GeneratedQuestion;
  /** Sorunun olctugu kazanim - simule ogrencilerin "derste ogrendigi" sey. */
  kazanim?: string;
  /** Ders adi. */
  subject?: string;
  /** Bu pilot icin kullanilacak model; verilmezse varsayilan model. */
  model?: string;
  /** Modelin saglayicisi. */
  provider?: string;
}

/**
 * Egitmenin elle kurdugu tek bir ogrenci profili.
 *
 * Yetkinlik ve dikkat 0-1 arasi oran; `count` bu profilden kac ogrenci
 * oldugunu soyler ve kestirimde agirlik olarak kullanilir.
 */
export interface ManualProfileInput {
  label: string;
  /** Genel yetkinlik, 0-1. */
  ability: number;
  /** Dikkat, 0-1: 1 titiz, 0 aceleci. */
  diligence: number;
  /** Bu profilden kac ogrenci var. */
  count: number;
  /** Ders bazinda yetkinlik ezmesi (ders adi -> 0-1). */
  subjectAbility?: Record<string, number>;
  /** Tasidigi kavram yanilgisi. */
  misconception?: string | null;
}

/** Sinav kestiriminde kullanilacak kadro. */
export type SimulationCohortInput =
  | { kind: "hazir" }
  | { kind: "elle"; profiles: ManualProfileInput[] }
  | { kind: "ikiz"; classroom: string };

export interface SimulateExamRequest {
  examId: string;
  cohort: SimulationCohortInput;
  /** Bu kestirimde kullanilacak model; verilmezse varsayilan model. */
  model?: string;
  provider?: string;
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

/* -------------------------------------------------------------------------- */
/*  Yapay zeka ayarlari                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `public.ai_settings` - TEK SATIRLIK tablo.
 *
 * Sistem yoneticisinin panelden girdigi saglayici/anahtar burada durur.
 * `id` sutunu daima `true`; birincil anahtar oldugu icin ikinci bir satir
 * acilamaz, yani "hangi kayit gecerli" sorusu hic dogmaz.
 *
 * `api_key` ARAYUZE HIC GITMEZ: tablo RLS ile tumuyle kapalidir ve yalnizca
 * service_role okuyabilir (bkz. lib/ai-settings.ts).
 *
 * `interface` DEGIL `type` olarak yaziliyor - dosyadaki diger satir tipleri
 * gibi. Sebep teknik: postgrest-js `Row: Record<string, unknown>` bekliyor,
 * TypeScript'te ise bir `interface` ortuk indeks imzasi almadigi icin bu
 * kisiti karsilamiyor. Interface yazilirsa `Database` sessizce gecersiz
 * sayilir ve TUM tablolarin sorgulari `never` tipine duser.
 */
export type AiSettingsRecord = {
  id: boolean;
  provider: AiProvider;
  api_key: string;
  base_url: string;
  model_generation: string;
  model_grading: string;
  mock_mode: boolean;
  updated_at: string;
  updated_by: string | null;
};

/**
 * `public.ai_provider_keys` - SAGLAYICI BASINA anahtar.
 *
 * `ai_settings` tek satirlik oldugu icin ayni anda tek anahtar tutabiliyordu;
 * bu tablo her saglayiciya kendi satirini verir ve hepsi ayni anda tanimli
 * kalabilir. Icerik uzmani model listesinde hepsini bir arada gorur.
 *
 * `interface` degil `type`: bkz. [[AiSettingsRecord]] uzerindeki not.
 */
export type AiProviderKeyRecord = {
  provider: AiProvider;
  api_key: string;
  base_url: string;
  model_generation: string;
  updated_at: string;
  updated_by: string | null;
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
          "id" | "created_at" | "created_by" | "source_text" | "category" | "subject"
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
          | "visual_json"
        >
      >;
      exams: TableDefinition<
        Exam,
        Insertable<
          Exam,
          | "id"
          | "created_at"
          | "description"
          | "is_published"
          | "starts_at"
          | "ends_at"
          | "subject"
          | "proctored"
          | "duration_minutes"
          | "points_auto"
          | "archived_at"
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
      guardian_student_links: TableDefinition<
        GuardianStudentLink,
        Insertable<GuardianStudentLink, "linked_at" | "linked_by">
      >;
      instructor_subjects: TableDefinition<
        InstructorSubject,
        Insertable<InstructorSubject, "granted_by" | "granted_at">
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
          | "result_viewed_at"
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
      student_study_plan_items: TableDefinition<
        StudentStudyPlanRow,
        Insertable<
          StudentStudyPlanRow,
          "id" | "status" | "saved_at" | "updated_at"
        >
      >;
      course_experience_feedback: TableDefinition<
        CourseExperienceFeedback,
        Insertable<
          CourseExperienceFeedback,
          "id" | "anonymous" | "created_at" | "updated_at"
        >
      >;
      ai_provider_keys: TableDefinition<
        AiProviderKeyRecord,
        Insertable<
          AiProviderKeyRecord,
          "api_key" | "base_url" | "model_generation" | "updated_at" | "updated_by"
        >
      >;
      ai_settings: TableDefinition<
        AiSettingsRecord,
        Insertable<
          AiSettingsRecord,
          | "id"
          | "base_url"
          | "model_generation"
          | "model_grading"
          | "mock_mode"
          | "updated_at"
          | "updated_by"
        >
      >;
      exam_simulations: TableDefinition<
        ExamSimulationRow,
        Insertable<ExamSimulationRow, "id" | "created_at" | "student_count">
      >;
      question_preferences: TableDefinition<
        QuestionPreference,
        Insertable<
          QuestionPreference,
          | "id"
          | "created_at"
          | "subject"
          | "category"
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
      /*
        Yapay zeka ayarlari. Ikisi de `security definer`: yetkiyi kendi
        govdesinde `is_admin()` ile dogrular, yani bu ekrani atlayip PostgREST'e
        dogrudan istek atmak ise yaramaz.
      */
      save_ai_provider_key: {
        Args: {
          target_provider: string;
          new_api_key: string;
          new_base_url: string;
          new_model_generation: string;
        };
        Returns: null;
      };
      clear_ai_provider_key: {
        Args: { target_provider: string };
        Returns: null;
      };
      save_ai_defaults: {
        Args: {
          new_provider: string;
          new_model_generation: string;
          new_model_grading: string;
          new_mock_mode: boolean;
        };
        Returns: null;
      };
      save_ai_settings: {
        Args: {
          new_provider: string;
          new_api_key: string | null;
          new_base_url: string;
          new_model_generation: string;
          new_model_grading: string;
          new_mock_mode: boolean;
        };
        Returns: null;
      };
      clear_ai_api_key: {
        Args: Record<string, never>;
        Returns: null;
      };
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
      set_user_role: {
        Args: { target_user: string; new_role: UserRole };
        Returns: UserRole;
      };
      set_user_roles: {
        Args: { target_user: string; new_roles: UserRole[] };
        Returns: UserRole[];
      };
      set_active_role: {
        Args: { target: UserRole };
        Returns: UserRole;
      };
      set_instructor_subjects: {
        Args: { target_user: string; subjects: string[] };
        Returns: string[];
      };
      reset_exam_points: {
        Args: { target_exam: string };
        Returns: number;
      };
      // Sinav arsivi (uygulandi/2026-08-26-sinav-arsivi.sql). Ikisi de `security
      // definer`: yetkiyi kendi govdesinde kontrol eder.
      delete_exam_permanently: {
        Args: { target_exam: string };
        Returns: null;
      };
      delete_student_exam_data: {
        Args: { target_exam: string; target_student: string };
        Returns: null;
      };
      exam_attempt_deadline: {
        Args: { target_exam: string; target_student: string };
        Returns: string | null;
      };
      my_subjects: {
        Args: Record<string, never>;
        Returns: string[];
      };
      set_user_classroom: {
        Args: { target_user: string; new_classroom: string | null };
        Returns: string | null;
      };
      assign_exam_to_classroom: {
        Args: {
          target_exam: string;
          target_classroom: string;
          due_at?: string | null;
        };
        Returns: number;
      };
      unassign_exam_from_classroom: {
        Args: { target_exam: string; target_classroom: string };
        Returns: number;
      };
      start_exam_attempt: {
        Args: { target_exam: string };
        Returns: string;
      };
      submit_exam_attempt: {
        Args: { target_exam: string };
        Returns: string;
      };
      mark_exam_result_viewed: {
        Args: { target_exam: string };
        Returns: boolean;
      };
      submit_course_experience_feedback: {
        Args: {
          target_exam: string;
          clarity: number;
          pace: number;
          materials: number;
          assessment_fairness: number;
          helpful?: string | null;
          improvement?: string | null;
        };
        Returns: string;
      };
      get_course_experience_feedback_summary: {
        Args: Record<string, never>;
        Returns: Array<{
          instructor_id: string;
          instructor_name: string;
          subject: string;
          academic_period: string;
          response_count: number;
          clarity_average: number | null;
          pace_average: number | null;
          materials_average: number | null;
          assessment_fairness_average: number | null;
          overall_average: number | null;
          helpful_comments: string[];
          improvement_comments: string[];
        }>;
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
          visual_json: QuestionVisual | null;
          outcome_id: string | null;
          position: number;
          points: number;
        }>;
      };
      get_my_submissions: {
        Args: { target_exam?: string | null };
        Returns: Submission[];
      };
      set_student_guardian: {
        Args: { target_student: string; target_guardian: string | null };
        Returns: string | null;
      };
      get_guardian_students: {
        Args: Record<string, never>;
        Returns: GuardianStudentSummary[];
      };
      get_guardian_student_exams: {
        Args: { target_student: string };
        Returns: GuardianStudentExamRow[];
      };
      get_guardian_student_outcomes: {
        Args: { target_student: string };
        Returns: GuardianStudentOutcomeRow[];
      };
    };
    Enums: {
      /**
       * ESKI ENUM - `questions.category` bu tipte, ama artik hicbir yere
       * yazilmiyor. Veritabaninda duruyor cunku eski kayitlar degerini
       * tasiyor; TypeScript tarafinda dar bir birlesim tutmanin faydasi yok.
       */
      deneyap_category: string;
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
