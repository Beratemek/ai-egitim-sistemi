import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstructorQuestionAnalytics,
  type QuestionAnalyticsSource,
} from "../lib/question-analytics.ts";
import type {
  ExamAttempt,
  Question,
  Submission,
  UserProfile,
} from "../lib/types.ts";

function profile(id: string, classroom = "8-A"): UserProfile {
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

function question(id = "q1"): Question {
  return {
    id,
    category: null,
    subject: "Fen Bilimleri",
    topic: "Hücre",
    text: "Hücrenin yönetim merkezini seçin.",
    type: "test",
    options_json: [
      { key: "A", text: "Çekirdek" },
      { key: "B", text: "Hücre zarı" },
      { key: "C", text: "Sitoplazma" },
      { key: "D", text: "Koful" },
    ],
    correct_answer: "A",
    rubric: null,
    visual_json: null,
    solution_json: null,
    difficulty: "orta",
    status: "onayli",
    outcome_id: "o1",
    created_by: "teacher",
    reviewed_by: "teacher",
    ai_generated: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function attempt(studentId: string, earnedPoints = 50): ExamAttempt {
  return {
    id: `a-${studentId}`,
    exam_id: "e1",
    student_id: studentId,
    status: "sonuclandi",
    started_at: "2026-01-05T09:00:00.000Z",
    submitted_at: "2026-01-05T09:30:00.000Z",
    completed_at: "2026-01-05T10:00:00.000Z",
    earned_points: earnedPoints,
    total_points: 100,
    final_score: earnedPoints,
    created_at: "2026-01-05T09:00:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
  };
}

function submission(
  studentId: string,
  questionId: string,
  answer: string,
  approvedScore: number,
  aiScore = approvedScore,
): Submission {
  return {
    id: `s-${studentId}-${questionId}`,
    exam_id: "e1",
    question_id: questionId,
    student_id: studentId,
    answer_text: answer,
    ai_score: aiScore,
    ai_feedback: null,
    ai_criteria_json: [],
    instructor_approved_score: approvedScore,
    instructor_note: null,
    status: "egitmen_onayli",
    reviewed_by: "teacher",
    created_at: "2026-01-05T09:30:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
  };
}

function source(): QuestionAnalyticsSource {
  return {
    exams: [
      {
        id: "e1",
        title: "Hücre tarama",
        description: "",
        subject: "Fen Bilimleri",
        proctored: false,
        duration_minutes: 40,
        points_auto: true,
        instructor_id: "teacher",
        is_published: true,
        starts_at: "2026-01-05T00:00:00.000Z",
        ends_at: "2026-01-10T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    examQuestions: [
      { exam_id: "e1", question_id: "q1", position: 1, points: 50 },
      { exam_id: "e1", question_id: "q2", position: 2, points: 50 },
    ],
    attempts: [attempt("u1"), attempt("u2")],
    submissions: [
      submission("u1", "q1", "a) çekirdek", 100),
      submission("u1", "q2", "B", 0),
      submission("u2", "q2", "A", 100),
    ],
    questions: [question(), { ...question("q2"), text: "İkinci soru" }],
    outcomes: [
      {
        id: "o1",
        category: null,
        subject: "Fen Bilimleri",
        topic: "Hücre",
        outcome_text: "Hücrenin temel yapılarını açıklar.",
        source_text: "",
        created_by: "teacher",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    students: [profile("u1"), profile("u2", "8-B")],
  };
}

test("tamamlanan denemedeki eksik submission boş fırsat olarak sayılır", () => {
  const result = buildInstructorQuestionAnalytics(source());
  const row = result.questions.find((item) => item.questionId === "q1");

  assert.equal(row?.opportunityCount, 2);
  assert.equal(row?.approvedAnswerCount, 1);
  assert.equal(row?.blankCount, 1);
  assert.equal(row?.blankRate, 50);
  assert.equal(row?.correctRate, 50);
  assert.equal(row?.averageScore, 50);
});

test("şıkkın farklı yazımı normalize edilir ve çeldirici dağılımı çıkarılır", () => {
  const data = source();
  data.submissions = [
    ...data.submissions,
    submission("u2", "q1", "b) Hücre zarı", 0),
  ];
  const row = buildInstructorQuestionAnalytics(data).questions.find(
    (item) => item.questionId === "q1",
  );

  assert.equal(row?.correctRate, 50);
  assert.equal(row?.optionStatistics.find((option) => option.key === "A")?.count, 1);
  assert.equal(row?.optionStatistics.find((option) => option.key === "B")?.count, 1);
});

test("AI ve öğretmen puanı farkı yalnız iki puan da varsa hesaplanır", () => {
  const data = source();
  data.submissions = [submission("u1", "q1", "B", 40, 80)];
  const row = buildInstructorQuestionAnalytics(data).questions.find(
    (item) => item.questionId === "q1",
  );

  assert.equal(row?.aiTeacherMeanDifference, 40);
  assert.equal(row?.teacherOverrideRate, 100);
});

test("ayırt edicilik az kanıtta sıfır değil ölçülemedi kalır", () => {
  const row = buildInstructorQuestionAnalytics(source()).questions[0];
  assert.equal(row?.discrimination, null);
  assert.equal(row?.warnings.includes("insufficient_evidence"), true);
});

test("sınıf filtresi fırsat paydasını da aynı öğrencilere sınırlar", () => {
  const result = buildInstructorQuestionAnalytics(source(), { classroom: "8-A" });
  const row = result.questions.find((item) => item.questionId === "q1");

  assert.equal(row?.opportunityCount, 1);
  assert.equal(row?.blankCount, 0);
  assert.equal(row?.correctRate, 100);
});

test("on öğrencide soru ile sınavın geri kalanı birlikte hareket ederse ayırt edicilik pozitiftir", () => {
  const data = source();
  const students: UserProfile[] = [];
  const attempts: ExamAttempt[] = [];
  const submissions: Submission[] = [];
  for (let index = 0; index < 10; index += 1) {
    const id = `u${index}`;
    const high = index >= 5;
    const questionScore = high ? 100 : 0;
    const restScore = high ? 80 : 20;
    students.push(profile(id));
    attempts.push(attempt(id, (questionScore + restScore) / 2));
    submissions.push(
      submission(id, "q1", high ? "A" : "B", questionScore),
      submission(id, "q2", high ? "A" : "B", restScore),
    );
  }
  data.students = students;
  data.attempts = attempts;
  data.submissions = submissions;

  const row = buildInstructorQuestionAnalytics(data).questions.find(
    (item) => item.questionId === "q1",
  );

  assert.equal(row?.discrimination, 1);
});

test("genel başarı soru sayısına değil yanıt fırsatına göre ağırlıklandırılır", () => {
  const data = source();
  data.attempts = [attempt("u1"), attempt("u2")];
  data.submissions = [
    submission("u1", "q1", "A", 100),
    submission("u2", "q1", "A", 100),
    submission("u1", "q2", "B", 0),
  ];
  data.examQuestions = [
    { exam_id: "e1", question_id: "q1", position: 1, points: 50 },
    { exam_id: "e1", question_id: "q2", position: 2, points: 50 },
  ];

  const result = buildInstructorQuestionAnalytics(data);

  assert.equal(result.overview.responseOpportunityCount, 4);
  assert.equal(result.overview.averageSuccess, 50);
});

test("seçenek dağılımı boşlar hariç işaretlenen yanıtlar üzerinden hesaplanır", () => {
  const row = buildInstructorQuestionAnalytics(source()).questions.find(
    (item) => item.questionId === "q1",
  );

  assert.equal(row?.optionStatistics.find((option) => option.key === "A")?.rate, 100);
});
