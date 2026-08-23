/**
 * Sinav kagidi duzeni - saf yardimcilar (React'ten bagimsiz, test edilebilir).
 *
 * Olcu klasik lise sinav kagidindan alindi: bir A4 yaprakta iki sutun,
 * her sutunda bes soru. 20 soruluk bir sinav boylece tam iki yuze oturur:
 * on yuzde 5 + 5, arka yuzde 5 + 5.
 */

import type { Question } from "@/lib/types";

export const QUESTIONS_PER_COLUMN = 5;
export const COLUMNS_PER_PAGE = 2;
/** Bir yaprakta gosterilen soru sayisi (5 + 5). */
export const QUESTIONS_PER_PAGE = QUESTIONS_PER_COLUMN * COLUMNS_PER_PAGE;

/** Turkce siralama; "Cografya" < "Cebir" hatasina dusmemek icin. */
const collator = new Intl.Collator("tr", { sensitivity: "base" });

/* -------------------------------------------------------------------------- */
/*  Konu bazli gruplama                                                       */
/* -------------------------------------------------------------------------- */

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
/*  Ders bazli gruplama (havuzun ust kirilimi)                                */
/* -------------------------------------------------------------------------- */

export interface SubjectGroup {
  subject: string;
  topics: TopicGroup[];
  /** Derse bagli toplam soru sayisi - kartta gostermek icin. */
  questionCount: number;
}

/**
 * Ders bilgisi girilmemis sorularin toplandigi kutu.
 *
 * Bilerek "Genel" gibi gecerli bir ders adi degil: tek basina duran boyle bir
 * kutu, hiyerarside ders kademesi yokmus izlenimi veriyordu. Adin kendisi
 * "burada eksik veri var" demeli.
 */
export const UNASSIGNED_SUBJECT = "Ders atanmamis";

/**
 * Havuzu "ders -> konu -> soru" olarak kirar. Dersler ve altlarindaki konular
 * Turkce alfabetige gore sirali gelir.
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
    .sort((a, b) => collator.compare(a.subject, b.subject));
}

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

/* -------------------------------------------------------------------------- */
/*  Puanlama                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Toplam puani sorulara tam sayi olarak paylastirir; artan puan bastaki
 * sorulara birer birer eklenir. 20 soru -> 5'er puan, 3 soru -> 34/33/33.
 */
export function distributePoints(count: number, total = 100): number[] {
  if (count <= 0) return [];

  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}

/* -------------------------------------------------------------------------- */
/*  Kagit duzeni                                                              */
/* -------------------------------------------------------------------------- */

/** Kagida basilmaya hazir soru: sira numarasi ve puani islenmis. */
export type NumberedQuestion = Question & { number: number; points: number };

export interface PaperPage {
  /** 0 tabanli yaprak sirasi. */
  index: number;
  /** Her biri en fazla QUESTIONS_PER_COLUMN soru tasiyan iki sutun. */
  columns: NumberedQuestion[][];
}

/** Siralanmis sorulara numara ve puan isler. */
export function numberQuestions(
  questions: readonly Question[],
  totalPoints = 100,
): NumberedQuestion[] {
  const points = distributePoints(questions.length, totalPoints);

  return questions.map((question, index) => ({
    ...question,
    number: index + 1,
    points: points[index] ?? 0,
  }));
}

/**
 * Sorulari yapraklara, yapraklari iki sutuna boler.
 * Dolu bir yaprakta dagilim 5 + 5'tir; son yaprakta soru azsa iki sutuna
 * dengeli dagitilir (3 soru -> 2 + 1), tek sutun uzayip sayfa cirkinlesmesin.
 */
export function paginate(questions: readonly NumberedQuestion[]): PaperPage[] {
  const pages: PaperPage[] = [];

  for (let start = 0; start < questions.length; start += QUESTIONS_PER_PAGE) {
    const slice = questions.slice(start, start + QUESTIONS_PER_PAGE);
    const perColumn = Math.max(1, Math.ceil(slice.length / COLUMNS_PER_PAGE));

    pages.push({
      index: pages.length,
      columns: Array.from({ length: COLUMNS_PER_PAGE }, (_, column) =>
        slice.slice(column * perColumn, (column + 1) * perColumn),
      ),
    });
  }

  return pages;
}

/** Dosya adinda kullanilamayacak karakterleri temizler. */
export function toFileName(title: string, fallback = "sinav"): string {
  const cleaned = title
    .trim()
    .replace(/[\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .toLocaleLowerCase("tr");

  return cleaned.length > 0 ? cleaned : fallback;
}
