/**
 * Soru havuzunun kirilimi - saf yardimcilar (React'ten bagimsiz).
 *
 * Havuz "ders -> konu -> soru" seklinde kirilir. Ikisi de serbest metin
 * (`questions.subject` / `questions.topic`); icerik uzmani soruyu uretirken
 * belirler.
 */

// Goreli yol: bu modul birim testinden dogrudan cagriliyor ve Node test
// calistiricisi tsconfig yol takma adlarini ("@/lib/...") cozemiyor.
import type { Question } from "./types.ts";

/** Turkce siralama; "Cografya" < "Cebir" hatasina dusmemek icin. */
const collator = new Intl.Collator("tr", { sensitivity: "base" });

/* -------------------------------------------------------------------------- */
/*  Konu bazli gruplama                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Bir gruptaki soru tiplerinin dagilimi.
 *
 * Yalnizca toplam sayi gostermek yetmiyordu: egitmen "50 soru" goruyor ama
 * kacinin klasik oldugunu bilmeden sinav kurarken kac klasik soru
 * isteyecegini kestiremiyordu.
 */
export interface TypeCounts {
  test: number;
  acikUclu: number;
}

export function countByType(questions: readonly Question[]): TypeCounts {
  let test = 0;
  for (const question of questions) if (question.type === "test") test += 1;
  return { test, acikUclu: questions.length - test };
}

/** Birden fazla konunun tip dagilimini toplar. */
export function countTopicsByType(groups: readonly TopicGroup[]): TypeCounts {
  let test = 0;
  let acikUclu = 0;
  for (const group of groups) {
    const sayim = countByType(group.questions);
    test += sayim.test;
    acikUclu += sayim.acikUclu;
  }
  return { test, acikUclu };
}

/** "40 test · 10 klasik" - kartlarda ve listelerde ortak bicim. */
export function formatTypeCounts(counts: TypeCounts): string {
  const parcalar: string[] = [];
  if (counts.test > 0) parcalar.push(`${counts.test} test`);
  if (counts.acikUclu > 0) parcalar.push(`${counts.acikUclu} klasik`);
  return parcalar.join(" · ") || "soru yok";
}

export interface TopicGroup {
  topic: string;
  questions: Question[];
}

/**
 * Sorulari konuya gore gruplar. Gruplar konu adina, grup icindeki sorular
 * once tipe (once coktan secmeli) sonra olusturulma sirasina gore dizilir.
 */
export function groupByTopic(questions: readonly Question[]): TopicGroup[] {
  const buckets = new Map<string, Question[]>();

  for (const question of questions) {
    const topic = question.topic.trim() || "Konusuz";
    const bucket = buckets.get(topic);
    if (bucket) bucket.push(question);
    else buckets.set(topic, [question]);
  }

  return [...buckets.entries()]
    .map(([topic, items]) => ({
      topic,
      questions: [...items].sort(byTypeThenDate),
    }))
    .sort((a, b) => collator.compare(a.topic, b.topic));
}

function byTypeThenDate(a: Question, b: Question): number {
  if (a.type !== b.type) return a.type === "test" ? -1 : 1;
  return a.created_at.localeCompare(b.created_at);
}

/* -------------------------------------------------------------------------- */
/*  Ders bazli gruplama                                                       */
/* -------------------------------------------------------------------------- */

/** Ders bilgisi girilmemis sorularin toplandigi kutu. */
export const UNASSIGNED_SUBJECT = "Ders atanmamis";

export interface SubjectGroup {
  subject: string;
  topics: TopicGroup[];
  /** Derse bagli toplam soru sayisi - kartta gostermek icin. */
  questionCount: number;
}

/**
 * Havuzu "ders -> konu -> soru" olarak kirar.
 *
 * Gruplar sorulardan TURETILIR: altinda sorusu olmayan bir ders ya da konu
 * hic olusmaz. Ayni ders adini tasiyan sorular tek kutuda birlesir.
 */
export function groupBySubject(questions: readonly Question[]): SubjectGroup[] {
  const buckets = new Map<string, Question[]>();

  for (const question of questions) {
    const subject = question.subject?.trim() || UNASSIGNED_SUBJECT;
    const bucket = buckets.get(subject);
    if (bucket) bucket.push(question);
    else buckets.set(subject, [question]);
  }

  return [...buckets.entries()]
    .map(([subject, items]) => ({
      subject,
      topics: groupByTopic(items),
      questionCount: items.length,
    }))
    .sort((a, b) => {
      // Dersi atanmamislar her zaman en sonda dursun.
      if (a.subject === UNASSIGNED_SUBJECT) return 1;
      if (b.subject === UNASSIGNED_SUBJECT) return -1;
      return collator.compare(a.subject, b.subject);
    });
}

/* -------------------------------------------------------------------------- */
/*  Atolye dali bazli gruplama (havuzun ust kirilimi)                         */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*  Otomatik secim                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Konular arasinda sirayla gezerek `count` adet soru secer.
 * Boylece 3 konudan 12 soru istendiginde her konudan 4'er soru gelir;
 * bir konu tukenirse kalan konulardan devam eder.
 *
 * Bilincli olarak rastgele degil: ayni havuz + ayni sayi hep ayni sonucu
 * verir, sunucu ve istemci ciktisi ayrisip hydration hatasi olusmaz.
 */
export function pickBalanced(groups: readonly TopicGroup[], count: number): string[] {
  const picked: string[] = [];
  const cursors = new Array<number>(groups.length).fill(0);

  let progressed = true;
  while (picked.length < count && progressed) {
    progressed = false;

    for (let index = 0; index < groups.length && picked.length < count; index += 1) {
      const cursor = cursors[index] ?? 0;
      const question = groups[index]?.questions[cursor];
      if (!question) continue;

      cursors[index] = cursor + 1;
      picked.push(question.id);
      progressed = true;
    }
  }

  return picked;
}

export interface TypeQuota {
  /** Istenen coktan secmeli soru sayisi. */
  test: number;
  /** Istenen acik uclu soru sayisi. */
  acikUclu: number;
}

export interface PickByTypeResult {
  ids: string[];
  /** Havuzda yeterli soru olmadigi icin karsilanamayan sayilar. */
  eksik: TypeQuota;
}

/**
 * Tipe gore kotali, konular arasinda dengeli secim.
 *
 * `pickBalanced` toplam sayiya bakiyordu; sinav kurarken egitmen "10 test +
 * 5 klasik" gibi dusunuyor. Iki tip AYRI havuzlardan cekilir, her biri kendi
 * icinde konular arasinda sirayla dagitilir - boylece 10 testin hepsi tek
 * konudan gelmez.
 *
 * Havuz yetmezse eksik kalan sayi geri bildirilir; sessizce az soru dondurup
 * egitmene "istedigin sinav kuruldu" demek yanlis olurdu.
 */
export function pickBalancedByType(
  groups: readonly TopicGroup[],
  quota: TypeQuota,
): PickByTypeResult {
  const sadece = (type: Question["type"]): TopicGroup[] =>
    groups
      .map((group) => ({
        topic: group.topic,
        questions: group.questions.filter((question) => question.type === type),
      }))
      .filter((group) => group.questions.length > 0);

  const testIds = pickBalanced(sadece("test"), quota.test);
  const acikIds = pickBalanced(sadece("acik_uclu"), quota.acikUclu);

  return {
    ids: [...testIds, ...acikIds],
    eksik: {
      test: Math.max(0, quota.test - testIds.length),
      acikUclu: Math.max(0, quota.acikUclu - acikIds.length),
    },
  };
}
