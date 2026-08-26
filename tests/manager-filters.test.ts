import assert from "node:assert/strict";
import test from "node:test";

import {
  managerScopeFromSearchParams,
  managerScopeQuery,
} from "../lib/manager-filters.ts";

test("yönetici filtreleri güvenli sorgu kapsamına çevrilir", () => {
  assert.deepEqual(
    managerScopeFromSearchParams({
      ders: "Fen Bilimleri",
      sinav: "exam-1",
      baslangic: "2026-01-01",
      bitis: "2026-01-31",
      esik: "70",
    }),
    {
      subject: "Fen Bilimleri",
      examId: "exam-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      masteryThreshold: 70,
    },
  );
});

test("filtre kapsamı sayfalar arası taşınabilir sorguya dönüşür", () => {
  assert.equal(
    managerScopeQuery({ subject: "Fen Bilimleri", masteryThreshold: 70 }),
    "?ders=Fen+Bilimleri&esik=70",
  );
});

test("geçersiz tarih, çoklu değer ve serbest eşik analitiğe sızmaz", () => {
  assert.deepEqual(
    managerScopeFromSearchParams({
      ders: ["Matematik", "Fen"],
      baslangic: "2026-02-31",
      bitis: "yarın",
      esik: "63",
    }),
    { subject: "Matematik" },
  );
});
