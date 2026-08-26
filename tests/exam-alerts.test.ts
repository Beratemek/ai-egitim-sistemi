import assert from "node:assert/strict";
import test from "node:test";

import { buildExamAlerts, type ExamAlertInput } from "../lib/exam-alerts.ts";

/**
 * Sinav durum uyarilari.
 *
 * Bu kurallarin varlik sebebi, hicbiri bir HATA uretmeden yanlis duran
 * sinavlardi: yayinda ama kimseye atanmamis bir sinav sessizce orada
 * duruyor, egitmen ogrencilerin neden goremedigini anlamiyordu.
 */

const SIMDI = Date.parse("2026-08-24T12:00:00.000Z");

function sinav(patch: Partial<ExamAlertInput> = {}): ExamAlertInput {
  return {
    id: "s1",
    title: "Biyoloji Ara Sınavı",
    is_published: true,
    ends_at: null,
    questionCount: 10,
    assignedCount: 20,
    ...patch,
  };
}

test("her sey yolundaysa uyari uretilmez", () => {
  assert.deepEqual(buildExamAlerts([sinav()], SIMDI), []);
});

test("yayinda ama kimseye atanmamis sinav uyari verir", () => {
  const [uyari] = buildExamAlerts([sinav({ assignedCount: 0 })], SIMDI);

  assert.equal(uyari?.kind, "atanmamis");
  assert.equal(uyari?.severity, "warning");
});

test("bitis ani gecmis sinav hala yayindaysa uyari verir", () => {
  const [uyari] = buildExamAlerts(
    [sinav({ ends_at: "2026-08-24T11:59:00.000Z" })],
    SIMDI,
  );

  assert.equal(uyari?.kind, "suresi-doldu");
});

test("bitis ani tam SIMDI ise sinav bitmis sayilir", () => {
  const [uyari] = buildExamAlerts(
    [sinav({ ends_at: "2026-08-24T12:00:00.000Z" })],
    SIMDI,
  );

  assert.equal(uyari?.kind, "suresi-doldu", "esitlik 'gecti' tarafinda olmali");
});

test("bitisi henuz gelmemis sinav uyari uretmez", () => {
  assert.deepEqual(
    buildExamAlerts([sinav({ ends_at: "2026-08-24T12:00:01.000Z" })], SIMDI),
    [],
  );
});

test("okunamayan bitis tarihi sinavi 'suresi doldu' saymaz", () => {
  // Bozuk bir kayit yuzunden yayindaki sinav yanlislikla bitmis gorunmemeli.
  assert.deepEqual(buildExamAlerts([sinav({ ends_at: "bozuk-tarih" })], SIMDI), []);
});

test("yayina alinmamis ama sorusu olan sinav hatirlatilir", () => {
  const [uyari] = buildExamAlerts(
    [sinav({ is_published: false, assignedCount: 0 })],
    SIMDI,
  );

  assert.equal(uyari?.kind, "yayina-hazir");
  assert.equal(uyari?.severity, "info", "bu bir hata degil, hatirlatma");
});

test("bos taslak icin 'soru ekleyin' denir", () => {
  const [uyari] = buildExamAlerts(
    [sinav({ is_published: false, questionCount: 0, assignedCount: 0 })],
    SIMDI,
  );

  assert.equal(uyari?.kind, "sorusuz");
});

test("bir sinav en fazla TEK uyari uretir", () => {
  // Hem suresi dolmus hem de kimseye atanmamis: liste bir yapilacaklar
  // listesi olmali, ayni sinav icin iki satir gurultu olurdu.
  const uyarilar = buildExamAlerts(
    [sinav({ ends_at: "2026-01-01T00:00:00.000Z", assignedCount: 0 })],
    SIMDI,
  );

  assert.equal(uyarilar.length, 1);
  assert.equal(uyarilar[0]?.kind, "suresi-doldu", "agir olan once soylenir");
});

test("uyarilar onceligine gore siralanir, esitlikte basliga gore", () => {
  const uyarilar = buildExamAlerts(
    [
      sinav({ id: "a", title: "Zeta", is_published: false, questionCount: 0 }),
      sinav({ id: "b", title: "Alfa", assignedCount: 0 }),
      sinav({ id: "c", title: "Beta", assignedCount: 0 }),
      sinav({ id: "d", title: "Delta", ends_at: "2026-01-01T00:00:00.000Z" }),
    ],
    SIMDI,
  );

  assert.deepEqual(
    uyarilar.map((uyari) => uyari.examId),
    ["d", "b", "c", "a"],
  );
});

test("bos liste bos sonuc verir", () => {
  assert.deepEqual(buildExamAlerts([], SIMDI), []);
});
