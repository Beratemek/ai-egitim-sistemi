import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManagerAnalytics,
  type ManagerAnalyticsSource,
} from "../lib/manager-analytics.ts";
import type {
  Exam,
  ExamAssignment,
  ExamAttempt,
  ExamQuestion,
  LearningOutcome,
  Question,
  Submission,
  UserProfile,
} from "../lib/types.ts";

const NOW = new Date("2026-01-15T12:00:00.000Z").getTime();

function student(id: string, classroom: string): UserProfile {
  return {
    id,
    role: "ogrenci",
    roles: ["ogrenci"],
    role_status: "onayli",
    requested_role: null,
    role_reviewed_by: null,
    role_reviewed_at: null,
    classroom,
    full_name: `Öğrenci ${id}`,
    email: `${id}@example.com`,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function exam(): Exam {
  return {
    id: "e1",
    title: "Konu tarama",
    description: "",
    subject: "Fen Bilimleri",
    proctored: false,
    duration_minutes: 40,
    points_auto: true,
    instructor_id: "teacher",
    is_published: true,
    starts_at: "2026-01-01T00:00:00.000Z",
    ends_at: "2026-01-10T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function assignment(id: string, studentId: string): ExamAssignment {
  return {
    id,
    exam_id: "e1",
    student_id: studentId,
    assigned_by: "teacher",
    assigned_at: "2026-01-01T00:00:00.000Z",
    due_at: "2026-01-10T00:00:00.000Z",
  };
}

function completedAttempt(): ExamAttempt {
  return {
    id: "a1",
    exam_id: "e1",
    student_id: "s1",
    status: "sonuclandi",
    started_at: "2026-01-05T09:00:00.000Z",
    submitted_at: "2026-01-05T09:30:00.000Z",
    completed_at: "2026-01-05T10:00:00.000Z",
    earned_points: 80,
    total_points: 100,
    final_score: 80,
    created_at: "2026-01-05T09:00:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
  };
}

function outcome(): LearningOutcome {
  return {
    id: "o1",
    category: null,
    subject: "Fen Bilimleri",
    topic: "Hücre",
    outcome_text: "Hücrenin temel yapılarını açıklar.",
    source_text: "",
    created_by: "expert",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function question(): Question {
  return {
    id: "q1",
    category: null,
    subject: "Fen Bilimleri",
    topic: "Hücre",
    text: "Hücrenin görevini açıklayın.",
    type: "acik_uclu",
    options_json: null,
    correct_answer: null,
    rubric: "Doğru kavramları kullanır.",
    visual_json: null,
    status: "onayli",
    outcome_id: "o1",
    created_by: "expert",
    reviewed_by: "expert",
    ai_generated: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function submission(
  id: string,
  studentId: string,
  status: Submission["status"],
  approvedScore: number | null,
): Submission {
  return {
    id,
    exam_id: "e1",
    question_id: "q1",
    student_id: studentId,
    answer_text: "Yanıt",
    ai_score: 100,
    ai_feedback: "",
    ai_criteria_json: [],
    instructor_approved_score: approvedScore,
    instructor_note: null,
    status,
    reviewed_by: status === "egitmen_onayli" ? "teacher" : null,
    created_at: "2026-01-05T09:30:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
  };
}

function source(): ManagerAnalyticsSource {
  return {
    users: [student("s1", "8-A"), student("s2", "8-B")],
    exams: [exam()],
    assignments: [assignment("as1", "s1"), assignment("as2", "s2")],
    attempts: [completedAttempt()],
    submissions: [
      submission("sub1", "s1", "egitmen_onayli", 40),
      submission("sub2", "s2", "ai_degerlendirildi", null),
    ],
    questions: [question()],
    outcomes: [outcome()],
    examQuestions: [examLink("e1", "q1", 100)],
  };
}

function examLink(examId: string, questionId: string, points: number): ExamQuestion {
  return { exam_id: examId, question_id: questionId, position: 1, points };
}

function secondQuestion(): Question {
  return {
    ...question(),
    id: "q2",
    text: "Hücrenin yönetim merkezini seçin.",
    type: "test",
    options_json: [
      { key: "A", text: "Çekirdek" },
      { key: "B", text: "Hücre zarı" },
    ],
    correct_answer: "A",
    rubric: null,
  };
}

test("yönetici özeti atama, teslim ve nihai puandan üretilir", () => {
  const result = buildManagerAnalytics(source(), {}, NOW);

  assert.equal(result.overview.classroomCount, 2);
  assert.equal(result.overview.studentCount, 2);
  assert.equal(result.overview.completionRate, 50);
  assert.equal(result.overview.evaluationRate, 100);
  assert.equal(result.overview.averageScore, 80);
  assert.equal(result.overview.atRiskStudentCount, 1);
  assert.equal(result.students.find((row) => row.studentId === "s2")?.overdueCount, 1);
});

test("onaysız AI puanı kazanım ortalamasına girmez", () => {
  const [result] = buildManagerAnalytics(source(), {}, NOW).outcomes;

  assert.equal(result?.averageScore, 40);
  assert.equal(result?.answerCount, 1);
  assert.equal(result?.pendingCount, 1);
  assert.equal(result?.studentCount, 2);
});

test("sınıf kapsamı bütün metrikleri ilgili öğrencilerle sınırlar", () => {
  const result = buildManagerAnalytics(source(), { classroom: "8-A" }, NOW);

  assert.equal(result.overview.classroomCount, 1);
  assert.equal(result.overview.studentCount, 1);
  assert.equal(result.overview.completionRate, 100);
  assert.equal(result.overview.averageScore, 80);
  assert.deepEqual(result.exams[0]?.classrooms, ["8-A"]);
  assert.equal(result.outcomes[0]?.pendingCount, 0);
});

test("kazanım puanı sınavdaki soru puanlarıyla ağırlıklandırılır", () => {
  const data = source();
  data.questions = [question(), secondQuestion()];
  data.examQuestions = [examLink("e1", "q1", 10), examLink("e1", "q2", 90)];
  data.submissions = [
    submission("sub1", "s1", "egitmen_onayli", 100),
    { ...submission("sub2", "s1", "egitmen_onayli", 0), question_id: "q2", answer_text: "B" },
  ];

  const [result] = buildManagerAnalytics(data, {}, NOW).outcomes;

  assert.equal(result?.averageScore, 10);
  assert.equal(result?.measuredQuestionCount, 2);
  assert.equal(result?.linkedQuestionCount, 2);
  assert.equal(result?.evidenceLevel, "supported");
  assert.equal(result?.isActionableWeak, true);
  assert.deepEqual(result?.questions[0]?.wrongAnswers, [
    { answer: "B", optionText: "Hücre zarı", count: 1 },
  ]);
});

test("tek soruluk düşük ölçüm erken sinyaldir, kesin zayıflık sayılmaz", () => {
  const data = source();
  data.examQuestions = [examLink("e1", "q1", 100)];
  data.submissions = [submission("sub1", "s1", "egitmen_onayli", 20)];

  const result = buildManagerAnalytics(data, {}, NOW);

  assert.equal(result.outcomes[0]?.evidenceLevel, "early");
  assert.equal(result.outcomes[0]?.isActionableWeak, false);
  assert.equal(result.overview.weakOutcomeCount, 0);
  assert.equal(result.students.find((row) => row.studentId === "s1")?.weakOutcomeCount, 0);
});

test("taslak cevap onay bekleyen sayılmaz", () => {
  const data = source();
  data.submissions = [submission("sub1", "s1", "gonderildi", null)];

  const [result] = buildManagerAnalytics(data, {}, NOW).outcomes;

  assert.equal(result?.pendingCount, 0);
  assert.equal(result?.draftCount, 1);
});

test("sonuçlanmamış attempt veya kopuk sınav-soru bağı sayısal kanıta girmez", () => {
  const incomplete = source();
  incomplete.attempts = [];
  incomplete.submissions = [submission("sub1", "s1", "egitmen_onayli", 20)];

  const orphan = source();
  orphan.examQuestions = [];
  orphan.submissions = [submission("sub1", "s1", "egitmen_onayli", 20)];

  const incompleteOutcome = buildManagerAnalytics(incomplete, {}, NOW).outcomes[0];
  const orphanOutcome = buildManagerAnalytics(orphan, {}, NOW).outcomes[0];

  assert.equal(incompleteOutcome?.averageScore, null);
  assert.equal(incompleteOutcome?.excludedEvidenceCount, 1);
  assert.equal(orphanOutcome?.averageScore, null);
  assert.equal(orphanOutcome?.excludedEvidenceCount, 1);
});

test("başarı eşiği rapor kapsamına göre değiştirilebilir", () => {
  const data = source();
  data.questions = [question(), secondQuestion()];
  data.examQuestions = [examLink("e1", "q1", 50), examLink("e1", "q2", 50)];
  data.submissions = [
    submission("sub1", "s1", "egitmen_onayli", 65),
    { ...submission("sub2", "s1", "egitmen_onayli", 65), question_id: "q2", answer_text: "B" },
  ];

  assert.equal(
    buildManagerAnalytics(data, { masteryThreshold: 60 }, NOW).outcomes[0]
      ?.isActionableWeak,
    false,
  );
  assert.equal(
    buildManagerAnalytics(data, { masteryThreshold: 70 }, NOW).outcomes[0]
      ?.isActionableWeak,
    true,
  );
});

test("öğrenci puan değişimi yalnızca aynı dersin önceki sonucu ile karşılaştırılır", () => {
  const data = source();
  const mathExam: Exam = {
    ...exam(),
    id: "e2",
    title: "Matematik tarama",
    subject: "Matematik",
    ends_at: "2026-01-11T00:00:00.000Z",
  };
  const latestScienceExam: Exam = {
    ...exam(),
    id: "e3",
    title: "Fen tekrar",
    ends_at: "2026-01-12T00:00:00.000Z",
  };
  data.exams = [exam(), mathExam, latestScienceExam];
  data.assignments = [
    assignment("as1", "s1"),
    { ...assignment("as2", "s1"), exam_id: "e2" },
    { ...assignment("as3", "s1"), exam_id: "e3" },
  ];
  data.attempts = [
    completedAttempt(),
    {
      ...completedAttempt(),
      id: "a2",
      exam_id: "e2",
      final_score: 20,
      completed_at: "2026-01-06T10:00:00.000Z",
    },
    {
      ...completedAttempt(),
      id: "a3",
      exam_id: "e3",
      final_score: 70,
      completed_at: "2026-01-07T10:00:00.000Z",
    },
  ];
  data.examQuestions.push(examLink("e3", "q1", 100));

  const result = buildManagerAnalytics(data, {}, NOW).students.find(
    (row) => row.studentId === "s1",
  );

  assert.equal(result?.latestScore, 70);
  assert.equal(result?.scoreChange, -10);
});

test("aynı dersin farklı kazanımlarındaki sınavlar gelişim diye kıyaslanmaz", () => {
  const data = source();
  const otherOutcome: LearningOutcome = {
    ...outcome(),
    id: "o2",
    topic: "Kuvvet",
    outcome_text: "Net kuvveti hesaplar.",
  };
  const otherQuestion: Question = {
    ...question(),
    id: "q2",
    outcome_id: "o2",
    topic: "Kuvvet",
  };
  data.outcomes.push(otherOutcome);
  data.questions.push(otherQuestion);
  data.exams.push({ ...exam(), id: "e2", title: "Kuvvet tarama" });
  data.assignments.push({ ...assignment("as2", "s1"), exam_id: "e2" });
  data.attempts.push({
    ...completedAttempt(),
    id: "a2",
    exam_id: "e2",
    completed_at: "2026-01-07T10:00:00.000Z",
    final_score: 30,
  });
  data.examQuestions.push(examLink("e2", "q2", 100));

  const result = buildManagerAnalytics(data, {}, NOW).students.find(
    (row) => row.studentId === "s1",
  );

  assert.equal(result?.latestScore, 30);
  assert.equal(result?.scoreChange, null);
});

test("ders, sınav ve tarih filtreleri bütün analitik kapsamına uygulanır", () => {
  const data = source();
  const otherExam: Exam = {
    ...exam(),
    id: "e2",
    title: "Matematik tarama",
    subject: "Matematik",
    starts_at: "2026-02-01T00:00:00.000Z",
    ends_at: "2026-02-10T00:00:00.000Z",
    created_at: "2026-02-01T00:00:00.000Z",
  };
  data.exams = [exam(), otherExam];
  data.assignments.push({ ...assignment("as3", "s1"), exam_id: "e2" });
  data.attempts.push({ ...completedAttempt(), id: "a2", exam_id: "e2", final_score: 20 });

  const bySubject = buildManagerAnalytics(data, { subject: "Matematik" }, NOW);
  const byDate = buildManagerAnalytics(
    data,
    { dateFrom: "2026-02-01", dateTo: "2026-02-28" },
    NOW,
  );

  assert.deepEqual(bySubject.exams.map((item) => item.examId), ["e2"]);
  assert.deepEqual(byDate.exams.map((item) => item.examId), ["e2"]);
  assert.equal(bySubject.overview.assignedCount, 1);
  assert.equal(byDate.overview.averageScore, 20);
});
