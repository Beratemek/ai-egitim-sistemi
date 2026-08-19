/**
 * Yapay zeka servisi.
 *
 * Iki temel yetenek sunar:
 *   - generateQuestions(context, kazanim, options) -> soru taslaklari (JSON)
 *   - gradeAnswer(studentAnswer, rubric, options)  -> puan + gerekce (JSON)
 *
 * Cikti sekli Zod semalari ile zorunlu kilinir (`generateObject`), boylece
 * "JSON parse edilemedi" hatalari yerine dogrulanmis nesneler doner.
 *
 * `AI_MOCK_MODE=true` ise (veya OPENAI_API_KEY yoksa) gercek bir API cagrisi
 * yapilmadan deterministik sahte veri dondurulur - hackathon demolari icin.
 *
 * Bu modul yalnizca sunucu tarafinda calistirilmalidir (API route / server action).
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import type {
  GeneratedQuestion,
  GradingResult,
  QuestionType,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Saglayici                                                                 */
/* -------------------------------------------------------------------------- */

function getProvider() {
  return createOpenAI({
    apiKey: serverEnv.openaiApiKey,
    ...(serverEnv.openaiBaseUrl ? { baseURL: serverEnv.openaiBaseUrl } : {}),
  });
}

/* -------------------------------------------------------------------------- */
/*  Semalar                                                                   */
/* -------------------------------------------------------------------------- */

const questionOptionSchema = z.object({
  key: z.string().describe('Sik anahtari: "A", "B", "C" veya "D".'),
  text: z.string().describe("Sikkin metni."),
});

const generatedQuestionSchema = z.object({
  topic: z.string().describe("Sorunun konusu."),
  text: z.string().describe("Soru koku. Tek bir soru cumlesi."),
  type: z
    .enum(["test", "acik_uclu"])
    .describe('Soru tipi: coktan secmeli icin "test", yazili icin "acik_uclu".'),
  options: z
    .array(questionOptionSchema)
    .nullable()
    .describe('type="test" ise 4 sik; type="acik_uclu" ise null.'),
  correct_answer: z
    .string()
    .nullable()
    .describe('type="test" ise dogru sikkin key degeri; degilse null.'),
  rubric: z
    .string()
    .nullable()
    .describe(
      'type="acik_uclu" ise puanlama rubrigi (madde madde, toplam 100 puan); degilse null.',
    ),
  difficulty: z.enum(["kolay", "orta", "zor"]).describe("Tahmini zorluk seviyesi."),
});

const generateQuestionsSchema = z.object({
  questions: z.array(generatedQuestionSchema).describe("Uretilen soru taslaklari."),
});

const gradingResultSchema = z.object({
  score: z.number().min(0).max(100).describe("0-100 arasi toplam puan."),
  feedback: z
    .string()
    .describe("Ogrenciye yonelik, yapici ve kisa gerekce (2-4 cumle)."),
  criteria: z
    .array(
      z.object({
        criterion: z.string().describe("Rubrik maddesinin adi."),
        earned: z.number().describe("Bu maddeden alinan puan."),
        max: z.number().describe("Bu maddenin tam puani."),
        comment: z.string().describe("Puanin kisa gerekcesi."),
      }),
    )
    .describe("Rubrik maddesi bazinda kirilim."),
});

/* -------------------------------------------------------------------------- */
/*  generateQuestions                                                         */
/* -------------------------------------------------------------------------- */

export interface GenerateQuestionsOptions {
  /** Uretilecek soru adedi. Varsayilan: 5 */
  count?: number;
  /** Istenen soru tipi. "karisik" ise model her ikisini de uretir. */
  type?: QuestionType | "karisik";
  /** Konu basligi. Verilmezse model kazanimdan cikarir. */
  topic?: string;
}

/**
 * Kaynak metin ve kazanimdan soru taslaklari uretir.
 *
 * @param context  Icerik uzmaninin yukledigi kaynak metin.
 * @param kazanim  Hedeflenen ogrenme kazanimi.
 */
export async function generateQuestions(
  context: string,
  kazanim: string,
  options: GenerateQuestionsOptions = {},
): Promise<GeneratedQuestion[]> {
  const { count = 5, type = "karisik", topic } = options;

  if (!context.trim() || !kazanim.trim()) {
    throw new Error("[ai] generateQuestions: context ve kazanim bos olamaz.");
  }

  if (serverEnv.aiMockMode) {
    return mockGenerateQuestions(kazanim, { count, type, topic });
  }

  const typeInstruction =
    type === "karisik"
      ? "Sorularin yaklasik yarisi coktan secmeli (test), yarisi acik uclu olsun."
      : type === "test"
        ? "Tum sorular coktan secmeli (test) olsun; her birinde 4 sik bulunsun."
        : "Tum sorular acik uclu olsun; her biri icin ayrintili rubrik yaz.";

  const provider = getProvider();

  const { object } = await generateObject({
    model: provider(serverEnv.aiModelGeneration),
    schema: generateQuestionsSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin.",
      "Verilen kaynak metne ve kazanima dayali, Turkce sinav sorulari yazarsin.",
      "Sorular yalnizca kaynak metinden dogrulanabilecek bilgileri olcmelidir; bilgi uydurma.",
      "Coktan secmeli sorularda celdiriciler makul olmali, tek bir dogru cevap bulunmalidir.",
      "Acik uclu sorularda rubrik madde madde yazilmali ve maddelerin puan toplami 100 olmalidir.",
    ].join(" "),
    prompt: [
      `KAZANIM:\n${kazanim}`,
      topic ? `KONU:\n${topic}` : "",
      `KAYNAK METIN:\n${context}`,
      `GOREV: Yukaridaki kazanimi olcen ${count} adet soru uret. ${typeInstruction}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return object.questions.map((question) =>
    normalizeGeneratedQuestion(question, topic ?? kazanim),
  );
}

/* -------------------------------------------------------------------------- */
/*  gradeAnswer                                                               */
/* -------------------------------------------------------------------------- */

export interface GradeAnswerOptions {
  /** Puanlanan sorunun metni - modele baglam saglar. */
  questionText?: string;
  /** Tam puan. Varsayilan: 100 */
  maxScore?: number;
}

/**
 * Ogrenci cevabini verilen rubrige gore puanlar.
 *
 * @param studentAnswer Ogrencinin acik uclu cevabi.
 * @param rubric        Sorunun puanlama rubrigi.
 */
export async function gradeAnswer(
  studentAnswer: string,
  rubric: string,
  options: GradeAnswerOptions = {},
): Promise<GradingResult> {
  const { questionText, maxScore = 100 } = options;

  if (!rubric.trim()) {
    throw new Error("[ai] gradeAnswer: rubric bos olamaz.");
  }

  // Bos cevap icin modele gitmeye gerek yok.
  if (!studentAnswer.trim()) {
    return {
      score: 0,
      feedback: "Cevap bos birakildigi icin puan verilemedi.",
      criteria: [],
    };
  }

  if (serverEnv.aiMockMode) {
    return mockGradeAnswer(studentAnswer, rubric, maxScore);
  }

  const provider = getProvider();

  const { object } = await generateObject({
    model: provider(serverEnv.aiModelGrading),
    schema: gradingResultSchema,
    system: [
      "Sen tarafsiz bir sinav degerlendiricisisin.",
      "Ogrenci cevabini YALNIZCA verilen rubrige gore puanlarsin.",
      "Yazim hatalari, uslup veya cevabin uzunlugu tek basina puan kirma sebebi degildir.",
      "Rubrikte olmayan bir kriter uydurma. Puanlarin toplami tam puani asmamalidir.",
      "Geri bildirim ogrenciye dogrudan hitap etsin, yapici ve kisa olsun.",
    ].join(" "),
    prompt: [
      questionText ? `SORU:\n${questionText}` : "",
      `RUBRIK (tam puan ${maxScore}):\n${rubric}`,
      `OGRENCI CEVABI:\n${studentAnswer}`,
      "GOREV: Cevabi rubrik maddeleri bazinda degerlendir, her madde icin alinan puani ve kisa gerekcesini yaz, sonra toplam puani belirle.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return normalizeGradingResult(object, maxScore);
}

/* -------------------------------------------------------------------------- */
/*  Normalizasyon                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Model ciktisini veritabani kisitlariyla uyumlu hale getirir:
 * test sorusunda sik/dogru cevap, acik ucluda rubrik garanti edilir.
 */
function normalizeGeneratedQuestion(
  question: z.infer<typeof generatedQuestionSchema>,
  fallbackTopic: string,
): GeneratedQuestion {
  const topic = question.topic.trim() || fallbackTopic;

  if (question.type === "test") {
    const options =
      question.options && question.options.length > 0 ? question.options : null;

    // Sik listesi gelmediyse soruyu acik ucluye dusurmek yerine hata verilir;
    // cagiran katman bu taslagi eleyebilir.
    if (!options || !question.correct_answer) {
      throw new Error(
        `[ai] Test sorusu eksik uretildi (sik veya dogru cevap yok): "${question.text}"`,
      );
    }

    return {
      topic,
      text: question.text,
      type: "test",
      options,
      correct_answer: question.correct_answer,
      rubric: null,
      difficulty: question.difficulty,
    };
  }

  if (!question.rubric) {
    throw new Error(
      `[ai] Acik uclu soru rubriksiz uretildi: "${question.text}"`,
    );
  }

  return {
    topic,
    text: question.text,
    type: "acik_uclu",
    options: null,
    correct_answer: null,
    rubric: question.rubric,
    difficulty: question.difficulty,
  };
}

/** Puani 0-maxScore araligina sikistirir ve kriter toplamiyla tutarli kilar. */
function normalizeGradingResult(
  result: z.infer<typeof gradingResultSchema>,
  maxScore: number,
): GradingResult {
  const clamp = (value: number, max: number): number =>
    Math.max(0, Math.min(max, Math.round(value * 100) / 100));

  const criteria = result.criteria.map((criterion) => ({
    ...criterion,
    max: clamp(criterion.max, maxScore),
    earned: clamp(criterion.earned, Math.max(0, criterion.max)),
  }));

  return {
    score: clamp(result.score, maxScore),
    feedback: result.feedback,
    criteria,
  };
}

/* -------------------------------------------------------------------------- */
/*  Mock mod (AI_MOCK_MODE=true)                                              */
/* -------------------------------------------------------------------------- */

function mockGenerateQuestions(
  kazanim: string,
  options: Required<Pick<GenerateQuestionsOptions, "count" | "type">> &
    Pick<GenerateQuestionsOptions, "topic">,
): GeneratedQuestion[] {
  const { count, type, topic } = options;
  const resolvedTopic = topic ?? kazanim.split(" ").slice(0, 3).join(" ");
  const difficulties = ["kolay", "orta", "zor"] as const;

  return Array.from({ length: count }, (_, index): GeneratedQuestion => {
    const isTest = type === "test" || (type === "karisik" && index % 2 === 0);
    const difficulty = difficulties[index % difficulties.length] ?? "orta";

    if (isTest) {
      return {
        topic: resolvedTopic,
        text: `[MOCK] "${kazanim}" kazanimini olcen ${index + 1}. coktan secmeli soru.`,
        type: "test",
        options: [
          { key: "A", text: "Birinci secenek" },
          { key: "B", text: "Ikinci secenek (dogru)" },
          { key: "C", text: "Ucuncu secenek" },
          { key: "D", text: "Dorduncu secenek" },
        ],
        correct_answer: "B",
        rubric: null,
        difficulty,
      };
    }

    return {
      topic: resolvedTopic,
      text: `[MOCK] "${kazanim}" kazanimini olcen ${index + 1}. acik uclu soru.`,
      type: "acik_uclu",
      options: null,
      correct_answer: null,
      rubric: [
        "1. Temel kavrami dogru tanimlar (40 puan)",
        "2. Sureci adim adim aciklar (40 puan)",
        "3. Ornek vererek destekler (20 puan)",
      ].join("\n"),
      difficulty,
    };
  });
}

function mockGradeAnswer(
  studentAnswer: string,
  rubric: string,
  maxScore: number,
): GradingResult {
  // Deterministik "puan": cevap uzunlugundan tureyen basit bir yaklasim.
  const words = studentAnswer.trim().split(/\s+/).length;
  const score = Math.min(maxScore, Math.round((words / 60) * maxScore));
  const lines = rubric
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  const perCriterion = lines.length > 0 ? maxScore / lines.length : maxScore;

  return {
    score,
    feedback: `[MOCK] Cevabiniz ${words} kelime. Rubrik maddelerinin buyuk bolumune deginmissiniz; ornek vererek aciklamalarinizi guclendirebilirsiniz.`,
    criteria: lines.map((line) => ({
      criterion: line,
      earned: Math.round((score / maxScore) * perCriterion),
      max: Math.round(perCriterion),
      comment: "[MOCK] Ornek gerekce.",
    })),
  };
}
