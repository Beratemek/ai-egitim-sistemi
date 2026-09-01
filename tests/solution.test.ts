import assert from "node:assert/strict";
import test from "node:test";

import { isDetailedSolution, parseSolution } from "../lib/solution.ts";

/*
  `parseSolution` IKI yerden cagriliyor: modelin urettigi ham nesne ve
  veritabanindan okunan satir. Ikisi de guvenilmez - model sema disina
  cikabilir, veritabaninda ise semanin ESKI surumuyle yazilmis satirlar
  kalabilir. Bu testler her iki yoldan gelen bozuk veride arayuzun
  cokmemesini garanti eder.
*/

const TAM = {
  concept: "Ünlü düşmesi: iki heceli bazı sözcükler ünlüyle başlayan ek aldığında ikinci hecedeki dar ünlü düşer.",
  steps: [{ text: "Sözcüğü ek almadan önceki hâliyle yaz." }],
  options: [
    { key: "A", correct: false, reason: "Burada ünsüz yumuşaması var, ünlü düşmesi yok." },
    { key: "B", correct: true, reason: "'burun' + '-u' → 'burnu'; ikinci hecedeki 'u' düşmüş." },
  ],
  conclusion: "Doğru cevap B; çünkü yalnızca orada dar ünlü düşmesi gerçekleşiyor.",
};

test("tam bir cozum oldugu gibi doner", () => {
  const s = parseSolution(TAM);
  assert.ok(s);
  assert.equal(s.steps.length, 1);
  assert.equal(s.options.length, 2);
  assert.equal(s.options[1]?.correct, true);
});

test("concept ya da conclusion yoksa cozum YOK sayilir", () => {
  // Ikisi olmadan geriye yalnizca "su sik yanlis" listesi kalir, o da ogretmez.
  assert.equal(parseSolution({ ...TAM, concept: "" }), null);
  assert.equal(parseSolution({ ...TAM, conclusion: "   " }), null);
  assert.equal(parseSolution({ steps: TAM.steps, options: TAM.options }), null);
});

test("adimlar ve siklar ISTEGE BAGLI - tarih sorusu gibi", () => {
  // Islem gerektirmeyen derslerde `steps` bos kalir; bu gecerli bir cozumdur.
  const s = parseSolution({ concept: TAM.concept, conclusion: TAM.conclusion });
  assert.ok(s);
  assert.deepEqual(s.steps, []);
  assert.deepEqual(s.options, []);
});

test("adim duz metin olarak da kabul edilir", () => {
  // Model bazen {text: "..."} yerine dogrudan dize donduruyor; ikisi de gecerli.
  const s = parseSolution({ ...TAM, steps: ["once kurali yaz", { text: "sonra uygula" }] });
  assert.equal(s?.steps.length, 2);
  assert.equal(s?.steps[0]?.text, "once kurali yaz");
});

test("bozuk adim ve siklar ELENIR, cozumun tamami dusmez", () => {
  const s = parseSolution({
    ...TAM,
    steps: [{ text: "gecerli" }, null, { text: "" }, 42],
    options: [
      { key: "A", correct: false, reason: "gecerli" },
      { key: "", reason: "anahtarsiz" },
      { key: "C" }, // gerekce yok
      null,
    ],
  });
  assert.equal(s?.steps.length, 1);
  assert.equal(s?.options.length, 1);
});

test("correct yalnizca true ise dogru sayilir", () => {
  // "true" dizesi ya da 1 gibi degerler dogru kabul edilmemeli.
  const s = parseSolution({
    ...TAM,
    options: [{ key: "A", correct: "true", reason: "dize" }],
  });
  assert.equal(s?.options[0]?.correct, false);
});

test("asiri uzun metinler kirpilir", () => {
  const s = parseSolution({ ...TAM, concept: "a".repeat(5000) });
  assert.ok((s?.concept.length ?? 0) <= 600);
});

test("adim ve sik sayisi sinirlanir", () => {
  const s = parseSolution({
    ...TAM,
    steps: Array.from({ length: 40 }, (_, i) => ({ text: `adim ${i}` })),
    options: Array.from({ length: 30 }, (_, i) => ({
      key: String(i),
      correct: false,
      reason: "x",
    })),
  });
  assert.ok((s?.steps.length ?? 0) <= 12);
  assert.ok((s?.options.length ?? 0) <= 8);
});

test("tanimsiz, null ve dizi girdiler null doner", () => {
  assert.equal(parseSolution(undefined), null);
  assert.equal(parseSolution(null), null);
  assert.equal(parseSolution("cozum"), null);
  assert.equal(parseSolution([]), null);
});

test("isDetailedSolution: asgari cozumu zengin saymaz", () => {
  const asgari = parseSolution({ concept: TAM.concept, conclusion: TAM.conclusion });
  const zengin = parseSolution(TAM);
  assert.ok(asgari);
  assert.ok(zengin);
  assert.equal(isDetailedSolution(asgari), false);
  assert.equal(isDetailedSolution(zengin), true);
});
