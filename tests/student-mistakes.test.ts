import assert from "node:assert/strict";
import test from "node:test";

import {
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
