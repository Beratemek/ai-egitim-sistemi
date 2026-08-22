import assert from "node:assert/strict";
import test from "node:test";

import { groupBySubject, UNASSIGNED_SUBJECT } from "../lib/question-pool.ts";
import type { DeneyapCategory } from "../lib/deneyap.ts";
import type { Question } from "../lib/types.ts";

/**
 * Havuzun ust kademesi DERSTIR.
 *
 * Once dal ust kademedeydi ve dali girilmemis sorular ayri bir "Kategori yok"
 * kutusuna dusuyordu; ayni ders boylece ikiye bolunuyordu. Asagidaki testler
 * bu davranisin geri gelmedigini guvenceye alir.
 */

function soru(
  subject: string,
  topic: string,
  category: DeneyapCategory | null,
  type: Question["type"] = "test",
): Question {
  return {
    id: `${subject}-${topic}-${Math.random()}`,
    category,
    subject,
    topic,
    text: "ornek soru",
    type,
    options_json: type === "test" ? [{ key: "A", text: "a" }] : null,
    correct_answer: type === "test" ? "A" : null,
    rubric: type === "test" ? null : "rubrik",
    status: "onayli",
    outcome_id: null,
    created_by: null,
    reviewed_by: null,
    ai_generated: false,
    created_at: "2026-08-22T00:00:00.000Z",
    updated_at: "2026-08-22T00:00:00.000Z",
  };
}

test("ayni ders farkli dallarda olsa tek kutuda birlesir", () => {
  const gruplar = groupBySubject([
    soru("Robotik ve Kodlama", "Sensör Temelleri", "robotik_ve_kodlama"),
    soru("Robotik ve Kodlama", "Eski Konu", null),
    soru("Biyoloji", "Fotosentez", null),
  ]);

  assert.equal(gruplar.length, 2, "iki ders bekleniyor");

  const robotik = gruplar.find((g) => g.subject === "Robotik ve Kodlama");
  assert.ok(robotik, "Robotik ve Kodlama grubu olusmali");
  assert.equal(robotik.questionCount, 2, "dali farkli olan sorular ayni derste toplanmali");
  assert.equal(robotik.topics.length, 2);
});

test("dersin dallari kartta etiket olarak listelenir", () => {
  const [grup] = groupBySubject([
    soru("Robotik ve Kodlama", "A", "robotik_ve_kodlama"),
    soru("Robotik ve Kodlama", "B", null),
  ]);

  assert.ok(grup, "grup olusmali");
  assert.equal(grup.categoryLabels.length, 2, "iki farkli dal etiketi bekleniyor");
  assert.ok(
    grup.categoryLabels.some((label) => label.toLocaleLowerCase("tr").includes("robotik")),
    "dal adi etiketler arasinda olmali",
  );
});

test("dersi girilmemis sorular kendi kutusunda ve en sonda toplanir", () => {
  const gruplar = groupBySubject([
    soru("", "Konu", null),
    soru("Ayrik Ders", "Konu", null),
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

  const [grup] = groupBySubject([soru("Tek Ders", "Tek Konu", null)]);
  assert.ok(grup, "grup olusmali");
  assert.equal(grup.topics.length, 1);
  assert.equal(grup.topics[0]?.questions.length, 1);
});
