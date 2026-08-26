import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOKLETS,
  bookletOptions,
  bookletQuestionOrder,
  isBooklet,
  type Booklet,
} from "../lib/booklet.ts";
import type { QuestionOption } from "../lib/types.ts";

const EXAM = "11111111-1111-4111-8111-111111111111";

function soru(id: string, subject: string) {
  return { id, subject };
}

/** Iki ders, her birinde 6 soru - gruplar bitisik verilir. */
const SORULAR = [
  ...Array.from({ length: 6 }, (_, i) => soru(`bio-${i}`, "Biyoloji")),
  ...Array.from({ length: 6 }, (_, i) => soru(`rob-${i}`, "Robotik")),
];

const SIKLAR: QuestionOption[] = [
  { key: "A", text: "birinci" },
  { key: "B", text: "ikinci" },
  { key: "C", text: "ucuncu" },
  { key: "D", text: "dorduncu" },
];

test("kitapcik harfi taninir", () => {
  assert.equal(isBooklet("A"), true);
  assert.equal(isBooklet("E"), false);
  assert.equal(isBooklet(null), false);
});

test("ayni kitapcik her zaman ayni sirayi verir", () => {
  for (const booklet of BOOKLETS) {
    const bir = bookletQuestionOrder(SORULAR, EXAM, booklet).map((q) => q.id);
    const iki = bookletQuestionOrder(SORULAR, EXAM, booklet).map((q) => q.id);
    assert.deepEqual(bir, iki);
  }
});

test("hicbir soru kaybolmaz ya da tekrarlanmaz", () => {
  for (const booklet of BOOKLETS) {
    const ids = bookletQuestionOrder(SORULAR, EXAM, booklet).map((q) => q.id);
    assert.equal(ids.length, SORULAR.length);
    assert.equal(new Set(ids).size, SORULAR.length);
  }
});

test("ders siniri korunur: gruplar bitisik ve sirasi sabit", () => {
  for (const booklet of BOOKLETS) {
    const dersler = bookletQuestionOrder(SORULAR, EXAM, booklet).map(
      (q) => q.subject,
    );
    // Ilk 6 Biyoloji, sonraki 6 Robotik olmali - karistirma grup ICINDE kalir.
    assert.deepEqual(dersler.slice(0, 6), Array(6).fill("Biyoloji"));
    assert.deepEqual(dersler.slice(6), Array(6).fill("Robotik"));
  }
});

test("dort kitapcik birbirinden farkli sira uretir", () => {
  const siralar = BOOKLETS.map((booklet) =>
    bookletQuestionOrder(SORULAR, EXAM, booklet)
      .map((q) => q.id)
      .join(","),
  );
  assert.equal(new Set(siralar).size, BOOKLETS.length);
});

test("ayni uzunluktaki iki ders ayni permutasyonu almaz", () => {
  // Tohuma ders adi girmeseydi iki grup ayni sirayi alir ve karistirma
  // goze carpacak kadar duzenli gorunurdu.
  const sira = bookletQuestionOrder(SORULAR, EXAM, "B");
  const bio = sira.slice(0, 6).map((q) => q.id.replace("bio-", ""));
  const rob = sira.slice(6).map((q) => q.id.replace("rob-", ""));
  assert.notDeepEqual(bio, rob);
});

test("siklar A-B-C-D sirasiyla etiketlenir, icerik yer degistirir", () => {
  for (const booklet of BOOKLETS) {
    const siklar = bookletOptions(SIKLAR, EXAM, "soru-1", booklet);

    // Ogrencinin gordugu harfler her zaman duzenli.
    assert.deepEqual(
      siklar.map((s) => s.label),
      ["A", "B", "C", "D"],
    );

    // Orijinal anahtarlarin hepsi tam olarak bir kez var.
    assert.deepEqual(
      [...siklar.map((s) => s.key)].sort(),
      ["A", "B", "C", "D"],
    );
  }
});

test("ayni kitapcikta farkli sorular farkli sik sirasi alir", () => {
  // Tohuma soru kimligi girmeseydi tum sorular ayni permutasyonu alir,
  // "dogru cevap hep ayni harfte" oruntusu olusurdu.
  const booklet: Booklet = "C";
  const bir = bookletOptions(SIKLAR, EXAM, "soru-1", booklet).map((s) => s.key);
  const iki = bookletOptions(SIKLAR, EXAM, "soru-2", booklet).map((s) => s.key);
  assert.notDeepEqual(bir, iki);
});

test("sik karistirmasi da deterministik", () => {
  const bir = bookletOptions(SIKLAR, EXAM, "soru-9", "D").map((s) => s.key);
  const iki = bookletOptions(SIKLAR, EXAM, "soru-9", "D").map((s) => s.key);
  assert.deepEqual(bir, iki);
});

test("girdi dizileri degistirilmez", () => {
  const kopya = SORULAR.map((q) => q.id);
  bookletQuestionOrder(SORULAR, EXAM, "A");
  assert.deepEqual(SORULAR.map((q) => q.id), kopya);
});
