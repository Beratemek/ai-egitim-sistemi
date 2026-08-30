import assert from "node:assert/strict";
import test from "node:test";

import {
  computeActualResults,
  summarizeCalibration,
  type CalibrationEntry,
  type CalibrationExamQuestion,
  type CalibrationSubmission,
} from "../lib/exam-calibration.ts";

/* -------------------------------------------------------------------------- */
/*  Yardimcilar                                                               */
/* -------------------------------------------------------------------------- */

const BAGLANTILAR: CalibrationExamQuestion[] = [
  { examId: "e1", questionId: "q1", points: 30 },
  { examId: "e1", questionId: "q2", points: 70 },
];

function cevap(
  studentId: string,
  questionId: string,
  approvedScore: number | null,
  status = "egitmen_onayli",
): CalibrationSubmission {
  return { examId: "e1", studentId, questionId, approvedScore, status };
}

function kayit(
  predicted: number,
  actual: number | null,
  id = `s${predicted}`,
): CalibrationEntry {
  return {
    simulationId: id,
    examId: `e-${id}`,
    examTitle: "Sınav",
    cohortKind: "ikiz",
    cohortLabel: "9-A dijital ikizi",
    predicted,
    actual,
    studentCount: 20,
    createdAt: "2026-08-30T10:00:00.000Z",
  };
}

/* -------------------------------------------------------------------------- */
/*  Gercek ortalama                                                           */
/* -------------------------------------------------------------------------- */

test("gercek ortalama soru puanina gore agirliklanir", () => {
  const sonuclar = computeActualResults(
    [
      // 30 puanlik sorudan tam, 70 puanliktan sifir -> 30.
      cevap("a", "q1", 100),
      cevap("a", "q2", 0),
      // Her ikisinden yarim -> 50.
      cevap("b", "q1", 50),
      cevap("b", "q2", 50),
    ],
    BAGLANTILAR,
  );

  assert.equal(sonuclar.length, 1);
  assert.equal(sonuclar[0]?.average, 40);
  assert.equal(sonuclar[0]?.studentCount, 2);
});

test("onay bekleyen cevabi olan ogrenci ortalamaya girmez", () => {
  const sonuclar = computeActualResults(
    [
      cevap("a", "q1", 100),
      cevap("a", "q2", 100),
      // Ikinci ogrencinin bir cevabi hala onay bekliyor: yarim degerlendirilmis
      // kagit ortalamayi haksiz yere asagi cekerdi.
      cevap("b", "q1", 100),
      cevap("b", "q2", null, "ai_degerlendirildi"),
    ],
    BAGLANTILAR,
  );

  assert.equal(sonuclar[0]?.average, 100);
  assert.equal(sonuclar[0]?.studentCount, 1);
});

test("cevaplanmamis soru sifir sayilir", () => {
  const sonuclar = computeActualResults([cevap("a", "q1", 100)], BAGLANTILAR);

  // 30 puanlik sorudan tam, 70 puanlik soru hic cevaplanmamis.
  assert.equal(sonuclar[0]?.average, 30);
});

test("hicbir kagit tamamlanmadiysa sinav sonucsuz kalir", () => {
  const sonuclar = computeActualResults(
    [cevap("a", "q1", null, "gonderildi"), cevap("a", "q2", null, "gonderildi")],
    BAGLANTILAR,
  );

  assert.deepEqual(sonuclar, []);
});

test("sinava ait olmayan soru hesaba katilmaz", () => {
  const sonuclar = computeActualResults(
    [cevap("a", "q1", 100), cevap("a", "baska-soru", 0)],
    BAGLANTILAR,
  );

  assert.equal(sonuclar[0]?.average, 30);
});

/* -------------------------------------------------------------------------- */
/*  Ozet                                                                      */
/* -------------------------------------------------------------------------- */

test("sapma, yanlilik ve isabet orani hesaplanir", () => {
  const ozet = summarizeCalibration([
    kayit(70, 65, "a"), // +5
    kayit(60, 72, "b"), // -12
    kayit(80, 82, "c"), // -2
  ]);

  assert.ok(ozet);
  assert.equal(ozet.count, 3);
  // (5 + 12 + 2) / 3
  assert.equal(ozet.meanAbsoluteError, 6.3);
  // (5 - 12 - 2) / 3 -> hafif karamsar
  assert.equal(ozet.bias, -3);
  assert.equal(ozet.within10, 0.67);
  assert.equal(ozet.worst, 12);
});

test("gercek sonucu olmayan kestirimler ozete girmez", () => {
  const ozet = summarizeCalibration([kayit(70, 65, "a"), kayit(50, null, "b")]);

  assert.ok(ozet);
  assert.equal(ozet.count, 1);
  assert.equal(ozet.meanAbsoluteError, 5);
});

test("hic olculmus kestirim yoksa ozet uretilmez", () => {
  // Sifir olcumu "%0 sapma" diye gostermek, hic denenmemis bir seyi kusursuz
  // gibi sunmak olurdu.
  assert.equal(summarizeCalibration([kayit(70, null, "a")]), null);
  assert.equal(summarizeCalibration([]), null);
});
