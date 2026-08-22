import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeOutcomes,
  outcomeLevel,
  type AnalysisOutcome,
  type AnalysisQuestion,
  type AnalysisSubmission,
} from "../lib/outcome-analysis.ts";

/**
 * KAZANIM BAZLI ANALIZ.
 *
 * Iki sinir korunmali:
 *   - Puan yalnizca EGITMEN ONAYLI cevaplardan gelir. AI on puani girerse
 *     rapor, hocanin vermedigi bir karari ona atfeder.
 *   - "Henuz olculmedi" ile "%0 basari" AYRI seylerdir. Ikisini karistirmak
 *     hocayi var olmayan bir soruna yonlendirir.
 */

function kazanim(id: string, metin: string, konu = "Konu"): AnalysisOutcome {
  return { id, outcome_text: metin, subject: "Matematik", topic: konu };
}

function soru(id: string, outcomeId: string | null): AnalysisQuestion {
  return { id, outcome_id: outcomeId };
}

function cevap(
  questionId: string | null,
  studentId: string,
  puan: number | null,
  onayli = true,
): AnalysisSubmission {
  return {
    question_id: questionId,
    student_id: studentId,
    status: onayli ? "egitmen_onayli" : "ai_degerlendirildi",
    instructor_approved_score: puan,
  };
}

test("onayli cevaplarin ortalamasi alinir", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Oran hesaplar")],
    [soru("s1", "k1")],
    [cevap("s1", "o1", 80), cevap("s1", "o2", 60)],
  );

  assert.equal(satir?.averageScore, 70);
  assert.equal(satir?.answerCount, 2);
  assert.equal(satir?.studentCount, 2);
});

test("onaylanmamis cevap ortalamaya GIRMEZ, ayrica sayilir", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Oran hesaplar")],
    [soru("s1", "k1")],
    [
      cevap("s1", "o1", 100),
      // AI 20 verdi ama egitmen onaylamadi - ortalamaya girmemeli.
      cevap("s1", "o2", 20, false),
    ],
  );

  assert.equal(satir?.averageScore, 100, "onaysiz cevap ortalamayi bozmamali");
  assert.equal(satir?.answerCount, 1);
  assert.equal(satir?.pendingCount, 1);
  assert.equal(satir?.studentCount, 2, "cevap veren ogrenci yine sayilmali");
});

test("hic onayli cevabi olmayan kazanim null doner - %0 DEGIL", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Hic olculmedi")],
    [soru("s1", "k1")],
    [],
  );

  assert.equal(satir?.averageScore, null);
  assert.equal(satir?.answerCount, 0);
  assert.equal(outcomeLevel(satir?.averageScore ?? null), "olculmedi");
});

test("en zayif kazanim en ustte, olculmemisler en sonda", () => {
  const satirlar = analyzeOutcomes(
    [
      kazanim("iyi", "Iyi giden"),
      kazanim("olculmedi", "Olculmemis"),
      kazanim("zayif", "Zayif olan"),
      kazanim("orta", "Orta olan"),
    ],
    [soru("s-iyi", "iyi"), soru("s-zayif", "zayif"), soru("s-orta", "orta")],
    [
      cevap("s-iyi", "o1", 90),
      cevap("s-zayif", "o1", 30),
      cevap("s-orta", "o1", 60),
    ],
  );

  assert.deepEqual(
    satirlar.map((r) => r.outcomeId),
    ["zayif", "orta", "iyi", "olculmedi"],
  );
});

test("kazanima bagli olmayan sorularin cevaplari hesaba katilmaz", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Oran hesaplar")],
    [soru("s1", "k1"), soru("s2", null)],
    [cevap("s1", "o1", 100), cevap("s2", "o1", 0)],
  );

  assert.equal(satir?.averageScore, 100);
  assert.equal(satir?.answerCount, 1);
});

test("silinmis soruya ait cevap (question_id null) coksun diye kirilmaz", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Oran hesaplar")],
    [soru("s1", "k1")],
    [cevap(null, "o1", 50), cevap("s1", "o1", 80)],
  );

  assert.equal(satir?.averageScore, 80);
});

test("havuzdaki soru sayisi kazanim basina sayilir", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Oran hesaplar")],
    [soru("s1", "k1"), soru("s2", "k1"), soru("s3", "k1")],
    [],
  );

  assert.equal(satir?.questionCount, 3);
});

test("ayni ogrencinin iki cevabi tek ogrenci sayilir", () => {
  const [satir] = analyzeOutcomes(
    [kazanim("k1", "Oran hesaplar")],
    [soru("s1", "k1"), soru("s2", "k1")],
    [cevap("s1", "o1", 40), cevap("s2", "o1", 60)],
  );

  assert.equal(satir?.studentCount, 1);
  assert.equal(satir?.answerCount, 2);
});

test("seviye esikleri", () => {
  assert.equal(outcomeLevel(null), "olculmedi");
  assert.equal(outcomeLevel(0), "zayif");
  assert.equal(outcomeLevel(49.9), "zayif");
  assert.equal(outcomeLevel(50), "orta");
  assert.equal(outcomeLevel(69.9), "orta");
  assert.equal(outcomeLevel(70), "iyi");
  assert.equal(outcomeLevel(100), "iyi");
});
