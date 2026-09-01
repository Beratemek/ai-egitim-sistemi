import assert from "node:assert/strict";
import test from "node:test";

import {
  availableFilterOptions,
  buildStudentMistakeNotebook,
  filterStudentMistakes,
  sanitizeStudentFeedback,
  type StudentMistakeSource,
} from "../lib/student-mistakes.ts";

const source: StudentMistakeSource = {
  exams: [
    {
      id: "exam-completed",
      title: "Hücre Değerlendirmesi",
      subject: "Fen Bilimleri",
      created_at: "2026-08-20T08:00:00.000Z",
    },
    {
      id: "exam-active",
      title: "Devam Eden Sınav",
      subject: "Fen Bilimleri",
      created_at: "2026-08-21T08:00:00.000Z",
    },
  ],
  attempts: [
    {
      exam_id: "exam-completed",
      status: "sonuclandi",
      completed_at: "2026-08-22T10:00:00.000Z",
    },
    {
      exam_id: "exam-active",
      status: "degerlendiriliyor",
      completed_at: null,
    },
  ],
  questions: [
    {
      examId: "exam-completed",
      id: "wrong-test",
      subject: "Fen Bilimleri",
      topic: "Hücre",
      text: "Hücrenin yönetim merkezi hangisidir?",
      type: "test",
      options_json: [
        { key: "A", text: "Çekirdek" },
        { key: "B", text: "Ribozom" },
      ],
      outcome_id: "outcome-cell",
      position: 0,
      points: 20,
    },
    {
      examId: "exam-completed",
      id: "partial-open",
      subject: "Fen Bilimleri",
      topic: "Mitoz",
      text: "Mitozun önemini açıklayın.",
      type: "acik_uclu",
      options_json: null,
      outcome_id: "outcome-mitosis",
      position: 1,
      points: 30,
    },
    {
      examId: "exam-completed",
      id: "missing-answer",
      subject: "Fen Bilimleri",
      topic: "Kalıtım",
      text: "Gen nedir?",
      type: "acik_uclu",
      options_json: null,
      outcome_id: null,
      position: 2,
      points: 20,
    },
    {
      examId: "exam-completed",
      id: "mastered",
      subject: "Fen Bilimleri",
      topic: "Hücre",
      text: "Başarılı cevap",
      type: "acik_uclu",
      options_json: null,
      outcome_id: "outcome-cell",
      position: 3,
      points: 30,
    },
    {
      examId: "exam-active",
      id: "active-wrong",
      subject: "Fen Bilimleri",
      topic: "Hücre",
      text: "Henüz açıklanmaması gereken soru",
      type: "test",
      options_json: null,
      outcome_id: "outcome-cell",
      position: 0,
      points: 100,
    },
  ],
  submissions: [
    {
      exam_id: "exam-completed",
      question_id: "wrong-test",
      answer_text: "b) Ribozom",
      ai_feedback: "Yanlış cevap. Doğru şık: A.",
      instructor_approved_score: 0,
      instructor_note: "Hücrenin görevlerini yeniden incele.",
      status: "egitmen_onayli",
    },
    {
      exam_id: "exam-completed",
      question_id: "partial-open",
      answer_text: "Büyümeyi sağlar.",
      ai_feedback: "Üreme işlevi eksik açıklanmış.",
      instructor_approved_score: 40,
      instructor_note: null,
      status: "egitmen_onayli",
    },
    {
      exam_id: "exam-completed",
      question_id: "mastered",
      answer_text: "Tam ve yeterli cevap.",
      ai_feedback: "Yeterli.",
      instructor_approved_score: 80,
      instructor_note: null,
      status: "egitmen_onayli",
    },
    {
      exam_id: "exam-active",
      question_id: "active-wrong",
      answer_text: "B",
      ai_feedback: "Ara değerlendirme",
      instructor_approved_score: 0,
      instructor_note: null,
      status: "egitmen_onayli",
    },
  ],
  outcomes: [
    { id: "outcome-cell", outcome_text: "Hücrenin temel kısımlarını açıklar." },
    { id: "outcome-mitosis", outcome_text: "Mitozun canlılar için önemini açıklar." },
  ],
};

test("yalnız sonuçlanan sınavların geliştirilmesi gereken cevaplarını listeler", () => {
  const notebook = buildStudentMistakeNotebook(source);

  assert.deepEqual(
    notebook.records.map((record) => record.questionId),
    ["wrong-test", "partial-open", "missing-answer"],
  );
  assert.equal(notebook.summary.total, 3);
  assert.equal(notebook.summary.wrong, 1);
  assert.equal(notebook.summary.partial, 1);
  assert.equal(notebook.summary.blank, 1);
});

test("submission kaydı olmayan sınav sorusunu boş cevap kanıtı olarak üretir", () => {
  const notebook = buildStudentMistakeNotebook(source);
  const missing = notebook.records.find(
    (record) => record.questionId === "missing-answer",
  );

  assert.equal(missing?.status, "bos");
  assert.equal(missing?.answerDisplay, "Cevap verilmedi");
  assert.equal(missing?.approvedScore, 0);
  assert.equal(missing?.earnedPoints, 0);
});

test("test cevabını seçilen şıkkın metniyle gösterir ama doğru şıkkı taşımaz", () => {
  const notebook = buildStudentMistakeNotebook(source);
  const wrong = notebook.records.find((record) => record.questionId === "wrong-test");

  assert.equal(wrong?.answerDisplay, "B — Ribozom");
  assert.doesNotMatch(JSON.stringify(wrong), /correct_answer|rubric/);
});

test("geçmiş geri bildirimdeki cevap anahtarını öğrenciye gitmeden temizler", () => {
  assert.equal(
    sanitizeStudentFeedback("Yanlış cevap. Doğru şık: B."),
    "Yanlış cevap.",
  );
  assert.equal(
    sanitizeStudentFeedback("İlk not.\nDoğru seçenek: C - gizli metin\nÇalışmaya devam."),
    "İlk not.\n\nÇalışmaya devam.",
  );
  assert.equal(sanitizeStudentFeedback("Doğru cevap: A"), null);
});

test("ders, sınav, kazanım ve durum filtrelerini birlikte uygular", () => {
  const notebook = buildStudentMistakeNotebook(source);
  const outcomeKey = notebook.records.find(
    (record) => record.questionId === "partial-open",
  )?.outcomeKey;

  const filtered = filterStudentMistakes(notebook.records, {
    subject: "Fen Bilimleri",
    examId: "exam-completed",
    outcomeKey,
    status: "kismi",
  });

  assert.deepEqual(filtered.map((record) => record.questionId), ["partial-open"]);
});

test("eşik değiştirildiğinde yeterli sayılan kanıt defterden çıkar", () => {
  const notebook = buildStudentMistakeNotebook(source, 40);

  assert.equal(
    notebook.records.some((record) => record.questionId === "partial-open"),
    false,
  );
});


/* ===========================================================================
 * Suzgec seceneklerinin birbirine gore daralmasi
 * ---------------------------------------------------------------------------
 * Gercek bir kullanici sikayetinden dogdu: "Robotik ve Kodlama" dersi ile
 * "Haberlesme Protokolleri" kazanimi birlikte secilebiliyordu, ama o kazanim
 * "Elektronik ve IoT" dersine ait. Sonuc her zaman bostu ve ekranda yalnizca
 * "eslesen kayit yok" yaziyordu - filtre bozuk saniliyordu.
 * ======================================================================== */

const ikiDersliKaynak: StudentMistakeSource = {
  exams: [
    {
      id: "sinav-robotik",
      title: "Robotik Denemesi",
      subject: "Robotik ve Kodlama",
      created_at: "2026-08-20T08:00:00.000Z",
    },
    {
      id: "sinav-iot",
      title: "IoT Denemesi",
      subject: "Elektronik ve IoT",
      created_at: "2026-08-21T08:00:00.000Z",
    },
  ],
  attempts: [
    {
      exam_id: "sinav-robotik",
      status: "sonuclandi",
      completed_at: "2026-08-22T10:00:00.000Z",
    },
    {
      exam_id: "sinav-iot",
      status: "sonuclandi",
      completed_at: "2026-08-23T10:00:00.000Z",
    },
  ],
  questions: [
    {
      examId: "sinav-robotik",
      id: "soru-sensor",
      subject: "Robotik ve Kodlama",
      topic: "Sensör Temelleri",
      text: "Sensör nedir?",
      type: "test",
      options_json: null,
      outcome_id: "kazanim-sensor",
      position: 0,
      points: 10,
    },
    {
      examId: "sinav-iot",
      id: "soru-protokol",
      subject: "Elektronik ve IoT",
      topic: "Haberleşme Protokolleri",
      text: "I2C nedir?",
      type: "test",
      options_json: null,
      outcome_id: "kazanim-protokol",
      position: 0,
      points: 10,
    },
  ],
  submissions: [
    {
      exam_id: "sinav-robotik",
      question_id: "soru-sensor",
      answer_text: "B",
      ai_feedback: null,
      instructor_approved_score: 0,
      instructor_note: null,
      status: "egitmen_onayli",
    },
    {
      /* Bos birakilmis: durum suzgecinin de daraldigini gostermek icin. */
      exam_id: "sinav-iot",
      question_id: "soru-protokol",
      answer_text: "",
      ai_feedback: null,
      instructor_approved_score: 0,
      instructor_note: null,
      status: "egitmen_onayli",
    },
  ],
  outcomes: [
    { id: "kazanim-sensor", outcome_text: "Sensör temellerini açıklar." },
    { id: "kazanim-protokol", outcome_text: "Haberleşme protokollerini açıklar." },
  ],
};

test("suzgec secilmemisken tum secenekler listelenir", () => {
  const { records } = buildStudentMistakeNotebook(ikiDersliKaynak);
  const secenekler = availableFilterOptions(records, {});

  assert.deepEqual(
    secenekler.subjects.map((o) => o.label),
    ["Elektronik ve IoT", "Robotik ve Kodlama"],
  );
  assert.equal(secenekler.outcomes.length, 2);
  assert.deepEqual(
    secenekler.statuses.map((o) => o.value).sort(),
    ["bos", "yanlis"],
  );
});

test("ders secilince kazanim listesi yalnizca o dersin kazanimlarina daralir", () => {
  const { records } = buildStudentMistakeNotebook(ikiDersliKaynak);
  const secenekler = availableFilterOptions(records, {
    subject: "Robotik ve Kodlama",
  });

  assert.deepEqual(
    secenekler.outcomes.map((o) => o.label),
    ["Sensör temellerini açıklar."],
  );
  /* Baska dersin kazanimi ARTIK SECILEMIYOR - sikayetin kaynagi buydu. */
  assert.ok(
    !secenekler.outcomes.some((o) => o.label.includes("Haberleşme")),
    "baska derse ait kazanim listede kalmamali",
  );
});

test("bir boyutun kendi suzgeci kendi seceneklerini daraltmaz", () => {
  const { records } = buildStudentMistakeNotebook(ikiDersliKaynak);
  const secenekler = availableFilterOptions(records, {
    subject: "Robotik ve Kodlama",
  });

  /*
    Ders secili olsa bile ders listesi iki dersi de gostermeli; aksi halde
    kullanici fikrini degistirip baska bir ders secemezdi.
  */
  assert.equal(secenekler.subjects.length, 2);
});

test("durum secenekleri de diger suzgeclere gore daralir", () => {
  const { records } = buildStudentMistakeNotebook(ikiDersliKaynak);

  const robotik = availableFilterOptions(records, {
    subject: "Robotik ve Kodlama",
  });
  assert.deepEqual(robotik.statuses.map((o) => o.value), ["yanlis"]);

  const iot = availableFilterOptions(records, { subject: "Elektronik ve IoT" });
  assert.deepEqual(iot.statuses.map((o) => o.value), ["bos"]);
});

test("daralan listelerden kurulabilen her birlesim en az bir kayit dondurur", () => {
  const { records } = buildStudentMistakeNotebook(ikiDersliKaynak);

  /*
    Ozelligin asil vaadi bu: arayuzun sundugu her ders+kazanim birlesimi
    gercekten sonuc vermeli. Bos sonuc ureten bir secim sunulamaz.
  */
  for (const ders of availableFilterOptions(records, {}).subjects) {
    const kazanimlar = availableFilterOptions(records, {
      subject: ders.value,
    }).outcomes;

    for (const kazanim of kazanimlar) {
      const sonuc = filterStudentMistakes(records, {
        subject: ders.value,
        outcomeKey: kazanim.value,
      });
      assert.ok(
        sonuc.length > 0,
        `${ders.label} + ${kazanim.label} bos sonuc verdi`,
      );
    }
  }
});
