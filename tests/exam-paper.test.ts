import assert from "node:assert/strict";
import test from "node:test";

import { distributePoints, numberQuestions, paginate, withNumbers } from "../lib/exam-paper.ts";
import type { Question } from "../lib/types.ts";

/**
 * Basilabilir sinav kagidi.
 *
 * En kritik kural `withNumbers` icinde: KAYITLI bir sinavin kagidi
 * puanlari yeniden dagitmaz. Dagitsaydi ayni sinavin iki farkli puan
 * cetveli dolasima girerdi - ogrencinin ekranindaki bir deger, elindeki
 * kagitta baska bir deger.
 */

function soru(id: string, points: number): Question & { points: number } {
  return {
    id,
    category: null,
    subject: "Biyoloji",
    topic: "Fotosentez",
    text: `soru ${id}`,
    type: "acik_uclu",
    options_json: null,
    correct_answer: null,
    rubric: "rubrik",
    visual_json: null,
    solution_json: null,
    status: "onayli",
    outcome_id: null,
    created_by: null,
    reviewed_by: null,
    ai_generated: false,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
    points,
  };
}

test("withNumbers sorunun KENDI puanini korur", () => {
  const kagit = withNumbers([soru("a", 25), soru("b", 5), soru("c", 70)]);

  assert.deepEqual(
    kagit.map((item) => item.points),
    [25, 5, 70],
    "kayitli sinavin puanlari yeniden dagitilmamali",
  );
});

test("withNumbers sirayi bozmadan 1'den baslayarak numaralar", () => {
  const kagit = withNumbers([soru("a", 10), soru("b", 10), soru("c", 10)]);

  assert.deepEqual(
    kagit.map((item) => [item.id, item.number]),
    [
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ],
  );
});

test("withNumbers toplami 100 olmayan sinavi da oldugu gibi birakir", () => {
  // 50 puanlik bir sinav gecerlidir; 100 yalnizca esit dagitimin varsayilani.
  const kagit = withNumbers([soru("a", 30), soru("b", 20)]);
  const toplam = kagit.reduce((sum, item) => sum + item.points, 0);

  assert.equal(toplam, 50);
});

test("withNumbers bos listede bos doner", () => {
  assert.deepEqual(withNumbers([]), []);
});

test("numberQuestions ise puanlari 100 uzerinden yeniden dagitir", () => {
  // Havuzdan derlenen TAZE kagit icin dogru davranis budur; iki fonksiyonun
  // farki bilincli.
  const kagit = numberQuestions([soru("a", 99), soru("b", 1)]);

  assert.deepEqual(
    kagit.map((item) => item.points),
    [50, 50],
  );
});

test("distributePoints artan puani bastaki sorulara dagitir", () => {
  assert.deepEqual(distributePoints(3), [34, 33, 33]);
  assert.deepEqual(distributePoints(20), Array.from({ length: 20 }, () => 5));
  assert.deepEqual(distributePoints(0), []);
});

test("paginate bir yaprakta 5 + 5 soru dizer", () => {
  const sayfalar = paginate(
    withNumbers(Array.from({ length: 12 }, (_, i) => soru(`s${i}`, 10))),
  );

  assert.equal(sayfalar.length, 2, "12 soru iki yaprak eder");
  assert.deepEqual(
    sayfalar[0]?.columns.map((column) => column.length),
    [5, 5],
  );
  // Son yaprakta 2 soru kaldi: tek sutun uzamasin diye dengeli bolunur.
  assert.deepEqual(
    sayfalar[1]?.columns.map((column) => column.length),
    [1, 1],
  );
});
