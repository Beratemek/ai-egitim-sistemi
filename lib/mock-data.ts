/**
 * Demo (mock) verisi.
 *
 * Supabase baglanmadan arayuzun calisir gorunmesi icin kullanilir.
 * Gercek veriye gecerken bu modulu import eden sayfalarda ilgili
 * `supabase.from(...)` sorgusuyla degistirin.
 */

import type {
  Exam,
  ExamStatistics,
  LearningOutcome,
  Question,
  Submission,
  UserProfile,
} from "@/lib/types";

const INSTRUCTOR_ID = "00000000-0000-4000-8000-000000000002";
const STUDENT_ID = "00000000-0000-4000-8000-000000000003";

export const MOCK_USERS: readonly UserProfile[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    role: "icerik_uzmani",
    role_status: "onayli",
    requested_role: null,
    role_reviewed_by: null,
    role_reviewed_at: null,
    full_name: "Elif Demir",
    email: "icerik@ornek.com",
    created_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-01T09:00:00.000Z",
  },
  {
    id: INSTRUCTOR_ID,
    role: "egitmen",
    role_status: "onayli",
    requested_role: null,
    role_reviewed_by: null,
    role_reviewed_at: null,
    full_name: "Ayse Yilmaz",
    email: "egitmen@ornek.com",
    created_at: "2026-08-01T09:05:00.000Z",
    updated_at: "2026-08-01T09:05:00.000Z",
  },
  {
    id: STUDENT_ID,
    role: "ogrenci",
    role_status: "onayli",
    requested_role: null,
    role_reviewed_by: null,
    role_reviewed_at: null,
    full_name: "Mert Kaya",
    email: "ogrenci@ornek.com",
    created_at: "2026-08-02T11:20:00.000Z",
    updated_at: "2026-08-02T11:20:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    role: "egitim_yoneticisi",
    role_status: "onayli",
    requested_role: null,
    role_reviewed_by: null,
    role_reviewed_at: null,
    full_name: "Deniz Aydin",
    email: "yonetici@ornek.com",
    created_at: "2026-08-02T11:25:00.000Z",
    updated_at: "2026-08-02T11:25:00.000Z",
  },
];

export const MOCK_OUTCOMES: readonly LearningOutcome[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    category: null,
    topic: "Fotosentez",
    outcome_text: "Ogrenci fotosentezin isik ve karanlik evrelerini aciklar.",
    source_text:
      "Fotosentez, bitkilerin isik enerjisini kimyasal enerjiye donusturdugu surectir. Isik evresi tilakoit zarda, karanlik evre (Calvin dongusu) stromada gerceklesir.",
    created_by: "00000000-0000-4000-8000-000000000001",
    created_at: "2026-08-05T08:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    category: null,
    topic: "Newton Yasalari",
    outcome_text: "Ogrenci Newton'un hareket yasalarini ornekle aciklar.",
    source_text:
      "Newton'un birinci yasasi eylemsizlik ilkesidir. Ikinci yasa F = m . a bagintisiyla ifade edilir. Ucuncu yasa etki-tepki ilkesidir.",
    created_by: "00000000-0000-4000-8000-000000000001",
    created_at: "2026-08-06T10:30:00.000Z",
  },
];

export const MOCK_QUESTIONS: readonly Question[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    category: null,
    subject: "Biyoloji",
    topic: "Fotosentez",
    text: "Fotosentezin isik evresi hucrenin hangi yapisinda gerceklesir?",
    type: "test",
    options_json: [
      { key: "A", text: "Stroma" },
      { key: "B", text: "Tilakoit zar" },
      { key: "C", text: "Mitokondri matriksi" },
      { key: "D", text: "Hucre zari" },
    ],
    correct_answer: "B",
    rubric: null,
    status: "onayli",
    outcome_id: "10000000-0000-4000-8000-000000000001",
    created_by: "00000000-0000-4000-8000-000000000001",
    reviewed_by: INSTRUCTOR_ID,
    ai_generated: true,
    created_at: "2026-08-07T09:15:00.000Z",
    updated_at: "2026-08-08T14:02:00.000Z",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    category: null,
    subject: "Biyoloji",
    topic: "Fotosentez",
    text: "Calvin dongusunun fotosentezdeki rolunu aciklayiniz.",
    type: "acik_uclu",
    options_json: null,
    correct_answer: null,
    rubric: [
      "1. Calvin dongusunun stromada gerceklestigini belirtir (30 puan)",
      "2. CO2 tutulmasi ve karbon indirgenmesini aciklar (40 puan)",
      "3. ATP ve NADPH kullanimina deginir (30 puan)",
    ].join("\n"),
    status: "taslak",
    outcome_id: "10000000-0000-4000-8000-000000000001",
    created_by: "00000000-0000-4000-8000-000000000001",
    reviewed_by: null,
    ai_generated: true,
    created_at: "2026-08-07T09:15:00.000Z",
    updated_at: "2026-08-07T09:15:00.000Z",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    category: null,
    subject: "Fizik",
    topic: "Newton Yasalari",
    text: "Bir cismin ivmesi ile uzerine etki eden net kuvvet arasindaki iliski nedir?",
    type: "test",
    options_json: [
      { key: "A", text: "Ivme net kuvvetle ters orantilidir" },
      { key: "B", text: "Ivme net kuvvetle dogru orantilidir" },
      { key: "C", text: "Ivme net kuvvetten bagimsizdir" },
      { key: "D", text: "Ivme yalnizca kutleye baglidir" },
    ],
    correct_answer: "B",
    rubric: null,
    status: "taslak",
    outcome_id: "10000000-0000-4000-8000-000000000002",
    created_by: "00000000-0000-4000-8000-000000000001",
    reviewed_by: null,
    ai_generated: true,
    created_at: "2026-08-09T13:40:00.000Z",
    updated_at: "2026-08-09T13:40:00.000Z",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    category: null,
    subject: "Fizik",
    topic: "Newton Yasalari",
    text: "Etki-tepki ilkesini gunluk hayattan bir ornekle aciklayiniz.",
    type: "acik_uclu",
    options_json: null,
    correct_answer: null,
    rubric: [
      "1. Etki ve tepki kuvvetlerinin esit buyuklukte, zit yonde oldugunu belirtir (50 puan)",
      "2. Kuvvetlerin farkli cisimlere etki ettigini vurgular (30 puan)",
      "3. Gecerli bir gunluk hayat ornegi verir (20 puan)",
    ].join("\n"),
    status: "onayli",
    outcome_id: "10000000-0000-4000-8000-000000000002",
    created_by: "00000000-0000-4000-8000-000000000001",
    reviewed_by: INSTRUCTOR_ID,
    ai_generated: true,
    created_at: "2026-08-09T13:41:00.000Z",
    updated_at: "2026-08-10T08:12:00.000Z",
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    category: null,
    subject: "Biyoloji",
    topic: "Fotosentez",
    text: "Fotosentez sirasinda uretilen oksijen hangi molekulden kaynaklanir?",
    type: "test",
    options_json: [
      { key: "A", text: "Karbondioksit" },
      { key: "B", text: "Glikoz" },
      { key: "C", text: "Su" },
      { key: "D", text: "ATP" },
    ],
    correct_answer: "C",
    rubric: null,
    status: "reddedildi",
    outcome_id: "10000000-0000-4000-8000-000000000001",
    created_by: "00000000-0000-4000-8000-000000000001",
    reviewed_by: INSTRUCTOR_ID,
    ai_generated: true,
    created_at: "2026-08-09T13:42:00.000Z",
    updated_at: "2026-08-11T16:00:00.000Z",
  },
];

export const MOCK_EXAMS: readonly Exam[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    title: "Biyoloji 1. Donem Ara Sinavi",
    description: "Fotosentez ve hucre solunumu konularini kapsar.",
    instructor_id: INSTRUCTOR_ID,
    is_published: true,
    starts_at: "2026-08-20T07:00:00.000Z",
    ends_at: "2026-08-20T09:00:00.000Z",
    created_at: "2026-08-12T12:00:00.000Z",
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    title: "Fizik Quiz - Newton Yasalari",
    description: "Kisa degerlendirme sinavi.",
    instructor_id: INSTRUCTOR_ID,
    is_published: false,
    starts_at: null,
    ends_at: null,
    created_at: "2026-08-14T09:30:00.000Z",
  },
];

export const MOCK_SUBMISSIONS: readonly Submission[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    exam_id: "30000000-0000-4000-8000-000000000001",
    question_id: "20000000-0000-4000-8000-000000000002",
    student_id: STUDENT_ID,
    answer_text:
      "Calvin dongusu kloroplastin stromasinda gerceklesir. Bu evrede karbondioksit tutularak organik molekullere donusturulur ve isik evresinde uretilen ATP ile NADPH kullanilir.",
    ai_score: 85,
    ai_feedback:
      "Dongunun yeri ve karbon tutulmasi dogru aciklanmis. ATP/NADPH kullanimina deginilmis ancak indirgenme adimlari biraz daha ayrintilandirilabilirdi.",
    instructor_approved_score: null,
    instructor_note: null,
    status: "ai_degerlendirildi",
    reviewed_by: null,
    created_at: "2026-08-20T08:12:00.000Z",
    updated_at: "2026-08-20T08:13:00.000Z",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    exam_id: "30000000-0000-4000-8000-000000000001",
    question_id: "20000000-0000-4000-8000-000000000004",
    student_id: STUDENT_ID,
    answer_text:
      "Bir kisi duvari ittiginde duvar da kisiyi ayni buyuklukte ters yonde iter.",
    ai_score: 70,
    ai_feedback:
      "Ornek dogru ancak kuvvetlerin farkli cisimlere etki ettigi acikca belirtilmemis.",
    instructor_approved_score: 75,
    instructor_note: "Ornek yeterli; kucuk bir puan artisi yapildi.",
    status: "egitmen_onayli",
    reviewed_by: INSTRUCTOR_ID,
    created_at: "2026-08-20T08:20:00.000Z",
    updated_at: "2026-08-21T10:05:00.000Z",
  },
];

export const MOCK_STATISTICS: readonly ExamStatistics[] = [
  {
    exam_id: "30000000-0000-4000-8000-000000000001",
    exam_title: "Biyoloji 1. Donem Ara Sinavi",
    instructor_id: INSTRUCTOR_ID,
    student_count: 24,
    submission_count: 96,
    approved_count: 71,
    average_score: 78.4,
  },
  {
    exam_id: "30000000-0000-4000-8000-000000000002",
    exam_title: "Fizik Quiz - Newton Yasalari",
    instructor_id: INSTRUCTOR_ID,
    student_count: 18,
    submission_count: 54,
    approved_count: 12,
    average_score: 64.2,
  },
];

/** Id -> tam ad eslesmesi (tablolarda gostermek icin). */
export const MOCK_USER_NAMES: Readonly<Record<string, string>> =
  Object.fromEntries(MOCK_USERS.map((user) => [user.id, user.full_name]));

/* -------------------------------------------------------------------------- */
/*  Grafik verisi (Egitim Yoneticisi panosu)                                  */
/* -------------------------------------------------------------------------- */

/** Haftalik ortalama puan trendi: AI on puani ile egitmen onayli puanin karsilastirmasi. */
export interface ScoreTrendPoint {
  /** Donem etiketi (hafta). */
  period: string;
  /** AI'in verdigi on puan ortalamasi. */
  aiScore: number;
  /** Egitmen onayindan sonraki nihai puan ortalamasi. */
  approvedScore: number;
}

export const MOCK_SCORE_TREND: readonly ScoreTrendPoint[] = [
  { period: "1. hafta", aiScore: 62.4, approvedScore: 65.1 },
  { period: "2. hafta", aiScore: 66.8, approvedScore: 69.4 },
  { period: "3. hafta", aiScore: 64.2, approvedScore: 68.0 },
  { period: "4. hafta", aiScore: 71.5, approvedScore: 74.2 },
  { period: "5. hafta", aiScore: 74.9, approvedScore: 76.8 },
  { period: "6. hafta", aiScore: 76.3, approvedScore: 79.5 },
  { period: "7. hafta", aiScore: 78.1, approvedScore: 80.3 },
  { period: "8. hafta", aiScore: 79.6, approvedScore: 82.1 },
];
