import assert from "node:assert/strict";
import test from "node:test";

import {
  courseFeedbackPeriodKey,
  courseFeedbackPeriodLabel,
  courseFeedbackScopeKey,
} from "../lib/course-feedback.ts";

test("ders degerlendirme donemi yil icinde iki parcaya ayrilir", () => {
  assert.equal(courseFeedbackPeriodKey("2026-03-15T10:00:00+03:00"), "2026-1");
  assert.equal(courseFeedbackPeriodKey("2026-08-25T10:00:00+03:00"), "2026-2");
});

test("ders degerlendirme kapsami ders yazimini normalize eder", () => {
  assert.equal(
    courseFeedbackScopeKey("egitmen-1", " Biyoloji ", "2026-2"),
    courseFeedbackScopeKey("egitmen-1", "biyoloji", "2026-2"),
  );
});

test("donem etiketi ogrenciye okunabilir gosterilir", () => {
  assert.equal(courseFeedbackPeriodLabel("2026-2"), "2026 · 2. dönem");
});
