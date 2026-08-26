import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGuardianHouseholdOverview,
  buildGuardianStudentAnalytics,
  guardianStudentSummaryView,
} from "../lib/guardian-analytics.ts";
import type {
  GuardianStudentExamRow,
  GuardianStudentOutcomeRow,
  GuardianStudentSummary,
} from "../lib/types.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z").getTime();

function student(
  overrides: Partial<GuardianStudentSummary> = {},
): GuardianStudentSummary {
  return {
    guardian_id: "g1",
    guardian_name: "Ayşe Veli",
    student_id: "s1",
    student_name: "Deniz Öğrenci",
    classroom: "8-A",
    assigned_exam_count: 4,
    completed_exam_count: 2,
    overdue_exam_count: 1,
    average_score: 75,
    latest_score: 80,
    latest_completed_at: "2026-08-24T12:00:00.000Z",
    ...overrides,
  };
}

function exam(
  id: string,
  progress: GuardianStudentExamRow["progress_status"],
  overrides: Partial<GuardianStudentExamRow> = {},
): GuardianStudentExamRow {
  return {
    exam_id: id,
    title: `Sınav ${id}`,
    subject: "Fen Bilimleri",
    due_at: "2026-08-30T12:00:00.000Z",
    progress_status: progress,
    started_at: progress === "baslanmadi" ? null : "2026-08-20T09:00:00.000Z",
    submitted_at:
      progress === "degerlendiriliyor" || progress === "sonuclandi"
        ? "2026-08-20T10:00:00.000Z"
        : null,
    completed_at:
      progress === "sonuclandi" ? "2026-08-20T11:00:00.000Z" : null,
    final_score: progress === "sonuclandi" ? 80 : null,
    ...overrides,
  };
}

function outcome(
  id: string,
  score: number,
  measuredQuestionCount: number,
  overrides: Partial<GuardianStudentOutcomeRow> = {},
): GuardianStudentOutcomeRow {
  return {
    outcome_id: id,
    outcome_text: `Kazanım ${id}`,
    subject: "Fen Bilimleri",
    topic: "Hücre",
    average_score: score,
    approved_answer_count: measuredQuestionCount,
    measured_question_count: measuredQuestionCount,
    exam_count: 1,
    evidence_level: measuredQuestionCount < 2 ? "early" : "supported",
    is_actionable_weak: score < 60 && measuredQuestionCount >= 2,
    latest_evidence_at: "2026-08-20T11:00:00.000Z",
    ...overrides,
  };
}

test("hane özeti sayıları toplar ve ortalamayı tamamlanan sınavla ağırlıklandırır", () => {
  const result = buildGuardianHouseholdOverview([
    student({ completed_exam_count: 2, average_score: 80 }),
    student({
      student_id: "s2",
      assigned_exam_count: 2,
      completed_exam_count: 1,
      overdue_exam_count: 0,
      average_score: 50,
    }),
  ]);

  assert.deepEqual(result, {
    studentCount: 2,
    assignedExamCount: 6,
    completedExamCount: 3,
    overdueExamCount: 1,
    completionRate: 50,
    averageScore: 70,
  });
});

test("boş hane özeti sıfıra bölünmez ve sahte puan üretmez", () => {
  assert.deepEqual(buildGuardianHouseholdOverview([]), {
    studentCount: 0,
    assignedExamCount: 0,
    completedExamCount: 0,
    overdueExamCount: 0,
    completionRate: 0,
    averageScore: null,
  });
});

test("öğrenci kartı yüzdeleri güvenli aralığa taşır", () => {
  const result = guardianStudentSummaryView(
    student({
      assigned_exam_count: 3,
      completed_exam_count: 2,
      average_score: 105,
      latest_score: -5,
    }),
  );

  assert.equal(result.completionRate, 67);
  assert.equal(result.averageScore, 100);
  assert.equal(result.latestScore, 0);
});

test("sonuçlanan sınav sayısı bozuk veride atamayı aşsa da oran yüzde 100'ü geçmez", () => {
  const result = guardianStudentSummaryView(
    student({
      assigned_exam_count: 2,
      completed_exam_count: 5,
    }),
  );

  assert.equal(result.completionRate, 100);
});

test("öğrenci KPI'ları atama, teslim, sonuç ve gecikme durumundan hesaplanır", () => {
  const result = buildGuardianStudentAnalytics(
    student(),
    [
      exam("late", "baslanmadi", {
        due_at: "2026-08-01T12:00:00.000Z",
      }),
      exam("active", "devam_ediyor"),
      exam("review", "degerlendiriliyor"),
      exam("done", "sonuclandi", { final_score: 73.4 }),
    ],
    [],
    { now: NOW },
  );

  assert.equal(result.assignedCount, 4);
  assert.equal(result.submittedCount, 2);
  assert.equal(result.completedCount, 1);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.completionRate, 25);
  assert.equal(result.averageScore, 73.4);
  assert.deepEqual(
    result.exams.map((row) => row.exam_id),
    ["late", "active", "review", "done"],
  );
});

test("teslim edilmiş sınav son tarihten sonra olsa da gecikmiş sayılmaz", () => {
  const result = buildGuardianStudentAnalytics(
    student(),
    [
      exam("review", "degerlendiriliyor", {
        due_at: "2026-08-01T12:00:00.000Z",
      }),
      exam("done", "sonuclandi", {
        due_at: "2026-08-01T12:00:00.000Z",
      }),
    ],
    [],
    { now: NOW },
  );

  assert.equal(result.overdueCount, 0);
});

test("tek soruluk düşük ölçüm erken sinyaldir, kesin destek alanına girmez", () => {
  const result = buildGuardianStudentAnalytics(
    student(),
    [],
    [outcome("early", 20, 1)],
    { now: NOW },
  );

  assert.equal(result.outcomes[0]?.evidenceLevel, "early");
  assert.equal(result.outcomes[0]?.status, "early_signal");
  assert.equal(result.outcomes[0]?.isActionableWeak, false);
  assert.equal(result.supportAreaCount, 0);
  assert.equal(result.earlySignalCount, 1);
});

test("iki farklı soruyla eşik altındaki kazanım destek alanı sayılır", () => {
  const result = buildGuardianStudentAnalytics(
    student(),
    [],
    [
      outcome("weak", 59.9, 2, {
        // Sunucu alanları yanlışlıkla farklı gelse bile ortak kanıt kuralı
        // istemci görünümünde yeniden uygulanır.
        evidence_level: "early",
        is_actionable_weak: false,
      }),
      outcome("threshold", 60, 2),
    ],
    { masteryThreshold: 60, now: NOW },
  );

  assert.equal(result.outcomes[0]?.outcome_id, "weak");
  assert.equal(result.outcomes[0]?.evidenceLevel, "supported");
  assert.equal(result.outcomes[0]?.isActionableWeak, true);
  assert.equal(result.outcomes[1]?.status, "on_track");
  assert.equal(result.supportAreaCount, 1);
});

test("başarı eşiği güvenli aralıkta özelleştirilebilir", () => {
  const rows = [outcome("o1", 65, 2)];

  assert.equal(
    buildGuardianStudentAnalytics(student(), [], rows, {
      masteryThreshold: 60,
      now: NOW,
    }).supportAreaCount,
    0,
  );
  assert.equal(
    buildGuardianStudentAnalytics(student(), [], rows, {
      masteryThreshold: 70,
      now: NOW,
    }).supportAreaCount,
    1,
  );
});

test("gelişim trendi yalnız sonuçlanmış, tarihli ve puanlı sınavları içerir", () => {
  const result = buildGuardianStudentAnalytics(
    student(),
    [
      exam("new", "sonuclandi", {
        completed_at: "2026-08-25T11:00:00.000Z",
        final_score: 90,
      }),
      exam("review", "degerlendiriliyor", { final_score: 99 }),
      exam("old", "sonuclandi", {
        completed_at: "2026-07-20T11:00:00.000Z",
        final_score: 70,
      }),
      exam("invalid", "sonuclandi", {
        completed_at: "geçersiz",
        final_score: 50,
      }),
    ],
    [],
    { now: NOW },
  );

  assert.deepEqual(
    result.growthPoints.map((point) => [point.examId, point.score]),
    [
      ["old", 70],
      ["new", 90],
    ],
  );
});
