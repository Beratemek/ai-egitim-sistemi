/**
 * SINAV KESTIRIMI - sinavi ogrenciye vermeden once sonucunu tahmin etmek.
 *
 * Soru kalitesi katmani (lib/student-agents.ts) TEK bir sorunun olcme
 * ozelliklerini inceler. Bu katman baska bir soruyu cevaplar: "bu sinavi bu
 * sinifa versem ne olur?" - ortalama kac cikar, sinif ayrisir mi, hangi
 * kazanimda dusulur, sure yeter mi.
 *
 * KADRO NEREDEN GELIR
 *   - Egitmen elle kurar ("matematikte iyi, fizikte zayif 12 ogrenci"), ya da
 *   - gercek bir siniftan turetilir (bkz. `buildClassroomTwin`): sinifin
 *     gecmis basarisi yetkinlik dilimlerine bolunur, her dilim bir temsilci
 *     profille ve dilimdeki ogrenci sayisi kadar AGIRLIKLA canlandirilir.
 *
 * AGIRLIK NEDEN: 25 kisilik sinifi 25 agent'la simule etmek 25 kat maliyet
 * demek ve gereksiz - amac tek tek ogrencileri degil DAGILIMI kestirmek.
 * Butun istatistikler agirlikli hesaplaniyor, dolayisiyla bes temsilciyle
 * yapilan kestirim 25 kisilik sinifin dagilimini verir.
 *
 * NEYIN GUVENILIR OLDUGU KONUSUNDA DURUSTLUK
 * Dil modelinin verdigi MUTLAK puan tahmini (68 mi 74 mu) guvenilir degildir.
 * Guvenilir olan SIRALAMA ve AYRISMA'dir: hangi soru daha zor, sinav sinifi
 * ayiriyor mu, hangi kazanimda toplu dusus var. Bu yuzden rapor mutlak
 * ortalamanin yaninda dagilimi, ayrismayi ve soru bazinda siralamayi da
 * tasiyor; arayuz mutlak sayiyi tek basina one cikarmiyor. Kalibrasyon
 * katmani (tahmin - gercek karsilastirmasi) bu sapmayi zamanla olcup
 * gorunur kilar.
 *
 * Bu dosya SAF: model cagrisi yok, yalnizca gelen cevaplardan istatistik
 * uretir. Cagrilar `lib/ai.ts` icindeki `simulateExam()`de.
 */

import { normalizeOptionKey } from "./answer-normalization.ts";
import type { CohortMember, ProfileGroup, StudentProfile } from "./student-profiles.ts";
import type { QuestionOption, QuestionType } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Girdi                                                                     */
/* -------------------------------------------------------------------------- */

/** Simulasyona giren tek bir sinav sorusu. */
export interface SimulationQuestion {
  questionId: string;
  /** Sinavdaki sira numarasi, 1'den baslar. */
  position: number;
  text: string;
  type: QuestionType;
  options: QuestionOption[] | null;
  correctAnswer: string | null;
  rubric: string | null;
  difficulty: string | null;
  subject: string;
  topic: string;
  outcomeId: string | null;
  outcomeText: string | null;
  /** Sinavdaki puan agirligi. */
  points: number;
}

/** Bir profilin bir soruya verdigi cevap. */
export interface SimulatedAnswer {
  profileId: string;
  questionId: string;
  /** Test sorusunda sik anahtari; acik ucluda cevap metni. */
  answer: string;
  confidence: number;
  /**
   * Acik uclu soruda rubrige gore alinan puan (0-100).
   * Test sorusunda null - dogruluk anahtar karsilastirmasindan cikar.
   */
  rubricScore: number | null;
}

export interface ExamSimulationInput {
  cohort: readonly CohortMember[];
  questions: readonly SimulationQuestion[];
  answers: readonly SimulatedAnswer[];
  /** Sinav suresi (dakika); yoksa sure uyumu hesaplanmaz. */
  durationMinutes: number | null;
  /** Kadronun adi - "9-A dijital ikizi", "Elle kurulan sinif". */
  cohortLabel: string;
}

/* -------------------------------------------------------------------------- */
/*  Cikti                                                                     */
/* -------------------------------------------------------------------------- */

export interface SimulatedStudentResult {
  profileId: string;
  label: string;
  group: ProfileGroup;
  /** Kac gercek ogrenciyi temsil ediyor. */
  weight: number;
  /** 100 uzerinden puan agirlikli sonuc. */
  score: number;
  /** Dogru cevapladigi test sorusu sayisi. */
  correctCount: number;
  /** Cevapladigi soru sayisi (bos birakilanlar disarida). */
  answeredCount: number;
  /** Bu profilin sinavi bitirmesi icin gereken tahmini sure (dakika). */
  estimatedMinutes: number;
}

export const SIMULATION_QUESTION_WARNINGS = [
  "cok_kolay",
  "cok_zor",
  "ters_ayirt_edicilik",
  "dusuk_ayirt_edicilik",
] as const;

export type SimulationQuestionWarning =
  (typeof SIMULATION_QUESTION_WARNINGS)[number];

export interface SimulatedQuestionResult {
  questionId: string;
  position: number;
  text: string;
  type: QuestionType;
  points: number;
  subject: string;
  outcomeId: string | null;
  outcomeText: string | null;
  /** Agirlikli basari orani, 0-1. Acik ucluda ortalama rubrik puani / 100. */
  pDegeri: number;
  /** Ust grup - alt grup basari farki; gruplar eksikse null. */
  ayirtEdicilik: number | null;
  /** Test sorusunda en cok tercih edilen YANLIS sik; yoksa null. */
  enCokSecilenYanlis: { key: string; text: string; rate: number } | null;
  warnings: SimulationQuestionWarning[];
}

export interface OutcomeForecast {
  outcomeId: string;
  outcomeText: string;
  /** Kazanimi olcen sorularin agirlikli ortalamasi, 0-100. */
  averageScore: number;
  questionCount: number;
}

export interface ScoreDistribution {
  mean: number;
  median: number;
  min: number;
  max: number;
  /** Agirlikli standart sapma - sinif ne kadar yayilmis. */
  stdDev: number;
  /** 50 ve uzeri alanlarin orani, 0-1. */
  passRate: number;
  /** Yirmilik dilimler; `count` temsil edilen gercek ogrenci sayisi. */
  buckets: Array<{ from: number; to: number; count: number }>;
}

export interface DurationForecast {
  /** Sinav suresi; tanimsizsa null. */
  examMinutes: number | null;
  /** Kadronun ortanca bitirme suresi. */
  medianMinutes: number;
  /** En yavas dilimin bitirme suresi (agirlikli %90'lik). */
  slowestMinutes: number;
  /** Sure tanimliysa: en yavas ogrenci yetistirebiliyor mu. */
  fits: boolean | null;
}

export const SIMULATION_WARNINGS = [
  "sinav_cok_zor",
  "sinav_cok_kolay",
  "ayrisma_yok",
  "sure_yetersiz",
  "sure_fazla",
  "riskli_soru_yogun",
] as const;

export type SimulationWarningCode = (typeof SIMULATION_WARNINGS)[number];

export interface SimulationWarning {
  code: SimulationWarningCode;
  severity: "yuksek" | "orta" | "dusuk";
  title: string;
  detail: string;
  /** Ilgili soru numaralari; sinavin tamamiyla ilgiliyse bos. */
  questionNumbers: number[];
}

export interface ExamSimulationReport {
  cohortLabel: string;
  /** Kestirimi yapan kadro; rapora gomulu ki sonradan da okunabilsin. */
  profiles: StudentProfile[];
  /** Kadronun temsil ettigi toplam ogrenci sayisi. */
  studentCount: number;
  totalPoints: number;
  students: SimulatedStudentResult[];
  questions: SimulatedQuestionResult[];
  outcomes: OutcomeForecast[];
  distribution: ScoreDistribution;
  /**
   * Sinavin ayrisma gucu: ust grup ortalamasi - alt grup ortalamasi (0-100).
   * Gruplardan biri yoksa null.
   */
  separation: number | null;
  duration: DurationForecast;
  warnings: SimulationWarning[];
}

export const SIMULATION_THRESHOLDS = {
  /** Sinav ortalamasi bunun altindaysa cok zor. */
  cokZorOrtalama: 40,
  /** Sinav ortalamasi bunun ustundeyse cok kolay. */
  cokKolayOrtalama: 85,
  /** Ust ve alt grup en az bu kadar puan ayrismali. */
  ayrismaEsigi: 10,
  /** Soru bazinda cok kolay sayilma esigi (agirlikli basari orani). */
  soruCokKolayP: 0.92,
  /** Soru bazinda cok zor sayilma esigi. */
  soruCokZorP: 0.2,
  /** Soru bazinda dusuk ayirt edicilik esigi. */
  soruDusukAyirtEdicilik: 0.15,
  /** Sinavin bu oranindan fazlasi riskliyse uyari verilir. */
  riskliSoruOrani: 0.3,
  /** Tahmini sure, sinav suresinin bu katindan azsa "sure fazla". */
  sureFazlaOrani: 0.45,
} as const;

/* -------------------------------------------------------------------------- */
/*  Sure kestirimi                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Sure kestirimi SEFFAF BIR VARSAYIM, model ciktisi degil.
 *
 * Modele "bu soru kac dakika surer" diye sormak cazip ama guvenilmez: dil
 * modeli sureyi olcmez, tahmin eder ve tahmini baglamdan bagimsiz kayar.
 * Onun yerine gozlenebilir iki seyden hesapliyoruz - metnin uzunlugu ve
 * sorunun tipi/zorlugu - sonra profilin hizina gore olcekliyoruz. Sayilar
 * burada acikca duruyor, isteyen degistirir.
 */
export const DURATION_MODEL = {
  /** Dikkatli sinav okumasi: dakikada kelime. */
  wordsPerMinute: 130,
  /** Test sorusunda dusunme suresi (dakika), zorluga gore. */
  thinkMinutes: { kolay: 0.4, orta: 0.8, zor: 1.6 } as Record<string, number>,
  /** Acik uclu soruda yazma suresi: taban + puan basina ek. */
  openEndedBase: 3,
  openEndedPerPoint: 0.04,
} as const;

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Tek bir sorunun tek bir profil icin tahmini cozum suresi (dakika). */
export function estimateSolveMinutes(
  question: SimulationQuestion,
  profile: StudentProfile,
): number {
  const optionWords = (question.options ?? []).reduce(
    (total, option) => total + wordCount(option.text),
    0,
  );
  const readingMinutes =
    (wordCount(question.text) + optionWords) / DURATION_MODEL.wordsPerMinute;

  const thinkMinutes =
    question.type === "acik_uclu"
      ? DURATION_MODEL.openEndedBase + question.points * DURATION_MODEL.openEndedPerPoint
      : DURATION_MODEL.thinkMinutes[question.difficulty ?? "orta"] ??
        DURATION_MODEL.thinkMinutes.orta ??
        0.8;

  /*
    Iki carpan:
      - Yetkinlik dusukse ogrenci daha uzun bakar (ama sonsuza kadar degil).
      - Dikkat yuksekse kontrol eder, yavaslar; aceleci ogrenci hizlanir.
    Ikisi de dar araliklarda tutuluyor; amac siralamayi dogru vermek, dakikayi
    kesin bilmek degil.
  */
  const yetkinlikCarpani = 1 + (1 - profile.ability) * 0.5;
  const dikkatCarpani = 0.8 + profile.diligence * 0.4;

  return (readingMinutes + thinkMinutes) * yetkinlikCarpani * dikkatCarpani;
}

/* -------------------------------------------------------------------------- */
/*  Agirlikli istatistik yardimcilari                                         */
/* -------------------------------------------------------------------------- */

interface Weighted {
  value: number;
  weight: number;
}

function weightedMean(items: readonly Weighted[]): number | null {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  if (totalWeight === 0) return null;
  return (
    items.reduce((total, item) => total + item.value * item.weight, 0) / totalWeight
  );
}

/**
 * Agirlikli yuzdelik.
 *
 * Agirlik "kac ogrenci" demek oldugu icin dogrudan tekrar sayisi gibi
 * davraniyor: siralanip birikimli agirlik hedefe ulastiginda o degeri
 * donduruyoruz. Ara deger enterpolasyonu YAPILMIYOR - temsilci profil sayisi
 * az oldugundan enterpolasyon var olmayan bir kesinlik hissi verirdi.
 */
function weightedQuantile(items: readonly Weighted[], quantile: number): number {
  if (items.length === 0) return 0;

  const sirali = [...items].sort((a, b) => a.value - b.value);
  const totalWeight = sirali.reduce((total, item) => total + item.weight, 0);
  if (totalWeight === 0) return sirali[0]?.value ?? 0;

  const hedef = totalWeight * quantile;
  let birikim = 0;

  for (const item of sirali) {
    birikim += item.weight;
    if (birikim >= hedef) return item.value;
  }

  return sirali[sirali.length - 1]?.value ?? 0;
}

function weightedStdDev(items: readonly Weighted[]): number {
  const ortalama = weightedMean(items);
  if (ortalama === null) return 0;

  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  if (totalWeight === 0) return 0;

  const varyans =
    items.reduce(
      (total, item) => total + item.weight * (item.value - ortalama) ** 2,
      0,
    ) / totalWeight;

  return Math.sqrt(varyans);
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/* -------------------------------------------------------------------------- */
/*  Rapor                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Simule cevaplardan sinav kestirim raporu uretir.
 *
 * SAF FONKSIYON. Model cagrisi burada degil; esikler ve formuller kota
 * harcamadan test edilebiliyor (tests/exam-simulation.test.ts).
 */
export function buildExamSimulationReport(
  input: ExamSimulationInput,
): ExamSimulationReport {
  const { cohort, questions, answers, durationMinutes, cohortLabel } = input;

  const totalPoints = questions.reduce((total, question) => total + question.points, 0);
  const studentCount = cohort.reduce((total, member) => total + member.weight, 0);

  /* Cevaplari (profil, soru) anahtariyla indeksle. */
  const answerIndex = new Map<string, SimulatedAnswer>();
  for (const answer of answers) {
    answerIndex.set(answerKey(answer.profileId, answer.questionId), answer);
  }

  /** Tek bir cevabin 0-100 arasi puani. */
  const scoreOf = (
    question: SimulationQuestion,
    answer: SimulatedAnswer | undefined,
  ): number => {
    if (!answer) return 0;
    if (question.type === "acik_uclu") {
      return Math.max(0, Math.min(100, answer.rubricScore ?? 0));
    }
    if (!question.correctAnswer) return 0;
    return normalizeOptionKey(answer.answer) ===
      normalizeOptionKey(question.correctAnswer)
      ? 100
      : 0;
  };

  const students = cohort.map((member): SimulatedStudentResult => {
    let kazanilan = 0;
    let dogru = 0;
    let cevaplanan = 0;
    let dakika = 0;

    for (const question of questions) {
      const answer = answerIndex.get(answerKey(member.profile.id, question.questionId));
      const puan = scoreOf(question, answer);

      kazanilan += (puan / 100) * question.points;
      if (answer) cevaplanan += 1;
      if (question.type === "test" && puan === 100) dogru += 1;
      dakika += estimateSolveMinutes(question, member.profile);
    }

    return {
      profileId: member.profile.id,
      label: member.profile.label,
      group: member.profile.group,
      weight: member.weight,
      score: totalPoints > 0 ? round((kazanilan / totalPoints) * 100) : 0,
      correctCount: dogru,
      answeredCount: cevaplanan,
      estimatedMinutes: round(dakika),
    };
  });

  const weightByProfile = new Map(
    cohort.map((member) => [member.profile.id, member.weight]),
  );
  const groupByProfile = new Map(
    cohort.map((member) => [member.profile.id, member.profile.group]),
  );

  const questionResults = questions.map((question): SimulatedQuestionResult => {
    const puanlar = cohort.map((member) => ({
      profileId: member.profile.id,
      weight: member.weight,
      value:
        scoreOf(
          question,
          answerIndex.get(answerKey(member.profile.id, question.questionId)),
        ) / 100,
    }));

    const pDegeri = weightedMean(puanlar) ?? 0;
    const ayirtEdicilik = groupDifference(puanlar, groupByProfile);

    return {
      questionId: question.questionId,
      position: question.position,
      text: question.text,
      type: question.type,
      points: question.points,
      subject: question.subject,
      outcomeId: question.outcomeId,
      outcomeText: question.outcomeText,
      pDegeri: round(pDegeri, 2),
      ayirtEdicilik: ayirtEdicilik === null ? null : round(ayirtEdicilik, 2),
      enCokSecilenYanlis: topWrongOption(question, answers, weightByProfile, studentCount),
      warnings: questionWarnings(pDegeri, ayirtEdicilik),
    };
  });

  const scoreItems: Weighted[] = students.map((student) => ({
    value: student.score,
    weight: student.weight,
  }));

  const distribution = buildDistribution(scoreItems);
  const separation = groupDifference(
    students.map((student) => ({
      profileId: student.profileId,
      weight: student.weight,
      value: student.score,
    })),
    groupByProfile,
  );

  const durationItems: Weighted[] = students.map((student) => ({
    value: student.estimatedMinutes,
    weight: student.weight,
  }));
  const duration: DurationForecast = {
    examMinutes: durationMinutes,
    medianMinutes: round(weightedQuantile(durationItems, 0.5)),
    slowestMinutes: round(weightedQuantile(durationItems, 0.9)),
    fits:
      durationMinutes === null
        ? null
        : weightedQuantile(durationItems, 0.9) <= durationMinutes,
  };

  return {
    cohortLabel,
    profiles: cohort.map((member) => member.profile),
    studentCount,
    totalPoints,
    students,
    questions: questionResults,
    outcomes: forecastOutcomes(questions, questionResults),
    distribution,
    separation: separation === null ? null : round(separation),
    duration,
    warnings: buildWarnings({
      distribution,
      separation,
      duration,
      questions: questionResults,
    }),
  };
}

function answerKey(profileId: string, questionId: string): string {
  return `${profileId} ${questionId}`;
}

/** Ust grup ortalamasi eksi alt grup ortalamasi. */
function groupDifference(
  items: readonly { profileId: string; weight: number; value: number }[],
  groupByProfile: ReadonlyMap<string, ProfileGroup>,
): number | null {
  const ust = items.filter((item) => groupByProfile.get(item.profileId) === "ust");
  const alt = items.filter((item) => groupByProfile.get(item.profileId) === "alt");

  const ustOrtalama = weightedMean(ust);
  const altOrtalama = weightedMean(alt);
  if (ustOrtalama === null || altOrtalama === null) return null;

  return ustOrtalama - altOrtalama;
}

/**
 * Test sorusunda en cok tercih edilen YANLIS sik.
 *
 * Yalnizca bilgi degil, eylem: bir celdirici dogru cevaptan cok seciliyorsa o
 * sik ya savunulabilir ya da soru kokunun yanlis yonlendirdigi anlamina gelir
 * - egitmen sinavdan once bakmali.
 */
function topWrongOption(
  question: SimulationQuestion,
  answers: readonly SimulatedAnswer[],
  weightByProfile: ReadonlyMap<string, number>,
  studentCount: number,
): { key: string; text: string; rate: number } | null {
  if (question.type !== "test" || !question.correctAnswer) return null;

  const dogruKey = normalizeOptionKey(question.correctAnswer);
  const agirliklar = new Map<string, number>();

  for (const answer of answers) {
    if (answer.questionId !== question.questionId) continue;
    const key = normalizeOptionKey(answer.answer);
    if (key === dogruKey) continue;
    agirliklar.set(
      key,
      (agirliklar.get(key) ?? 0) + (weightByProfile.get(answer.profileId) ?? 0),
    );
  }

  let enCok: { key: string; weight: number } | null = null;
  for (const [key, weight] of agirliklar) {
    if (!enCok || weight > enCok.weight) enCok = { key, weight };
  }

  if (!enCok || enCok.weight === 0 || studentCount === 0) return null;

  const option = (question.options ?? []).find(
    (item) => normalizeOptionKey(item.key) === enCok.key,
  );

  return {
    key: option?.key ?? enCok.key,
    text: option?.text ?? "",
    rate: round(enCok.weight / studentCount, 2),
  };
}

function questionWarnings(
  pDegeri: number,
  ayirtEdicilik: number | null,
): SimulationQuestionWarning[] {
  const warnings: SimulationQuestionWarning[] = [];

  if (pDegeri >= SIMULATION_THRESHOLDS.soruCokKolayP) warnings.push("cok_kolay");
  if (pDegeri <= SIMULATION_THRESHOLDS.soruCokZorP) warnings.push("cok_zor");

  if (ayirtEdicilik !== null) {
    if (ayirtEdicilik < 0) warnings.push("ters_ayirt_edicilik");
    else if (ayirtEdicilik < SIMULATION_THRESHOLDS.soruDusukAyirtEdicilik) {
      warnings.push("dusuk_ayirt_edicilik");
    }
  }

  return warnings;
}

/** Kazanim bazinda tahmini basari; en zayif kazanim en ustte. */
function forecastOutcomes(
  questions: readonly SimulationQuestion[],
  results: readonly SimulatedQuestionResult[],
): OutcomeForecast[] {
  const byOutcome = new Map<
    string,
    { text: string; toplam: number; agirlik: number; sayi: number }
  >();

  const resultById = new Map(results.map((result) => [result.questionId, result]));

  for (const question of questions) {
    if (!question.outcomeId) continue;
    const result = resultById.get(question.questionId);
    if (!result) continue;

    const entry = byOutcome.get(question.outcomeId) ?? {
      text: question.outcomeText ?? "Kazanım",
      toplam: 0,
      agirlik: 0,
      sayi: 0,
    };
    // Sorular PUANIYLA agirliklaniyor: 20 puanlik bir soru, 5 puanliktan daha
    // cok sey soyler.
    entry.toplam += result.pDegeri * 100 * question.points;
    entry.agirlik += question.points;
    entry.sayi += 1;
    byOutcome.set(question.outcomeId, entry);
  }

  return [...byOutcome.entries()]
    .map(([outcomeId, entry]) => ({
      outcomeId,
      outcomeText: entry.text,
      averageScore: entry.agirlik > 0 ? round(entry.toplam / entry.agirlik) : 0,
      questionCount: entry.sayi,
    }))
    .sort((a, b) => a.averageScore - b.averageScore);
}

function buildDistribution(items: readonly Weighted[]): ScoreDistribution {
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  const values = items.map((item) => item.value);

  const buckets = [0, 20, 40, 60, 80].map((from) => {
    const to = from + 20;
    const count = items
      // Son dilim 100'u de kapsar; aksi halde tam puan hicbir dilime girmezdi.
      .filter((item) => item.value >= from && (to === 100 ? item.value <= to : item.value < to))
      .reduce((total, item) => total + item.weight, 0);
    return { from, to, count };
  });

  const gecen = items
    .filter((item) => item.value >= 50)
    .reduce((total, item) => total + item.weight, 0);

  return {
    mean: round(weightedMean(items) ?? 0),
    median: round(weightedQuantile(items, 0.5)),
    min: values.length > 0 ? round(Math.min(...values)) : 0,
    max: values.length > 0 ? round(Math.max(...values)) : 0,
    stdDev: round(weightedStdDev(items)),
    passRate: totalWeight > 0 ? round(gecen / totalWeight, 2) : 0,
    buckets,
  };
}

function buildWarnings(input: {
  distribution: ScoreDistribution;
  separation: number | null;
  duration: DurationForecast;
  questions: readonly SimulatedQuestionResult[];
}): SimulationWarning[] {
  const { distribution, separation, duration, questions } = input;
  const warnings: SimulationWarning[] = [];

  if (distribution.mean <= SIMULATION_THRESHOLDS.cokZorOrtalama) {
    warnings.push({
      code: "sinav_cok_zor",
      severity: "yuksek",
      title: "Sınav bu sınıf için çok zor",
      detail:
        `Tahmini ortalama %${distribution.mean}, geçme oranı %${Math.round(distribution.passRate * 100)}. ` +
        "Bu düzeyde bir sonuç sınıfı ayrıştırmaz, yalnızca herkesi aşağı çeker.",
      questionNumbers: questions
        .filter((question) => question.warnings.includes("cok_zor"))
        .map((question) => question.position),
    });
  }

  if (distribution.mean >= SIMULATION_THRESHOLDS.cokKolayOrtalama) {
    warnings.push({
      code: "sinav_cok_kolay",
      severity: "orta",
      title: "Sınav bu sınıf için çok kolay",
      detail:
        `Tahmini ortalama %${distribution.mean}. Tavan etkisi var: iyi öğrenciyle çok iyi ` +
        "öğrenci arasındaki fark ölçülemiyor.",
      questionNumbers: questions
        .filter((question) => question.warnings.includes("cok_kolay"))
        .map((question) => question.position),
    });
  }

  if (separation !== null && separation < SIMULATION_THRESHOLDS.ayrismaEsigi) {
    warnings.push({
      code: "ayrisma_yok",
      severity: "yuksek",
      title: "Sınav sınıfı ayrıştırmıyor",
      detail:
        `Üst ve alt grup arasında yalnızca ${round(separation)} puan fark var. ` +
        "Sınav, konuyu bilen öğrenciyi bilmeyenden ayırt edemiyor.",
      questionNumbers: questions
        .filter(
          (question) =>
            question.warnings.includes("dusuk_ayirt_edicilik") ||
            question.warnings.includes("ters_ayirt_edicilik"),
        )
        .map((question) => question.position),
    });
  }

  if (duration.examMinutes !== null && duration.fits === false) {
    warnings.push({
      code: "sure_yetersiz",
      severity: "yuksek",
      title: "Süre yetmeyebilir",
      detail:
        `Yavaş çalışan öğrenciler için tahmini süre ${duration.slowestMinutes} dakika, ` +
        `sınav süresi ${duration.examMinutes} dakika. Süre baskısı ölçmek istediğiniz ` +
        "şeyi gölgeler.",
      questionNumbers: [],
    });
  }

  if (
    duration.examMinutes !== null &&
    duration.slowestMinutes <
      duration.examMinutes * SIMULATION_THRESHOLDS.sureFazlaOrani
  ) {
    warnings.push({
      code: "sure_fazla",
      severity: "dusuk",
      title: "Süre gereğinden uzun",
      detail:
        `En yavaş öğrenci bile ${duration.slowestMinutes} dakikada bitiriyor; sınav süresi ` +
        `${duration.examMinutes} dakika. Süreyi kısaltabilir ya da soru ekleyebilirsiniz.`,
      questionNumbers: [],
    });
  }

  const riskli = questions.filter((question) => question.warnings.length > 0);
  if (
    questions.length > 0 &&
    riskli.length / questions.length > SIMULATION_THRESHOLDS.riskliSoruOrani
  ) {
    warnings.push({
      code: "riskli_soru_yogun",
      severity: "orta",
      title: "Riskli soru oranı yüksek",
      detail:
        `${questions.length} sorunun ${riskli.length} tanesi çok kolay, çok zor ya da ayırt ` +
        "edici değil. Bu soruları tek tek sanal sınıfta inceleyin.",
      questionNumbers: riskli.map((question) => question.position),
    });
  }

  const order: Readonly<Record<SimulationWarning["severity"], number>> = {
    yuksek: 0,
    orta: 1,
    dusuk: 2,
  };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}
