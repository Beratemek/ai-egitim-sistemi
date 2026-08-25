/**
 * Sınav yayımlama öncesi deterministik kalite kontrolü.
 *
 * Bu modül React, Supabase ve yapay zekâdan bağımsızdır. Aynı kuralların
 * kalite panelinde başka, `setExamPublished` eyleminde başka uygulanmasını
 * önlemek için tek bir saf karar noktası sağlar.
 */

import type { Exam, ExamQuestion, Question } from "./types.ts";
import { normalizeOptionKey } from "./answer-normalization.ts";

export const EXAM_QUALITY_ISSUE_CODES = [
  "soru-yok",
  "toplam-puan-100-degil",
  "gecersiz-soru-puani",
  "yinelenen-soru",
  "yinelenen-sira",
  "gecersiz-soru-sirasi",
  "soru-kaydi-bulunamadi",
  "soru-govdesi-eksik",
  "soru-onaysiz",
  "soru-turu-gecersiz",
  "test-secenekleri-gecersiz",
  "test-cevap-anahtari-gecersiz",
  "acik-uclu-rubrik-eksik",
  "sure-gecersiz",
  "baslangic-tarihi-gecersiz",
  "bitis-tarihi-gecersiz",
  "tarih-araligi-gecersiz",
  "atama-yok",
  "kazanimi-eksik-soru",
  "sinav-dersi-eksik",
  "ders-uyusmazligi",
  "zorluk-etiketi-eksik",
  "zorluk-dagilimi-dengesiz",
  "dogru-sik-dagilimi-dengesiz",
  "cok-fazla-soru",
  "yinelenen-soru-metni",
] as const;

export type ExamQualityIssueCode = (typeof EXAM_QUALITY_ISSUE_CODES)[number];
export type ExamQualitySeverity = "blocker" | "warning";
export type ExamQualityStatus = "blocker" | "warning" | "pass";

export interface ExamQualityIssue {
  code: ExamQualityIssueCode;
  severity: ExamQualitySeverity;
  /** Kart veya kontrol listesinde gösterilecek kısa ifade. */
  title: string;
  /** Sorunun neden önemli olduğunu ve ne yapılacağını açıklayan UI metni. */
  message: string;
  /** Toplu bulgunun etkilediği sorular; sınav ayarı bulgularında boştur. */
  questionIds: readonly string[];
}

export type ExamQualityExam = Pick<
  Exam,
  "id" | "subject" | "duration_minutes" | "starts_at" | "ends_at"
>;

export type ExamQualityExamQuestion = Pick<
  ExamQuestion,
  "question_id" | "position" | "points"
>;

export type ExamQualityQuestion = Pick<
  Question,
  | "id"
  | "subject"
  | "text"
  | "type"
  | "options_json"
  | "correct_answer"
  | "rubric"
  | "visual_json"
  | "difficulty"
  | "status"
  | "outcome_id"
>;

export interface ExamQualityInput {
  exam: ExamQualityExam;
  /** Sınav-soru bağlantıları; puan ve sıra sınava özel olduğu için ayrıdır. */
  examQuestions: readonly ExamQualityExamQuestion[];
  /** Bağlantılardaki sorular. Bağlantısı olmayan havuz soruları değerlendirilmez. */
  questions: readonly ExamQualityQuestion[];
  /** Bu sınav için benzersiz öğrenci ataması sayısı. */
  assignmentCount: number;
}

export interface ExamQualityMetrics {
  questionCount: number;
  resolvedQuestionCount: number;
  totalPoints: number;
  testQuestionCount: number;
  openEndedQuestionCount: number;
  outcomeCoveragePercent: number;
}

export interface ExamQualityReport {
  status: ExamQualityStatus;
  /** Yalnızca blocker yoksa true; uyarılar yayımlamayı engellemez. */
  canPublish: boolean;
  blockers: readonly ExamQualityIssue[];
  warnings: readonly ExamQualityIssue[];
  issues: readonly ExamQualityIssue[];
  metrics: ExamQualityMetrics;
}

/** Dağılım yorumu küçük sınavlarda yanıltıcı olmasın. */
export const EXAM_QUALITY_THRESHOLDS = {
  minimumQuestionsForDistribution: 5,
  difficultyConcentration: 0.8,
  correctOptionConcentration: 0.6,
  largeExamQuestionCount: 100,
} as const;

const VALID_DIFFICULTIES = new Set(["kolay", "orta", "zor"]);

/**
 * Tüm deterministik kontrolleri çalıştırır.
 *
 * Blocker varsa sınav yayımlanmamalıdır. Uyarılar pedagojik kalite sinyalidir;
 * eğitmen bilinçli bir tercihle sınavı yine de yayımlayabilir.
 */
export function evaluateExamQuality(input: ExamQualityInput): ExamQualityReport {
  const blockers: ExamQualityIssue[] = [];
  const warnings: ExamQualityIssue[] = [];
  const { exam, examQuestions, questions } = input;
  const questionById = new Map(questions.map((question) => [question.id, question]));

  if (examQuestions.length === 0) {
    blockers.push(
      issue(
        "soru-yok",
        "blocker",
        "Sınavda soru yok",
        "Yayımlamadan önce sınava en az bir onaylı soru ekleyin.",
      ),
    );
  }

  const invalidPointIds = examQuestions
    .filter(
      (link) =>
        !Number.isFinite(link.points) ||
        link.points <= 0,
    )
    .map((link) => link.question_id);
  if (invalidPointIds.length > 0) {
    blockers.push(
      issue(
        "gecersiz-soru-puani",
        "blocker",
        "Geçersiz soru puanı",
        "Her sorunun puanı sıfırdan büyük, geçerli bir sayı olmalıdır.",
        invalidPointIds,
      ),
    );
  }

  const totalPoints = roundPoints(
    examQuestions.reduce(
      (total, link) => total + (Number.isFinite(link.points) ? link.points : 0),
      0,
    ),
  );
  // Boş sınavda "soru ekleyin" tek başına yeterince açıklayıcıdır.
  if (examQuestions.length > 0 && totalPoints !== 100) {
    blockers.push(
      issue(
        "toplam-puan-100-degil",
        "blocker",
        "Toplam puan 100 değil",
        `Soru puanlarının toplamı ${formatNumber(totalPoints)}. Yayımlamak için toplamı 100 yapın.`,
      ),
    );
  }

  addDuplicateLinkIssues(examQuestions, blockers);

  const linkedQuestions: ExamQualityQuestion[] = [];
  const missingQuestionIds: string[] = [];
  const resolvedQuestionIds = new Set<string>();
  for (const link of examQuestions) {
    const question = questionById.get(link.question_id);
    if (!question) {
      missingQuestionIds.push(link.question_id);
      continue;
    }
    // Yinelenen bağlantı zaten ayrı bir blocker'dır; aynı soru kalite
    // dağılımlarını iki kez etkileyip ikinci, yanıltıcı uyarılar üretmemeli.
    if (!resolvedQuestionIds.has(question.id)) {
      linkedQuestions.push(question);
      resolvedQuestionIds.add(question.id);
    }
  }
  if (missingQuestionIds.length > 0) {
    blockers.push(
      issue(
        "soru-kaydi-bulunamadi",
        "blocker",
        "Soru kaydı bulunamadı",
        "Sınavdaki bazı soru bağlantıları artık geçerli değil. Bu soruları çıkarıp yeniden ekleyin.",
        missingQuestionIds,
      ),
    );
  }

  addQuestionBlockers(linkedQuestions, blockers);
  addScheduleBlockers(exam, blockers);
  addQuestionWarnings(exam, linkedQuestions, input.assignmentCount, warnings);

  const testQuestionCount = linkedQuestions.filter(
    (question) => question.type === "test",
  ).length;
  const openEndedQuestionCount = linkedQuestions.filter(
    (question) => question.type === "acik_uclu",
  ).length;
  const measuredQuestionCount = linkedQuestions.filter((question) =>
    Boolean(question.outcome_id),
  ).length;

  const status: ExamQualityStatus =
    blockers.length > 0 ? "blocker" : warnings.length > 0 ? "warning" : "pass";
  const issues = [...blockers, ...warnings];

  return {
    status,
    canPublish: blockers.length === 0,
    blockers,
    warnings,
    issues,
    metrics: {
      questionCount: examQuestions.length,
      resolvedQuestionCount: linkedQuestions.length,
      totalPoints,
      testQuestionCount,
      openEndedQuestionCount,
      outcomeCoveragePercent:
        linkedQuestions.length === 0
          ? 0
          : round((measuredQuestionCount / linkedQuestions.length) * 100),
    },
  };
}

function addDuplicateLinkIssues(
  links: readonly ExamQualityExamQuestion[],
  blockers: ExamQualityIssue[],
): void {
  const duplicateQuestionIds = duplicates(links.map((link) => link.question_id));
  if (duplicateQuestionIds.length > 0) {
    blockers.push(
      issue(
        "yinelenen-soru",
        "blocker",
        "Aynı soru birden fazla kez eklenmiş",
        "Her soru sınavda yalnızca bir kez bulunabilir. Yinelenen bağlantıları kaldırın.",
        duplicateQuestionIds,
      ),
    );
  }

  const invalidPositions = links
    .filter(
      (link) =>
        !Number.isFinite(link.position) ||
        !Number.isInteger(link.position) ||
        link.position < 0,
    )
    .map((link) => link.question_id);
  if (invalidPositions.length > 0) {
    blockers.push(
      issue(
        "gecersiz-soru-sirasi",
        "blocker",
        "Geçersiz soru sırası",
        "Soru sıraları sıfır veya daha büyük bir tam sayı olmalıdır.",
        invalidPositions,
      ),
    );
  }

  const duplicatePositions = new Set(duplicates(links.map((link) => link.position)));
  if (duplicatePositions.size > 0) {
    blockers.push(
      issue(
        "yinelenen-sira",
        "blocker",
        "Soru sıraları çakışıyor",
        "İki veya daha fazla soru aynı sırada. Soruları yeniden sıralayın.",
        links
          .filter((link) => duplicatePositions.has(link.position))
          .map((link) => link.question_id),
      ),
    );
  }
}

function addQuestionBlockers(
  questions: readonly ExamQualityQuestion[],
  blockers: ExamQualityIssue[],
): void {
  const noBody = questions
    .filter((question) => !question.text.trim() && !question.visual_json)
    .map((question) => question.id);
  if (noBody.length > 0) {
    blockers.push(
      issue(
        "soru-govdesi-eksik",
        "blocker",
        "Soru gövdesi eksik",
        "Her soruda metin veya bir soru görseli bulunmalıdır.",
        noBody,
      ),
    );
  }

  const unapproved = questions
    .filter((question) => question.status !== "onayli")
    .map((question) => question.id);
  if (unapproved.length > 0) {
    blockers.push(
      issue(
        "soru-onaysiz",
        "blocker",
        "Onay bekleyen sorular var",
        "Taslak veya reddedilmiş soruları onaylı sorularla değiştirin.",
        unapproved,
      ),
    );
  }

  const invalidTypes = questions
    .filter((question) => question.type !== "test" && question.type !== "acik_uclu")
    .map((question) => question.id);
  if (invalidTypes.length > 0) {
    blockers.push(
      issue(
        "soru-turu-gecersiz",
        "blocker",
        "Geçersiz soru türü",
        "Soru türünü test veya açık uçlu olarak yeniden belirleyin.",
        invalidTypes,
      ),
    );
  }

  const invalidOptions: string[] = [];
  const invalidAnswerKeys: string[] = [];
  const missingRubrics: string[] = [];

  for (const question of questions) {
    if (question.type === "test") {
      const options = question.options_json ?? [];
      const keys = options.map((option) => normalizeOptionKey(option.key));
      const optionSetIsValid =
        options.length === 4 &&
        keys.every(Boolean) &&
        new Set(keys).size === keys.length &&
        options.every((option) => option.text.trim().length > 0 || Boolean(option.visual));

      if (!optionSetIsValid) invalidOptions.push(question.id);

      const correctKey = normalizeOptionKey(question.correct_answer ?? "");
      if (!correctKey || !keys.includes(correctKey)) invalidAnswerKeys.push(question.id);
    }

    if (question.type === "acik_uclu" && !question.rubric?.trim()) {
      missingRubrics.push(question.id);
    }
  }

  if (invalidOptions.length > 0) {
    blockers.push(
      issue(
        "test-secenekleri-gecersiz",
        "blocker",
        "Test seçenekleri eksik veya geçersiz",
        "Her test sorusunda içerikli, anahtarları birbirinden farklı dört seçenek bulunmalıdır.",
        invalidOptions,
      ),
    );
  }
  if (invalidAnswerKeys.length > 0) {
    blockers.push(
      issue(
        "test-cevap-anahtari-gecersiz",
        "blocker",
        "Cevap anahtarı geçersiz",
        "Her test sorusunun doğru cevabı mevcut seçeneklerden biri olmalıdır.",
        invalidAnswerKeys,
      ),
    );
  }
  if (missingRubrics.length > 0) {
    blockers.push(
      issue(
        "acik-uclu-rubrik-eksik",
        "blocker",
        "Açık uçlu soru rubriği eksik",
        "Tutarlı değerlendirme için her açık uçlu soruya puanlama rubriği ekleyin.",
        missingRubrics,
      ),
    );
  }
}

function addScheduleBlockers(
  exam: ExamQualityExam,
  blockers: ExamQualityIssue[],
): void {
  if (
    exam.duration_minutes !== null &&
    (!Number.isInteger(exam.duration_minutes) ||
      exam.duration_minutes < 1 ||
      exam.duration_minutes > 600)
  ) {
    blockers.push(
      issue(
        "sure-gecersiz",
        "blocker",
        "Sınav süresi geçersiz",
        "Süreyi 1 ile 600 dakika arasında bir tam sayı olarak belirleyin.",
      ),
    );
  }

  const start = parseDate(exam.starts_at);
  const end = parseDate(exam.ends_at);
  if (exam.starts_at !== null && start === null) {
    blockers.push(
      issue(
        "baslangic-tarihi-gecersiz",
        "blocker",
        "Başlangıç tarihi geçersiz",
        "Sınav başlangıç tarihini geçerli bir tarih ve saat olarak kaydedin.",
      ),
    );
  }
  if (exam.ends_at !== null && end === null) {
    blockers.push(
      issue(
        "bitis-tarihi-gecersiz",
        "blocker",
        "Bitiş tarihi geçersiz",
        "Sınav bitiş tarihini geçerli bir tarih ve saat olarak kaydedin.",
      ),
    );
  }
  if (start !== null && end !== null && end <= start) {
    blockers.push(
      issue(
        "tarih-araligi-gecersiz",
        "blocker",
        "Sınav tarih aralığı geçersiz",
        "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
      ),
    );
  }
}

function addQuestionWarnings(
  exam: ExamQualityExam,
  questions: readonly ExamQualityQuestion[],
  assignmentCount: number,
  warnings: ExamQualityIssue[],
): void {
  if (assignmentCount === 0) {
    warnings.push(
      issue(
        "atama-yok",
        "warning",
        "Sınav henüz kimseye atanmadı",
        "Öğrencilerin sınavı görebilmesi için en az bir sınıf veya öğrenci atayın.",
      ),
    );
  }

  const noOutcome = questions
    .filter((question) => !question.outcome_id)
    .map((question) => question.id);
  if (noOutcome.length > 0) {
    warnings.push(
      issue(
        "kazanimi-eksik-soru",
        "warning",
        "Kazanımla eşleşmeyen sorular var",
        "Bu sorular kazanım analizine katılamaz. Ölçtükleri kazanımları bağlayın.",
        noOutcome,
      ),
    );
  }

  const examSubject = exam.subject?.trim() ?? "";
  if (!examSubject) {
    warnings.push(
      issue(
        "sinav-dersi-eksik",
        "warning",
        "Sınavın dersi belirtilmemiş",
        "Ders yetkisi, filtreler ve kazanım raporları için sınava bir ders seçin.",
      ),
    );
  } else {
    const mismatched = questions
      .filter((question) => subjectKey(question.subject) !== subjectKey(examSubject))
      .map((question) => question.id);
    if (mismatched.length > 0) {
      warnings.push(
        issue(
          "ders-uyusmazligi",
          "warning",
          "Sınavın dersiyle uyuşmayan sorular var",
          "Soruların dersini kontrol edin veya sınavın dersini güncelleyin.",
          mismatched,
        ),
      );
    }
  }

  const invalidDifficulty = questions
    .filter((question) => !VALID_DIFFICULTIES.has(question.difficulty ?? ""))
    .map((question) => question.id);
  if (invalidDifficulty.length > 0) {
    warnings.push(
      issue(
        "zorluk-etiketi-eksik",
        "warning",
        "Zorluk etiketi eksik sorular var",
        "Sınavın zorluk dengesini görebilmek için bu sorulara seviye atayın.",
        invalidDifficulty,
      ),
    );
  }

  addDistributionWarnings(questions, warnings);

  if (questions.length > EXAM_QUALITY_THRESHOLDS.largeExamQuestionCount) {
    warnings.push(
      issue(
        "cok-fazla-soru",
        "warning",
        "Soru sayısı çok yüksek",
        `Sınavda ${questions.length} soru var. Süreyi ve öğrenci yükünü yeniden değerlendirin.`,
        questions.map((question) => question.id),
      ),
    );
  }

  const duplicateTextIds = duplicateQuestionTextIds(questions);
  if (duplicateTextIds.length > 0) {
    warnings.push(
      issue(
        "yinelenen-soru-metni",
        "warning",
        "Aynı metne sahip sorular var",
        "Yanlışlıkla tekrarlanan soruları kontrol edin; bilinçli tekrarları göz ardı edebilirsiniz.",
        duplicateTextIds,
      ),
    );
  }
}

function addDistributionWarnings(
  questions: readonly ExamQualityQuestion[],
  warnings: ExamQualityIssue[],
): void {
  const validDifficultyQuestions = questions.filter((question) =>
    VALID_DIFFICULTIES.has(question.difficulty ?? ""),
  );
  if (
    validDifficultyQuestions.length >=
    EXAM_QUALITY_THRESHOLDS.minimumQuestionsForDistribution
  ) {
    const counts = countBy(
      validDifficultyQuestions.map((question) => question.difficulty as string),
    );
    const [dominantDifficulty, dominantCount] = maxEntry(counts);
    const share = dominantCount / validDifficultyQuestions.length;
    if (share >= EXAM_QUALITY_THRESHOLDS.difficultyConcentration) {
      warnings.push(
        issue(
          "zorluk-dagilimi-dengesiz",
          "warning",
          "Sorular tek bir zorlukta yoğunlaşıyor",
          `Soruların %${round(share * 100)} kadarı “${difficultyLabel(dominantDifficulty)}” seviyesinde. Zorluk dağılımını gözden geçirin.`,
          validDifficultyQuestions
            .filter((question) => question.difficulty === dominantDifficulty)
            .map((question) => question.id),
        ),
      );
    }
  }

  const testQuestionsWithAnswer = questions.filter(
    (question) =>
      question.type === "test" && normalizeOptionKey(question.correct_answer ?? ""),
  );
  if (
    testQuestionsWithAnswer.length >=
    EXAM_QUALITY_THRESHOLDS.minimumQuestionsForDistribution
  ) {
    const counts = countBy(
      testQuestionsWithAnswer.map((question) =>
        normalizeOptionKey(question.correct_answer ?? ""),
      ),
    );
    const [dominantKey, dominantCount] = maxEntry(counts);
    const share = dominantCount / testQuestionsWithAnswer.length;
    if (share >= EXAM_QUALITY_THRESHOLDS.correctOptionConcentration) {
      warnings.push(
        issue(
          "dogru-sik-dagilimi-dengesiz",
          "warning",
          "Doğru cevaplar aynı şıkta yoğunlaşıyor",
          `Test sorularının %${round(share * 100)} kadarında doğru cevap “${dominantKey}”. Cevap anahtarı dağılımını gözden geçirin.`,
          testQuestionsWithAnswer
            .filter(
              (question) =>
                normalizeOptionKey(question.correct_answer ?? "") === dominantKey,
            )
            .map((question) => question.id),
        ),
      );
    }
  }
}

function issue(
  code: ExamQualityIssueCode,
  severity: ExamQualitySeverity,
  title: string,
  message: string,
  questionIds: readonly string[] = [],
): ExamQualityIssue {
  return { code, severity, title, message, questionIds: unique(questionIds) };
}

function parseDate(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function subjectKey(value: string): string {
  // Ders yetkisinin kullandığı Postgres `lower()` davranışıyla uyumludur.
  return value.trim().toLowerCase();
}

function duplicateQuestionTextIds(
  questions: readonly ExamQualityQuestion[],
): string[] {
  const byText = new Map<string, string[]>();
  for (const question of questions) {
    const key = question.text.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
    // Görselden ibaret soruları yalnızca boş metinleri aynı diye işaretleme.
    if (!key) continue;
    const ids = byText.get(key) ?? [];
    ids.push(question.id);
    byText.set(key, ids);
  }

  return unique(
    [...byText.values()].filter((ids) => ids.length > 1).flatMap((ids) => ids),
  );
}

function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const duplicateValues = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) duplicateValues.add(value);
    seen.add(value);
  }
  return [...duplicateValues];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function maxEntry(counts: ReadonlyMap<string, number>): readonly [string, number] {
  let result: readonly [string, number] = ["", 0];
  for (const entry of counts) {
    if (entry[1] > result[1]) result = entry;
  }
  return result;
}

function difficultyLabel(value: string): string {
  if (value === "kolay") return "kolay";
  if (value === "zor") return "zor";
  return "orta";
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundPoints(value: number): number {
  // Veritabanı `numeric(5,2)` kullanır. Ondalık toplamadaki 99.999999 gibi
  // kayan nokta artıklarının geçerli bir 100 puanı engellemesine izin verme.
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
