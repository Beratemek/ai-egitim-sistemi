import assert from "node:assert/strict";
import test from "node:test";

import { questionAnalyticsScopeFromSearchParams } from "../lib/question-analytics-filters.ts";

test("soru analizi filtreleri doğrulanarak kapsama çevrilir", () => {
  assert.deepEqual(
    questionAnalyticsScopeFromSearchParams({
      ders: "Matematik",
      sinav: "e1",
      sinif: "8-A",
      tur: "test",
      baslangic: "2026-01-01",
      bitis: "2026-01-31",
    }),
    {
      subject: "Matematik",
      examId: "e1",
      classroom: "8-A",
      questionType: "test",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    },
  );
});

test("bilinmeyen soru türü ve geçersiz tarih yok sayılır", () => {
  assert.deepEqual(
    questionAnalyticsScopeFromSearchParams({ tur: "karma", baslangic: "2026-02-30" }),
    {},
  );
});
