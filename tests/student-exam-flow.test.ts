import assert from "node:assert/strict";
import test from "node:test";

import { formatRemaining } from "../lib/exam-time.ts";
import {
  canAnswerStudentExam,
  getStudentExamStatus,
} from "../lib/student-exam-status.ts";
import { buildStudyRecommendations } from "../lib/student-recommendations.ts";

const now = new Date("2026-08-21T12:00:00.000Z");
const base = {
  exam: {
    starts_at: "2026-08-21T11:00:00.000Z",
    ends_at: "2026-08-21T13:00:00.000Z",
  },
  questionCount: 3,
  answeredCount: 0,
  evaluatedCount: 0,
  approvedCount: 0,
  now,
};

test("atanmis sinav attempt olusmadan baslanabilir", () => {
  assert.equal(getStudentExamStatus(base), "baslanabilir");
});

test("baslatilan sinav ilk cevap verilmeden de devam ediyor", () => {
  assert.equal(
    getStudentExamStatus({ ...base, attemptStatus: "devam_ediyor" }),
    "devam_ediyor",
  );
});

test("zaman penceresi ve teslim durumlari cevap vermeyi kilitler", () => {
  assert.equal(
    getStudentExamStatus({
      ...base,
      now: new Date("2026-08-21T10:59:59.000Z"),
    }),
    "yaklasan",
  );
  assert.equal(
    getStudentExamStatus({
      ...base,
      now: new Date("2026-08-21T13:00:00.000Z"),
      attemptStatus: "devam_ediyor",
    }),
    "suresi_doldu",
  );
  assert.equal(
    getStudentExamStatus({ ...base, attemptStatus: "degerlendiriliyor" }),
    "onay_bekliyor",
  );
  assert.equal(
    getStudentExamStatus({ ...base, attemptStatus: "sonuclandi" }),
    "sonuclandi",
  );
  assert.equal(canAnswerStudentExam("suresi_doldu"), false);
  assert.equal(canAnswerStudentExam("onay_bekliyor"), false);
});

test("sayac kalan sureyi sabit ve yuvarlanmis bicimde gosterir", () => {
  assert.equal(formatRemaining(0), "00:00");
  assert.equal(formatRemaining(60_001), "01:01");
  assert.equal(formatRemaining(3_661_000), "01:01:01");
});

test("calisma onerileri en zayif kazanimdan baslar ve puana gore eylem uretir", () => {
  const recommendations = buildStudyRecommendations([
    {
      topic: "Sensorler",
      subject: "Robotik",
      outcomeId: "outcome-strong",
      outcomeText: "Sensor verisini yorumlar",
      averageScore: 88,
      approvedAnswerCount: 4,
    },
    {
      topic: "Donguler",
      subject: "Kodlama",
      outcomeId: "outcome-weak",
      outcomeText: "Dongu yapilarini kullanir",
      averageScore: 42,
      approvedAnswerCount: 3,
    },
  ]);

  assert.equal(recommendations[0]?.id, "outcome-weak");
  assert.equal(recommendations[0]?.priority, "yuksek");
  assert.equal(recommendations[1]?.priority, "pekistir");
});
