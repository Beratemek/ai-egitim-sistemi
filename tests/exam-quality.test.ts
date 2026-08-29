import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateExamQuality,
  type ExamQualityExam,
  type ExamQualityExamQuestion,
  type ExamQualityQuestion,
} from "../lib/exam-quality.ts";

function exam(patch: Partial<ExamQualityExam> = {}): ExamQualityExam {
  return {
    id: "exam-1",
    subject: "Fen Bilimleri",
    duration_minutes: 40,
    starts_at: "2026-09-01T09:00:00.000Z",
    ends_at: "2026-09-01T10:00:00.000Z",
    ...patch,
  };
}

function question(
  id: string,
  patch: Partial<ExamQualityQuestion> = {},
): ExamQualityQuestion {
  return {
    id,
    subject: "Fen Bilimleri",
    text: `${id} soru metni`,
    type: "test",
    options_json: [
      { key: "A", text: "Birinci seçenek" },
      { key: "B", text: "İkinci seçenek" },
      { key: "C", text: "Üçüncü seçenek" },
      { key: "D", text: "Dördüncü seçenek" },
    ],
    correct_answer: "A",
    rubric: null,
    visual_json: null,
    difficulty: "orta",
    status: "onayli",
    outcome_id: `outcome-${id}`,
    ...patch,
  };
}

function link(
  questionId: string,
  position: number,
  points: number,
): ExamQualityExamQuestion {
  return { question_id: questionId, position, points };
}

function fiveQuestionInput() {
  const questions = [
    question("q1", { correct_answer: "A", difficulty: "kolay" }),
    question("q2", { correct_answer: "B", difficulty: "kolay" }),
    question("q3", { correct_answer: "C", difficulty: "orta" }),
    question("q4", { correct_answer: "D", difficulty: "orta" }),
    question("q5", { correct_answer: "A", difficulty: "zor" }),
  ];
  return {
    exam: exam(),
    questions,
    examQuestions: questions.map((item, index) => link(item.id, index, 20)),
    assignmentCount: 12,
  };
}

function codes(result: ReturnType<typeof evaluateExamQuality>) {
  return result.issues.map((item) => item.code);
}

test("eksiksiz ve dengeli sınav pass sonucu üretir", () => {
  const result = evaluateExamQuality(fiveQuestionInput());

  assert.equal(result.status, "pass");
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.metrics, {
    questionCount: 5,
    resolvedQuestionCount: 5,
    totalPoints: 100,
    testQuestionCount: 5,
    openEndedQuestionCount: 0,
    outcomeCoveragePercent: 100,
  });
});

test("sorusuz sınavı engeller ve gereksiz toplam puan hatası üretmez", () => {
  const result = evaluateExamQuality({
    exam: exam(),
    examQuestions: [],
    questions: [],
    assignmentCount: 1,
  });

  assert.equal(result.status, "blocker");
  assert.equal(result.canPublish, false);
  assert.deepEqual(result.blockers.map((item) => item.code), ["soru-yok"]);
});

test("toplam puan, puan biçimi, yinelenen soru ve sıra yayımlamayı engeller", () => {
  const questions = [question("q1"), question("q2")];
  const result = evaluateExamQuality({
    exam: exam(),
    questions,
    examQuestions: [link("q1", 0, 50), link("q1", 0, -2), link("q2", -1, 10.5)],
    assignmentCount: 1,
  });

  assert.equal(result.canPublish, false);
  assert.deepEqual(
    new Set(codes(result)),
    new Set([
      "gecersiz-soru-puani",
      "toplam-puan-100-degil",
      "yinelenen-soru",
      "gecersiz-soru-sirasi",
      "yinelenen-sira",
    ]),
  );
});

test("onaysız veya bağlantısı kırık soru yayımlamayı engeller", () => {
  const result = evaluateExamQuality({
    exam: exam(),
    examQuestions: [link("q1", 0, 50), link("silinmis", 1, 50)],
    questions: [question("q1", { status: "taslak" })],
    assignmentCount: 1,
  });

  assert.ok(codes(result).includes("soru-onaysiz"));
  assert.ok(codes(result).includes("soru-kaydi-bulunamadi"));
  assert.deepEqual(
    result.blockers.find((item) => item.code === "soru-kaydi-bulunamadi")
      ?.questionIds,
    ["silinmis"],
  );
});

test("test sorusunda tam dört geçerli seçenek ve mevcut cevap anahtarı ister", () => {
  const malformed = question("q1", {
    options_json: [
      { key: "A", text: "A" },
      { key: "a", text: "Tekrarlanan anahtar" },
      { key: "C", text: "C" },
    ],
    correct_answer: "D",
  });
  const result = evaluateExamQuality({
    exam: exam(),
    examQuestions: [link("q1", 0, 100)],
    questions: [malformed],
    assignmentCount: 1,
  });

  assert.ok(codes(result).includes("test-secenekleri-gecersiz"));
  assert.ok(codes(result).includes("test-cevap-anahtari-gecersiz"));
});

test("yalnız görsel içeren test seçeneğini ve soru gövdesini geçerli sayar", () => {
  const visual = {
    kind: "image" as const,
    url: "https://example.com/sekil.png",
    alt: "Örnek şekil",
    credit: "Örnek kaynak",
    license: "CC BY 4.0",
  };
  const visualQuestion = question("q1", {
    text: "",
    visual_json: visual,
    options_json: [
      { key: "A", text: "", visual },
      { key: "B", text: "B" },
      { key: "C", text: "C" },
      { key: "D", text: "D" },
    ],
  });
  const result = evaluateExamQuality({
    exam: exam(),
    examQuestions: [link("q1", 0, 100)],
    questions: [visualQuestion],
    assignmentCount: 1,
  });

  assert.equal(result.canPublish, true);
  assert.ok(!codes(result).includes("soru-govdesi-eksik"));
  assert.ok(!codes(result).includes("test-secenekleri-gecersiz"));
});

test("açık uçlu soruda rubriği zorunlu tutar", () => {
  const openEnded = question("q1", {
    type: "acik_uclu",
    options_json: null,
    correct_answer: null,
    rubric: "   ",
  });
  const result = evaluateExamQuality({
    exam: exam(),
    examQuestions: [link("q1", 0, 100)],
    questions: [openEnded],
    assignmentCount: 1,
  });

  assert.ok(codes(result).includes("acik-uclu-rubrik-eksik"));
});

test("geçersiz süre ve tarih alanlarının tümünü bildirir", () => {
  const invalidDates = evaluateExamQuality({
    ...fiveQuestionInput(),
    exam: exam({
      duration_minutes: 0,
      starts_at: "tarih-degil",
      ends_at: "o-da-degil",
    }),
  });

  assert.ok(codes(invalidDates).includes("sure-gecersiz"));
  assert.ok(codes(invalidDates).includes("baslangic-tarihi-gecersiz"));
  assert.ok(codes(invalidDates).includes("bitis-tarihi-gecersiz"));

  const reversed = evaluateExamQuality({
    ...fiveQuestionInput(),
    exam: exam({
      starts_at: "2026-09-01T10:00:00.000Z",
      ends_at: "2026-09-01T09:00:00.000Z",
    }),
  });
  assert.ok(codes(reversed).includes("tarih-araligi-gecersiz"));
});

test("atama, kazanım, ders ve zorluk eksiklerini uyarı olarak üretir", () => {
  const q1 = question("q1", {
    subject: "Matematik",
    outcome_id: null,
    difficulty: undefined,
  });
  const result = evaluateExamQuality({
    exam: exam(),
    examQuestions: [link("q1", 0, 100)],
    questions: [q1],
    assignmentCount: 0,
  });

  assert.equal(result.status, "warning");
  assert.equal(result.canPublish, true);
  assert.deepEqual(
    new Set(codes(result)),
    new Set([
      "atama-yok",
      "kazanimi-eksik-soru",
      "ders-uyusmazligi",
      "zorluk-etiketi-eksik",
    ]),
  );
});

/*
  Sinavin dersi SORULARINDAN turetilir (bkz. 2026-08-26-cok-dersli-sinav.sql).
  Asagidaki uc test o modelin sinirlarini ciziyor; onceki surumde tek bir
  kural vardi ve cok dersli sinavlarda yanlis alarm uretiyordu.
*/

test("sorulardan ders türetilebiliyorsa ders uyarısı verilmez", () => {
  const result = evaluateExamQuality({
    // `exams.subject` bos ama sorunun dersi belli: sinavin dersi bellidir.
    exam: exam({ subject: null }),
    examQuestions: [link("q1", 0, 100)],
    questions: [question("q1")],
    assignmentCount: 1,
  });

  assert.ok(!codes(result).includes("sinav-dersi-eksik"));
  assert.ok(!codes(result).includes("ders-uyusmazligi"));
});

test("iki dersli sınavda hiçbir soru uyumsuz sayılmaz", () => {
  const result = evaluateExamQuality({
    exam: exam({ subject: "Elektronik ve IoT" }),
    examQuestions: [link("q1", 0, 50), link("q2", 1, 50)],
    questions: [
      question("q1", { subject: "Elektronik ve IoT" }),
      question("q2", { subject: "Enerji Teknolojileri" }),
    ],
    assignmentCount: 1,
  });

  assert.ok(!codes(result).includes("sinav-dersi-eksik"));
  assert.ok(!codes(result).includes("ders-uyusmazligi"));
});

test("hiçbir sorunun dersi yoksa ve yedek de boşsa uyarı verilir", () => {
  const result = evaluateExamQuality({
    exam: exam({ subject: null }),
    examQuestions: [link("q1", 0, 100)],
    questions: [question("q1", { subject: "" })],
    assignmentCount: 1,
  });

  assert.ok(codes(result).includes("sinav-dersi-eksik"));
});

test("ders etiketi sorularının hiçbirinde geçmiyorsa bayat sayılır", () => {
  const result = evaluateExamQuality({
    exam: exam({ subject: "Tarih" }),
    examQuestions: [link("q1", 0, 100)],
    questions: [question("q1", { subject: "Fen Bilimleri" })],
    assignmentCount: 1,
  });

  assert.ok(codes(result).includes("ders-uyusmazligi"));
});

test("zorluk ve doğru şık yoğunluğunu yeterli örneklemde uyarır", () => {
  const input = fiveQuestionInput();
  const concentratedQuestions = input.questions.map((item, index) => ({
    ...item,
    difficulty: (index < 4 ? "zor" : "orta") as "zor" | "orta",
    correct_answer: index < 3 ? "B" : index === 3 ? "C" : "D",
  }));
  const result = evaluateExamQuality({ ...input, questions: concentratedQuestions });

  assert.ok(codes(result).includes("zorluk-dagilimi-dengesiz"));
  assert.ok(codes(result).includes("dogru-sik-dagilimi-dengesiz"));
});

test("küçük sınavlarda dağılım uyarısı üretmez", () => {
  const questions = [question("q1"), question("q2")];
  const result = evaluateExamQuality({
    exam: exam(),
    questions,
    examQuestions: [link("q1", 0, 50), link("q2", 1, 50)],
    assignmentCount: 1,
  });

  assert.ok(!codes(result).includes("zorluk-dagilimi-dengesiz"));
  assert.ok(!codes(result).includes("dogru-sik-dagilimi-dengesiz"));
});

test("aynı metinli farklı soruları ve 100 üzeri soru sayısını uyarır", () => {
  const questions = Array.from({ length: 101 }, (_, index) =>
    question(`q${index}`, {
      text: index < 2 ? "  Aynı   soru metni  " : `Özgün soru ${index}`,
      correct_answer: ["A", "B", "C", "D"][index % 4] ?? "A",
      difficulty: (["kolay", "orta", "zor"] as const)[index % 3] ?? "orta",
    }),
  );
  // `points` veritabanında iki ondalıklı numeric'tir: 100 x 0,99 + 1 = 100.
  const examQuestions = questions.map((item, index) =>
    link(item.id, index, index === 100 ? 1 : 0.99),
  );

  const result = evaluateExamQuality({
    exam: exam(),
    questions,
    examQuestions,
    assignmentCount: 1,
  });

  assert.ok(codes(result).includes("cok-fazla-soru"));
  assert.ok(codes(result).includes("yinelenen-soru-metni"));
  assert.deepEqual(
    result.warnings.find((item) => item.code === "yinelenen-soru-metni")
      ?.questionIds,
    ["q0", "q1"],
  );
});
