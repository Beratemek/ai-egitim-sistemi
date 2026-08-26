import assert from "node:assert/strict";
import test from "node:test";

import { groupBySubject, UNASSIGNED_SUBJECT } from "../lib/question-pool.ts";
import type { Question } from "../lib/types.ts";

/**
 * Havuzun ust kademesi DERSTIR.
 *
 * Once "atolye dali" ust kademedeydi ve dali girilmemis sorular ayri bir
 * kutuya dusuyordu; ayni ders boylece ikiye bolunuyordu. Dal kavrami tumuyle
 * kaldirildi (urun DENEYAP'a ozel degil), ama kirilimin ders bazli kalmasi
 * hala guvenceye alinmali.
 */

function soru(
  subject: string,
  topic: string,
  type: Question["type"] = "test",
): Question {
  return {
    id: `${subject}-${topic}-${Math.random()}`,
    // Eski kayitlarda dolu olabilen kullanilmayan sutun; arayuzde gosterilmiyor.
    category: null,
    subject,
    topic,
    text: "ornek soru",
    type,
    options_json: type === "test" ? [{ key: "A", text: "a" }] : null,
    correct_answer: type === "test" ? "A" : null,
    rubric: type === "test" ? null : "rubrik",
    visual_json: null,
    status: "onayli",
    outcome_id: null,
    created_by: null,
    reviewed_by: null,
    ai_generated: false,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  };
}

test("ayni ders adini tasiyan sorular tek kutuda birlesir", () => {
  const gruplar = groupBySubject([
    soru("Robotik ve Kodlama", "Sensör Temelleri"),
    soru("Robotik ve Kodlama", "Eski Konu"),
    soru("Biyoloji", "Fotosentez"),
  ]);

  assert.equal(gruplar.length, 2, "iki ders bekleniyor");

  const robotik = gruplar.find((g) => g.subject === "Robotik ve Kodlama");
  assert.ok(robotik, "Robotik ve Kodlama grubu olusmali");
  assert.equal(robotik.questionCount, 2);
  assert.equal(robotik.topics.length, 2);
});

test("dersi girilmemis sorular kendi kutusunda ve en sonda toplanir", () => {
  const gruplar = groupBySubject([
    soru("", "Konu"),
    soru("Ayrik Ders", "Konu"),
  ]);

  assert.equal(gruplar.length, 2);
  assert.equal(
    gruplar.at(-1)?.subject,
    UNASSIGNED_SUBJECT,
    "dersi atanmamis kutu her zaman en sonda durmali",
  );
});

test("altinda sorusu olmayan ders ya da konu hic olusmaz", () => {
  assert.deepEqual(groupBySubject([]), []);

  const [grup] = groupBySubject([soru("Tek Ders", "Tek Konu")]);
  assert.ok(grup, "grup olusmali");
  assert.equal(grup.topics.length, 1);
  assert.equal(grup.topics[0]?.questions.length, 1);
});
