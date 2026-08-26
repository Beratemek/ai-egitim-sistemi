import assert from "node:assert/strict";
import test from "node:test";

import { buildTestFeedback } from "../lib/assessment-feedback.ts";

test("yanlış cevap geri bildirimi doğru seçenek anahtarını sızdırmaz", () => {
  const feedback = buildTestFeedback(false);

  assert.equal(feedback, "Yanlış cevap.");
  assert.doesNotMatch(feedback, /doğru\s+(şık|cevap)\s*:/i);
});

test("doğru cevap kısa ve belirleyici biçimde bildirilir", () => {
  assert.equal(buildTestFeedback(true), "Doğru cevap.");
});
