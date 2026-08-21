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

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { LanguageModelV1 } from "ai";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import type {
  GeneratedQuestion,
  GradingResult,
  QuestionType,
  StyleGuide,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Saglayici                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Istenen modeli secilen saglayicidan dondurur.
 *
 * `AI_PROVIDER` (ya da anahtarin oneki) "google" ise Gemini, aksi halde
 * OpenAI kullanilir. OpenAI yolu `OPENAI_BASE_URL` ile OpenAI-uyumlu baska
 * saglayicilara (Groq, OpenRouter, yerel LLM) da yonlendirilebilir.
 *
 * Iki saglayici da sema zorlamali cikti (structured output) destekler; bu
 * yuzden `generateObject` cagrilari saglayiciya gore degismez.
 */
function getModel(modelId: string): LanguageModelV1 {
  if (serverEnv.aiProvider === "google") {
    const google = createGoogleGenerativeAI({ apiKey: serverEnv.openaiApiKey });
    return google(modelId);
  }

  const openai = createOpenAI({
    apiKey: serverEnv.openaiApiKey,
    ...(serverEnv.openaiBaseUrl ? { baseURL: serverEnv.openaiBaseUrl } : {}),
  });

  return openai(modelId);
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
  /** DENEYAP atolye dali adi; modele alan baglami olarak verilir. */
  categoryLabel?: string;
  /** Uretilecek soru adedi. Varsayilan: 5 */
  count?: number;
  /** Istenen soru tipi. "karisik" ise model her ikisini de uretir. */
  type?: QuestionType | "karisik";
  /** Konu basligi. Verilmezse model kazanimdan cikarir. */
  topic?: string;
  /**
   * Icerik uzmaninin gecmis begeni/red kayitlari. Modele few-shot ornek olarak
   * verilir: begenilenler taklit edilecek tarz, reddedilenler kacinilacak tarz.
   */
  styleGuide?: StyleGuide;
}

/**
 * Tercih kayitlarini modele verilecek metne cevirir.
 *
 * Ornekler kisaltilir (soru koku + varsa uzmanin notu) - tam rubrik/sik listesi
 * baglami sisirir ve tarz bilgisi zaten soru kokunde ve notta.
 */
function buildStyleGuidePrompt(styleGuide: StyleGuide | undefined): string {
  if (!styleGuide) return "";

  const format = (preference: StyleGuide["liked"][number]): string => {
    const parts = [
      `- [${preference.question_type === "test" ? "test" : "acik uclu"} / ${preference.difficulty}] ${preference.question_text}`,
    ];
    if (preference.note) parts.push(`  (uzman notu: ${preference.note})`);
    return parts.join("\n");
  };

  const sections: string[] = [];

  if (styleGuide.liked.length > 0) {
    sections.push(
      [
        "ICERIK UZMANININ BEGENDIGI SORULAR - bu tarzi ornek al:",
        styleGuide.liked.map(format).join("\n"),
      ].join("\n"),
    );
  }

  if (styleGuide.disliked.length > 0) {
    sections.push(
      [
        "ICERIK UZMANININ REDDETTIGI SORULAR - bu tarzdan kacin:",
        styleGuide.disliked.map(format).join("\n"),
      ].join("\n"),
    );
  }

  if (sections.length === 0) return "";

  return [
    "",
    "== TARZ REHBERI ==",
    ...sections,
    "Bu ornekleri KOPYALAMA; yalnizca soru kurgusu, zorluk dengesi, celdirici",
    "mantigi ve dil tonu bakimindan ornek al. Yeni sorular ozgun olmali.",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Kaynaga atif yapan sorulari eleme                                         */
/* -------------------------------------------------------------------------- */

/**
 * Turkce metni ASCII'ye indirger.
 *
 * Desenleri tek bicimde yazabilmek icin: "Kitabın" -> "kitabin",
 * "MÜFREDAT" -> "mufredat". JS'in `i` bayragi Turkce'ye ozgu i/I ayrimini
 * dogru cevirmedigi icin donusum elle yapiliyor.
 */
function toAscii(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[ıi̇]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/**
 * Soru, olculmesi gereken bilgiyi degil KAYNAGIN KENDISINI soruyorsa gecersizdir.
 *
 * Model, prompt'ta yasaklanan "kaynak metne gore" kalibini bulamayinca
 * "kitabin haftalik mufredatina gore ... kacinci haftada" gibi baska bir
 * atif kalibi uretebiliyor. Ogrenci sinavda ne metni ne mufredati gorecegi
 * icin bu tur sorular kullanilamaz; sadece rica etmek yetmiyor, cikti
 * dogrulanip eleniyor.
 */
const META_QUESTION_PATTERNS: readonly RegExp[] = [
  // Metne / parcaya / dokumana atif
  /(kaynak|verilen|yukaridaki|asagidaki)\s+metn/,
  /metinde\s+(belirtil|gecen|verilen|anlatil)/,
  /metne\s+gore/,
  /parca(ya|da)\s+gore/,
  /(kitabin|kitapta|kitapciktaki|mufredat|dokumanda|tabloya\s+gore|listeye\s+gore)/,
  // Sira / takvim sorulari: "kacinci haftada", "hangi unitede"
  /(kacinci|hangi)\s+(hafta|unite|modul|bolum|asama)/,
  /kac\s+(hafta|ay|saat|gun|ders)\s+(surer|surmekte|ayrilmis)/,
  // Idari / tanitim bilgisi
  /(ucretsiz\s+mi|kontenjan|basvuru\s+tarih|kac\s+ilde|hangi\s+illerde)/,
];

/** Soru kaynaga atif yapiyor mu? */
function looksLikeMetaQuestion(text: string): boolean {
  const ascii = toAscii(text);
  return META_QUESTION_PATTERNS.some((pattern) => pattern.test(ascii));
}

/**
 * Kaynak metin ve kazanimdan soru taslaklari uretir.
 *
 * Uretilen sorular iki asamadan gecer:
 *   1. `normalizeGeneratedQuestion` - veritabani kisitlarina uyum
 *   2. `looksLikeMetaQuestion` - kaynaga atif yapan sorular elenir
 * Eleme sonucu istenen adet tutmazsa BIR kez daha, daha kati bir uyariyla
 * eksik kadar soru istenir.
 *
 * @param context  Icerik uzmaninin yukledigi kaynak metin.
 * @param kazanim  Hedeflenen ogrenme kazanimi.
 */
export async function generateQuestions(
  context: string,
  kazanim: string,
  options: GenerateQuestionsOptions = {},
): Promise<GeneratedQuestion[]> {
  const { count = 5, type = "karisik", topic, styleGuide, categoryLabel } = options;

  if (!context.trim() || !kazanim.trim()) {
    throw new Error("[ai] generateQuestions: context ve kazanim bos olamaz.");
  }

  if (serverEnv.aiMockMode) {
    return mockGenerateQuestions(kazanim, { count, type, topic, styleGuide });
  }

  const typeInstruction =
    type === "karisik"
      ? "Sorularin yaklasik yarisi coktan secmeli (test), yarisi acik uclu olsun."
      : type === "test"
        ? "Tum sorular coktan secmeli (test) olsun; her birinde 4 sik bulunsun."
        : "Tum sorular acik uclu olsun; her biri icin ayrintili rubrik yaz.";

  /*
    Sistem talimati iki hatayi acikca yasakliyor:

      1. "Kaynak metne gore..." kalibi. Model "yalnizca kaynak metinden uret"
         talimatini metne ATIFTA BULUN diye anliyordu; oysa ogrenci sinavda o
         metni gormuyor ve soru havada kaliyor.
      2. Idari/tanitim bilgisi sormak. Yuklenen dosya cogu zaman brosur veya
         program kitapcigi oluyor; model "kurs kac ay surer", "ucretsiz mi"
         gibi konu disi bilgileri olcmeye kalkiyordu. Sinav KAZANIMI olcer.
  */
  const { object } = await generateObject({
    model: getModel(serverEnv.aiModelGeneration),
    schema: generateQuestionsSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin ve Turkce sinav sorulari yazarsin.",
      "SORULAR KAZANIMI OLCER. Kaynak metin yalnizca bilgiyi dogrulamak icindir, sorunun konusu degildir.",
      "ASLA metne atifta bulunma: 'kaynak metne gore', 'metinde belirtildigi gibi', 'yukaridaki metne gore', 'parcaya gore' gibi ifadeleri KULLANMA.",
      "Ogrenci sinavda kaynak metni GORMEYECEK; soru kendi basina anlasilir ve cevaplanabilir olmalidir.",
      "Kurum tanitimi, program suresi, ucret, basvuru tarihi, sehir, kontenjan gibi IDARI bilgileri sorma; konunun kendisini sor (kavram, tanim, sebep-sonuc, islem, uygulama).",
      "Ezber yerine kavrama ve uygulama olc: neden olur, ne ise yarar, hangi durumda kullanilir gibi kurgular tercih et.",
      "Metinde kazanimla ilgili bilgi yoksa bilgi UYDURMA; metnin kazanima en yakin kismindan soru kur.",
      "Coktan secmeli sorularda 4 sik olur, celdiriciler makul ve yakin olur, tek bir dogru cevap bulunur.",
      "Acik uclu sorularda rubrik madde madde yazilir ve maddelerin puan toplami 100 olur.",
      "Istekte TARZ REHBERI varsa, uzmanin begendigi kurguya yaklas ve reddettigi kaliplardan uzak dur.",
    ].join(" "),
    prompt: [
      `OLCULECEK KAZANIM:\n${kazanim}`,
      topic ? `KONU:\n${topic}` : "",
      `BILGI KAYNAGI (yalnizca dogrulama icin, soruda ona atif YAPMA):\n${context}`,
      `GOREV: Yukaridaki kazanimi olcen ${count} adet soru uret. ${typeInstruction}`,
      "HATIRLATMA: Her soru, kaynak metni hic gormemis bir ogrenci tarafindan okunup cevaplanabilmeli.",
      buildStyleGuidePrompt(styleGuide),
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const first = collectUsable(object.questions, topic ?? kazanim);

  // Eleme sonucu adet tutuyorsa is bitti.
  if (first.length >= count) return first.slice(0, count);

  /*
    Elenen soru varsa BIR kez daha deniyoruz. Ikinci istekte hangi kalibin
    reddedildigi acikca yaziliyor; boylece model ayni hataya donmuyor.
    Tek tekrar ile sinirli: her deneme 20-40 saniye suruyor.
  */
  const missing = count - first.length;

  const { object: retry } = await generateObject({
    model: getModel(serverEnv.aiModelGeneration),
    schema: generateQuestionsSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin ve Turkce sinav sorulari yazarsin.",
      "Onceki denemede sorulari REDDEDILDI cunku kaynagin kendisini soruyordu.",
      "Sinav sorusu; kitap, mufredat, tablo, hafta sirasi, program suresi, ucret gibi",
      "seylere ATIFTA BULUNAMAZ. Ogrenci yalnizca soruyu gorur.",
      "Konunun kendisini sor: kavram, tanim, sebep-sonuc, islem adimi, uygulama.",
      "Coktan secmeli sorularda 4 sik olur, tek dogru cevap bulunur.",
      "Acik uclu sorularda rubrik madde madde yazilir, puan toplami 100 olur.",
    ].join(" "),
    prompt: [
      `OLCULECEK KAZANIM:\n${kazanim}`,
      topic ? `KONU:\n${topic}` : "",
      `BILGI KAYNAGI (yalnizca dogrulama icin, soruda ona atif YAPMA):\n${context}`,
      `GOREV: Kazanimi olcen ${missing} adet soru uret. ${typeInstruction}`,
      "YASAK KALIPLAR: 'kaynak metne gore', 'kitabin mufredatina gore', 'kacinci haftada', 'kac hafta surer', 'ucretsiz mi'.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const combined = [...first, ...collectUsable(retry.questions, topic ?? kazanim)];

  if (combined.length === 0) {
    throw new Error(
      "[ai] Uretilen sorularin tamami kaynaga atif yaptigi icin elendi. " +
        "Kaynak metin bir mufredat/tanitim dokumani olabilir; kazanimla ilgili " +
        "anlatim iceren bir bolum yukleyip tekrar deneyin.",
    );
  }

  return combined.slice(0, count);
}

/** Model ciktisini normalize eder ve kaynaga atif yapanlari eler. */
function collectUsable(
  questions: z.infer<typeof generateQuestionsSchema>["questions"],
  fallbackTopic: string,
): GeneratedQuestion[] {
  const usable: GeneratedQuestion[] = [];

  for (const question of questions) {
    if (looksLikeMetaQuestion(question.text)) continue;

    try {
      usable.push(normalizeGeneratedQuestion(question, fallbackTopic));
    } catch {
      // Eksik uretilmis soru (sik veya rubrik yok) sessizce atlanir;
      // cagiran katman eksik adedi tekrar isteyerek telafi eder.
    }
  }

  return usable;
}

/* -------------------------------------------------------------------------- */
/*  reviseQuestion                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Hazir revizyon istekleri.
 *
 * Icerik uzmani cogu zaman ayni dort seyi istiyor; her seferinde yazmasin
 * diye tek tikla gonderilen kalip talimatlar. Anahtarlar arayuzdeki
 * dugmelerle, degerler modele giden metinle eslesir.
 */
export const REVISION_PRESETS = {
  zorlastir:
    "Soruyu ZORLASTIR: daha ust bilissel seviyeye tasi (uygulama, analiz), " +
    "celdiricileri birbirine yaklastir ama tek dogru cevabi koru. Konu ayni kalsin.",
  kolaylastir:
    "Soruyu KOLAYLASTIR: dili sadelestir, tek adimda cevaplanabilir hale getir, " +
    "celdiricileri belirgin sekilde yanlis yap. Konu ayni kalsin.",
  kisalt:
    "Soru kokunu KISALT: gereksiz betimlemeleri at, tek cumleye indir. " +
    "Olculen bilgi ve secenekler ayni kalsin.",
  celdirici:
    "CELDIRICILERI GUCLENDIR: yanlis siklarin her biri yaygin bir kavram " +
    "yanilgisina karsilik gelsin ve makul gorunsun. Dogru cevap degismesin.",
} as const;

export type RevisionPreset = keyof typeof REVISION_PRESETS;

export function isRevisionPreset(value: unknown): value is RevisionPreset {
  return typeof value === "string" && value in REVISION_PRESETS;
}

export interface ReviseQuestionOptions {
  /** DENEYAP atolye dali adi - modele alan baglami verir. */
  categoryLabel?: string;
  /** Sorunun olctugu kazanim; revizyonun hedefi degismesin diye gonderilir. */
  kazanim?: string;
  /** Kaynak metin. Verilirse model bilgi uydurmadan revize eder. */
  context?: string;
}

/**
 * Var olan bir soru taslagini icerik uzmaninin talimatina gore yeniden yazar.
 *
 * Uretimden farki: sifirdan soru uretmez, ELDEKI soruyu degistirir. Soru tipi
 * (test / acik uclu) ve olculen kazanim korunur; degisen sey zorluk, uzunluk
 * veya celdirici kalitesidir.
 *
 * Cikti uretimdeki ayni iki asamadan gecer: sema zorlamasi + kaynaga atif
 * yapan sorulari eleme.
 */
export async function reviseQuestion(
  question: GeneratedQuestion,
  instruction: string,
  options: ReviseQuestionOptions = {},
): Promise<GeneratedQuestion> {
  const trimmed = instruction.trim();
  if (!trimmed) {
    throw new Error("[ai] reviseQuestion: talimat bos olamaz.");
  }

  if (serverEnv.aiMockMode) {
    return mockReviseQuestion(question, trimmed);
  }

  const { categoryLabel, kazanim, context } = options;

  const shapeRule =
    question.type === "test"
      ? "Soru COKTAN SECMELI kalmali: 4 sik ve tek dogru cevap bulunmali, rubric null olmali."
      : "Soru ACIK UCLU kalmali: options ve correct_answer null, rubric madde madde ve toplami 100 puan olmali.";

  const { object } = await generateObject({
    model: getModel(serverEnv.aiModelGeneration),
    schema: generatedQuestionSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin.",
      "Sana VAR OLAN bir sinav sorusu ve uzmanin revizyon talimati verilir.",
      "Soruyu talimata gore yeniden yazarsin; sifirdan yeni bir soru URETMEZSIN.",
      "Sorunun tipi ve olctugu kazanim DEGISMEZ; yalnizca talimatta istenen ozellik degisir.",
      shapeRule,
      "ASLA kaynaga atifta bulunma: 'kaynak metne gore', 'kitaba gore', 'kacinci haftada' gibi ifadeler yasak.",
      "Ogrenci soruyu tek basina okuyup cevaplayabilmeli.",
      "Bilgi uydurma; verilen konunun disina cikma.",
    ].join(" "),
    prompt: [
      categoryLabel ? `ATOLYE DALI:\n${categoryLabel}` : "",
      kazanim ? `OLCULEN KAZANIM:\n${kazanim}` : "",
      context ? `BILGI KAYNAGI (atif YAPMA):\n${context}` : "",
      `MEVCUT SORU:\n${JSON.stringify(
        {
          topic: question.topic,
          text: question.text,
          type: question.type,
          options: question.options,
          correct_answer: question.correct_answer,
          rubric: question.rubric,
          difficulty: question.difficulty,
        },
        null,
        2,
      )}`,
      `UZMANIN TALIMATI:\n${trimmed}`,
      "GOREV: Talimati uygulayarak sorunun revize edilmis halini dondur.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  if (looksLikeMetaQuestion(object.text)) {
    throw new Error(
      "[ai] Revize edilen soru kaynaga atif yaptigi icin reddedildi. Talimati biraz daha acik yazip tekrar deneyin.",
    );
  }

  return normalizeGeneratedQuestion(object, question.topic);
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

  const { object } = await generateObject({
    model: getModel(serverEnv.aiModelGrading),
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
    Pick<GenerateQuestionsOptions, "topic" | "styleGuide">,
): GeneratedQuestion[] {
  const { count, type, topic, styleGuide } = options;
  const resolvedTopic = topic ?? kazanim.split(" ").slice(0, 3).join(" ");
  const likedCount = styleGuide?.liked.length ?? 0;
  const dislikedCount = styleGuide?.disliked.length ?? 0;

  /**
   * Mock modda tarz rehberinin gercekten uygulandigini gorunur kilar:
   * begenilen ornek varsa zorluk dagilimi onlara gore kayar, etiket de bunu yazar.
   */
  const learned = likedCount > 0 || dislikedCount > 0;
  const difficulties = learned
    ? (likedMockDifficulties(styleGuide) ?? (["kolay", "orta", "zor"] as const))
    : (["kolay", "orta", "zor"] as const);

  return Array.from({ length: count }, (_, index): GeneratedQuestion => {
    const isTest = type === "test" || (type === "karisik" && index % 2 === 0);
    const difficulty = difficulties[index % difficulties.length] ?? "orta";

    if (isTest) {
      return {
        topic: resolvedTopic,
        text: `[MOCK${learned ? " · ogrenilmis tarz" : ""}] "${kazanim}" kazanimini olcen ${index + 1}. coktan secmeli soru.`,
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
      text: `[MOCK${learned ? " · ogrenilmis tarz" : ""}] "${kazanim}" kazanimini olcen ${index + 1}. acik uclu soru.`,
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

/**
 * Mock modda revizyon: gercek model cagrilmaz, degisiklik gorunur kilinir.
 * Zorluk talimata gore kaydirilir ve soru kokune etiket eklenir.
 */
function mockReviseQuestion(
  question: GeneratedQuestion,
  instruction: string,
): GeneratedQuestion {
  const lower = instruction.toLocaleLowerCase("tr");

  const difficulty: GeneratedQuestion["difficulty"] = lower.includes("zorlastir")
    ? "zor"
    : lower.includes("kolaylastir")
      ? "kolay"
      : question.difficulty;

  const text = lower.includes("kisalt")
    ? `[MOCK revize] ${question.text.split(" ").slice(0, 8).join(" ")}?`
    : `[MOCK revize] ${question.text}`;

  return { ...question, text, difficulty };
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

/**
 * Mock modda "ogrenme" etkisini gorunur kilar: uzmanin begendigi orneklerdeki
 * zorluk dagilimini one cikarir. Gercek modda bu isi modelin kendisi yapar.
 */
function likedMockDifficulties(
  styleGuide: StyleGuide | undefined,
): readonly GeneratedQuestion["difficulty"][] | null {
  const liked = styleGuide?.liked ?? [];
  if (liked.length === 0) return null;

  const valid: GeneratedQuestion["difficulty"][] = liked
    .map((preference) => preference.difficulty)
    .filter(
      (value): value is GeneratedQuestion["difficulty"] =>
        value === "kolay" || value === "orta" || value === "zor",
    );

  return valid.length > 0 ? valid : null;
}
