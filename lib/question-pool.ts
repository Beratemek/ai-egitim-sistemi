/**
 * Soru havuzunun kirilimi - saf yardimcilar (React'ten bagimsiz).
 *
 * Havuz "atolye dali -> ders -> konu -> soru" seklinde kirilir. Dal kimligi
 * `lib/deneyap.ts` icindeki DENEYAP enum'u, ders ise `questions.subject`
 * serbest metnidir - icerik uzmani soruyu uretirken ikisini de belirler.
 */

import { categoryLabel } from "@/lib/deneyap";
import type { DeneyapCategory } from "@/lib/deneyap";
import type { Question } from "@/lib/types";

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

function groupBySubject(questions: readonly Question[]): SubjectGroup[] {
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

export interface CategoryGroup {
  /** Eski kayitlarda dal atanmamis olabilir. */
  category: DeneyapCategory | null;
  /** Arayuzde gosterilen dal adi; dal yoksa "Kategori yok". */
  label: string;
  subjects: SubjectGroup[];
  /** Dal altindaki toplam konu sayisi - kartta gostermek icin. */
  topicCount: number;
  questionCount: number;
}

/**
 * Havuzu "atolye dali -> ders -> konu -> soru" olarak kirar.
 *
 * Gruplar sorulardan TURETILIR: altinda sorusu olmayan bir dal, ders ya da
 * konu hic olusmaz; son sorusu kalkarsa grup kendiliginden kaybolur. Dali ya
 * da dersi atanmamis sorular kendi kademelerinin sonunda tek bir kutuda
 * toplanir.
 */
export function groupByCategory(questions: readonly Question[]): CategoryGroup[] {
  const buckets = new Map<string, Question[]>();

  for (const question of questions) {
    const key = question.category ?? "";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(question);
    else buckets.set(key, [question]);
  }

  return [...buckets.entries()]
    .map(([key, items]) => {
      const category = (key || null) as DeneyapCategory | null;
      const subjects = groupBySubject(items);

      return {
        category,
        label: categoryLabel(category),
        subjects,
        topicCount: subjects.reduce((total, group) => total + group.topics.length, 0),
        questionCount: items.length,
      };
    })
    .sort((a, b) => {
      // Dali atanmamislar her zaman en sonda dursun.
      if (a.category === null) return 1;
      if (b.category === null) return -1;
      return collator.compare(a.label, b.label);
    });
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
