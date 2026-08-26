/**
 * Kitapcik (A/B/C/D) karistirmasi.
 *
 * Ayni sinav her ogrenciye ayni sirayla gitmez: dort kitapcik vardir, her
 * ogrenciye biri atanir ve HANGISI oldugu ogrenciye soylenmez. Amac yan yana
 * oturan iki ogrencinin ekraninda ayni soruyu ayni yerde gormemesi.
 *
 * TASARIM: sira SAKLANMAZ, TURETILIR.
 *
 * Her ogrenci icin soru ve sik sirasini bir tabloda tutmak, sinav basina yuzlerce
 * satir ve senkron tutulmasi gereken ikinci bir gercek demekti. Bunun yerine
 * karistirma `(sinav kimligi + kitapcik harfi)` tohumundan DETERMINISTIK
 * uretilir: ayni girdi her zaman ayni siziyi verir, sunucu ve istemci ayni
 * sonuca varir, saklanacak tek sey ogrencinin kitapcik harfidir
 * (`exam_assignments.booklet`).
 *
 * DERS SINIRI KORUNUR. Bir sinav birden fazla dersten soru tasiyabilir; sorular
 * dersine gore gruplanir, gruplarin SIRASI degismez ve karistirma yalnizca grup
 * ICINDE olur. Boylece ogrenci hala "once Biyoloji, sonra Robotik" gorur -
 * yalnizca her dersin kendi sorulari yer degistirir.
 */

import type { QuestionOption } from "./types.ts";

export const BOOKLETS = ["A", "B", "C", "D"] as const;
export type Booklet = (typeof BOOKLETS)[number];

export function isBooklet(value: unknown): value is Booklet {
  return typeof value === "string" && (BOOKLETS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*  Deterministik rastgelelik                                                 */
/* -------------------------------------------------------------------------- */

/**
 * FNV-1a 32 bit. Kriptografik degil - burada gereken tek sey ayni metnin her
 * zaman ayni sayiyi vermesi ve benzer metinlerin (ayni sinav, farkli harf)
 * birbirinden uzak tohumlar uretmesi.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: kucuk, hizli, tohumlanabilir PRNG. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates - tohumdan turetilmis, girdiyi bozmayan karistirma. */
function shuffle<T>(items: readonly T[], seed: string): T[] {
  const sonuc = [...items];
  const rastgele = prng(hash(seed));

  for (let i = sonuc.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rastgele() * (i + 1));
    const gecici = sonuc[i] as T;
    sonuc[i] = sonuc[j] as T;
    sonuc[j] = gecici;
  }

  return sonuc;
}

/* -------------------------------------------------------------------------- */
/*  Soru sirasi                                                               */
/* -------------------------------------------------------------------------- */

/** Karistirma icin bir sorudan gereken alanlar. */
export interface OrderableQuestion {
  id: string;
  /** Sorunun dersi. Karistirma bu grubun ICINDE kalir. */
  subject: string;
}

/**
 * Sorulari kitapciga gore siralar.
 *
 * Dersler orijinal sirasini korur (ilk gorunduklari yere gore); karistirma
 * yalnizca her dersin kendi sorulari arasindadir. Girdi dizisi degistirilmez.
 */
export function bookletQuestionOrder<T extends OrderableQuestion>(
  questions: readonly T[],
  examId: string,
  booklet: Booklet,
): T[] {
  // Dersleri ILK GORUNDUKLERI sirayla topla. Map ekleme sirasini korudugu
  // icin ayri bir sira alani gerekmiyor.
  const derse: Map<string, T[]> = new Map();
  for (const question of questions) {
    const grup = derse.get(question.subject);
    if (grup) grup.push(question);
    else derse.set(question.subject, [question]);
  }

  const sonuc: T[] = [];
  for (const [subject, grup] of derse) {
    // Tohuma ders de giriyor: aksi halde iki ders ayni uzunluktaysa ikisi de
    // ayni permutasyonu alirdi ve "karistirilmis" iki grup birbirinin aynisi
    // gorunurdu.
    sonuc.push(...shuffle(grup, `${examId}|${booklet}|${subject}`));
  }

  return sonuc;
}

/* -------------------------------------------------------------------------- */
/*  Sik sirasi                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ekranda gosterilecek sik.
 *
 * `key` ORIJINAL anahtardir ve cevap olarak O gonderilir; `label` ise ogrencinin
 * gordugu harftir ve her zaman A, B, C, D sirasindadir.
 *
 * Ayrim kasitli. Ogrenci "B" isaretlediginde kayda giden sey orijinal anahtar
 * olur; puanlama, egitmenin inceleme ekrani ve istatistikler sorunun KENDI
 * koordinatlarinda calismaya devam eder. Kaydedilen deger ekrandaki harf
 * olsaydi, cevabi okuyan her yerin kitapcigi bilip geri cevirmesi gerekirdi -
 * ve bir tanesi unutuldugunda ogrenci sessizce yanlis puan alirdi.
 */
export interface DisplayOption extends QuestionOption {
  /** Ogrencinin gordugu harf: A, B, C, D. */
  label: string;
}

const HARFLER = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/**
 * Bir sorunun siklarini kitapciga gore karistirir ve yeniden etiketler.
 *
 * Tohuma soru kimligi de girer: aksi halde ayni kitapciktaki tum sorular ayni
 * permutasyonu alir, "hep C dogru" gibi bir oruntu olusurdu.
 */
export function bookletOptions(
  options: readonly QuestionOption[],
  examId: string,
  questionId: string,
  booklet: Booklet,
): DisplayOption[] {
  return shuffle(options, `${examId}|${booklet}|${questionId}`).map(
    (option, index) => ({
      ...option,
      label: HARFLER[index] ?? String(index + 1),
    }),
  );
}
