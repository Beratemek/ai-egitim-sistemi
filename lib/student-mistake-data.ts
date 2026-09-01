import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { grantedRoles } from "@/lib/roles";
import { parseSolution, type QuestionSolution } from "@/lib/solution";
import {
  buildStudentMistakeNotebook,
  type SafeStudentMistakeQuestionInput,
  type StudentMistakeNotebook,
  type StudentMistakeOutcomeInput,
} from "@/lib/student-mistakes";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
  getCurrentUser,
} from "@/lib/supabase-server";

const EMPTY_NOTEBOOK = buildStudentMistakeNotebook({
  exams: [],
  attempts: [],
  questions: [],
  submissions: [],
});

/**
 * Öğrencinin sonuçlanmış sınavlarından güvenli yanlış kanıtlarını yükler.
 *
 * Soru ve cevaplar ham tablolardan okunmaz. Öğrenciye ayrılmış iki RPC hem
 * sahiplik/sonuç görünürlüğünü uygular hem de yeniden kullanılabilir puanlama
 * alanlarını dönüş sözleşmesinin dışında tutar.
 */
export async function getStudentMistakeNotebook(): Promise<StudentMistakeNotebook> {
  if (!isSupabaseConfigured) return EMPTY_NOTEBOOK;

  const current = await getCurrentUser();
  if (!current || !grantedRoles(current.profile).includes("ogrenci")) {
    return EMPTY_NOTEBOOK;
  }

  const supabase = await createServerSupabaseClient();
  const attemptsResult = await supabase
    .from("exam_attempts")
    .select("exam_id, status, completed_at")
    .eq("student_id", current.user.id)
    .eq("status", "sonuclandi")
    .order("completed_at", { ascending: false });

  assertQuerySucceeded(attemptsResult.error);
  const attempts = attemptsResult.data ?? [];
  const examIds = [...new Set(attempts.map((attempt) => attempt.exam_id))];
  if (examIds.length === 0) return EMPTY_NOTEBOOK;

  /*
    Cozumler AYRI bir RPC'den geliyor: `get_my_solutions`.

    `get_student_exam_questions` icine konulamazdi - o sorgu sinav SURERKEN
    de calisiyor ve cozum orada cevap anahtarini acardi. Cozum kapisi
    yalnizca 'sonuclandi' denemeleri geciriyor (BEKLEYEN-cozum-okuma.sql).
  */
  const [examsResult, submissionsResult, solutionsResult, ...questionResults] =
    await Promise.all([
      supabase
        .from("exams")
        .select("id, title, subject, created_at")
        .in("id", examIds),
      supabase.rpc("get_my_submissions", { target_exam: null }),
      supabase.rpc("get_my_solutions", { target_exam: null }),
      ...examIds.map((examId) =>
        supabase.rpc("get_student_exam_questions", { target_exam: examId }),
      ),
    ]);

  assertQuerySucceeded(examsResult.error);
  assertQuerySucceeded(submissionsResult.error);
  for (const result of questionResults) assertQuerySucceeded(result.error);

  /*
    Cozum hatasi defteri DUSURMEZ.

    Migration henuz calistirilmadiysa ya da RPC bir sebeple hata verirse
    ogrenci yine yanlislarini gorebilmeli; yalnizca cozum bolumu gorunmez.
    Bu yuzden burada `assertQuerySucceeded` KULLANILMIYOR.
  */
  const solutions = new Map<string, QuestionSolution>();
  if (!solutionsResult.error) {
    for (const row of solutionsResult.data ?? []) {
      const parsed = parseSolution(row.solution_json);
      if (parsed) solutions.set(row.question_id, parsed);
    }
  }

  const questions: SafeStudentMistakeQuestionInput[] = questionResults.flatMap(
    (result, index) =>
      (result.data ?? []).map((question) => ({
        examId: examIds[index] as string,
        id: question.id,
        subject: question.subject,
        topic: question.topic,
        text: question.text,
        type: question.type,
        options_json: question.options_json,
        visual_json: question.visual_json,
        outcome_id: question.outcome_id,
        position: question.position,
        points: question.points,
      })),
  );
  const outcomeIds = [
    ...new Set(
      questions
        .map((question) => question.outcome_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const outcomes = await getSafeOutcomeLabels(outcomeIds);
  const visibleExamIds = new Set(examIds);

  return buildStudentMistakeNotebook({
    exams: examsResult.data ?? [],
    attempts,
    questions,
    solutions,
    submissions: (submissionsResult.data ?? []).filter(
      (submission) =>
        submission.student_id === current.user.id &&
        visibleExamIds.has(submission.exam_id),
    ),
    outcomes,
  });
}

/**
 * Öğrenme çıktısı tablosu kaynak metni de taşıdığı için öğrenci RLS'ine kapalı.
 * Sunucu burada yalnız kimliği ve gösterim metnini, zaten öğrencinin güvenli
 * soru RPC'sinde gördüğü kimliklerle sınırlı olarak seçer. Anahtar yoksa konu
 * adı güvenli geri dönüş etiketi olarak kullanılır.
 */
async function getSafeOutcomeLabels(
  outcomeIds: readonly string[],
): Promise<StudentMistakeOutcomeInput[]> {
  if (outcomeIds.length === 0 || !serverEnv.supabaseServiceRoleKey) return [];

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("learning_outcomes")
    .select("id, outcome_text")
    .in("id", [...outcomeIds]);

  if (error) {
    console.error("[student-mistakes] Kazanım etiketleri yüklenemedi:", error.message);
    return [];
  }
  return data ?? [];
}

function assertQuerySucceeded(
  error: { message?: string } | null | undefined,
): void {
  if (!error) return;
  console.error("[student-mistakes] Güvenli veri sorgusu başarısız:", error.message);
  throw new Error("Yanlışlarım Defteri yüklenemedi. Lütfen yeniden deneyin.");
}
