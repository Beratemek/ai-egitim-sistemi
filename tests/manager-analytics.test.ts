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
    examQuestions: [],
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
