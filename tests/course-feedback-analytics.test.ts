import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCourseFeedback } from "../lib/course-feedback-analytics.ts";
import type { CourseFeedbackSummary } from "../lib/queries.ts";

function summary(
  overrides: Partial<CourseFeedbackSummary> = {},
): CourseFeedbackSummary {
  return {
    instructorId: "teacher-1",
    instructorName: "Ayşe Öğretmen",
    subject: "Matematik",
    academicPeriod: "2026-1",
    responseCount: 4,
    clarityAverage: 4,
    paceAverage: 3,
    materialsAverage: 4.5,
    assessmentFairnessAverage: 3.5,
    overallAverage: 3.75,
    helpfulComments: ["Örnekler faydalıydı."],
    improvementComments: ["Daha yavaş ilerlenebilir."],
    ...overrides,
  };
}

test("anonimlik eşiğini geçmeyen grup puan ortalamasına katılmaz", () => {
  const analytics = analyzeCourseFeedback([
    summary({ responseCount: 4, overallAverage: 4 }),
    summary({
      subject: "Fen Bilimleri",
      responseCount: 2,
      clarityAverage: null,
      paceAverage: null,
      materialsAverage: null,
      assessmentFairnessAverage: null,
      overallAverage: null,
      helpfulComments: [],
      improvementComments: [],
    }),
  ]);

  assert.equal(analytics.totalResponses, 6);
  assert.equal(analytics.ratedResponseCount, 4);
  assert.equal(analytics.overallAverage, 4);
  assert.equal(analytics.reportableGroupCount, 1);
  assert.equal(analytics.protectedGroupCount, 1);
});

test("kurum ortalaması grup değil yanıt sayısıyla ağırlıklandırılır", () => {
  const analytics = analyzeCourseFeedback([
    summary({ responseCount: 4, overallAverage: 4.5 }),
    summary({
      instructorId: "teacher-2",
      instructorName: "Mehmet Öğretmen",
      responseCount: 6,
      overallAverage: 3.5,
    }),
  ]);

  assert.equal(analytics.overallAverage, 3.9);
  assert.equal(analytics.instructors.length, 2);
});

test("en güçlü ve en zayıf deneyim boyutları bulunur", () => {
  const analytics = analyzeCourseFeedback([
    summary({
      clarityAverage: 4.4,
      paceAverage: 2.8,
      materialsAverage: 4.1,
      assessmentFairnessAverage: 3.6,
    }),
  ]);

  assert.equal(analytics.strongestMetric?.key, "clarityAverage");
  assert.equal(analytics.weakestMetric?.key, "paceAverage");
});

test("dönem serisi kronolojik sıralanır", () => {
  const analytics = analyzeCourseFeedback([
    summary({ academicPeriod: "2026-2" }),
    summary({ academicPeriod: "2025-2" }),
    summary({ academicPeriod: "2026-1" }),
  ]);

  assert.deepEqual(
    analytics.periods.map((period) => period.period),
    ["2025-2", "2026-1", "2026-2"],
  );
});
