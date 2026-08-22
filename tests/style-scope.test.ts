import assert from "node:assert/strict";
import test from "node:test";

import { selectStyleScope } from "../lib/style-scope.ts";

/**
 * TARZ HAFIZASI DERS BAZLIDIR.
 *
 * Onceden kapsam yoktu: son begeni/red kayitlari ders ayrimi olmadan modele
 * gidiyordu. Sonuc, tarih dersinde "sozel soru olsun" diye verilen geri
 * bildirimin matematik uretimini de sekillendirmesiydi.
 *
 * Asagidaki testler o davranisin geri gelmedigini guvenceye alir.
 */

function kayit(subject: string | null, topic: string) {
  return { subject, topic };
}

test("ayni derste ornek varsa baska derslerin ornegi karismaz", () => {
  const rows = [
    kayit("Tarih", "Beylikler"),
    kayit("Tarih", "Kurtulus Savasi"),
    kayit("Matematik", "Trigonometri"),
  ];

  const { rows: secilen, scope } = selectStyleScope(rows, { subject: "Matematik" });

  assert.equal(scope, "ders");
  assert.deepEqual(secilen, [kayit("Matematik", "Trigonometri")]);
});

test("ayni konuda esik kadar ornek varsa kapsam konuya daralir", () => {
  const rows = [
    kayit("Matematik", "Trigonometri"),
    kayit("Matematik", "Trigonometri"),
    kayit("Matematik", "Turev"),
  ];

  const { rows: secilen, scope } = selectStyleScope(rows, {
    subject: "Matematik",
    topic: "Trigonometri",
  });

  assert.equal(scope, "konu");
  assert.equal(secilen.length, 2);
  assert.ok(secilen.every((row) => row.topic === "Trigonometri"));
});

test("konuda tek ornek varsa derse geri cikilir - tek ornek kopyalanmasin", () => {
  const rows = [
    kayit("Matematik", "Trigonometri"),
    kayit("Matematik", "Turev"),
    kayit("Matematik", "Integral"),
  ];

  const { rows: secilen, scope } = selectStyleScope(rows, {
    subject: "Matematik",
    topic: "Trigonometri",
  });

  assert.equal(scope, "ders");
  assert.equal(secilen.length, 3);
});

test("derste hic ornek yoksa genele dusulur - hic ornek olmamasi daha kotu", () => {
  const rows = [kayit("Tarih", "Beylikler"), kayit("Biyoloji", "Fotosentez")];

  const { rows: secilen, scope } = selectStyleScope(rows, { subject: "Kimya" });

  assert.equal(scope, "genel");
  assert.equal(secilen.length, 2);
});

test("dersi yazilmamis eski kayitlar ders kapsamina girmez", () => {
  const rows = [kayit(null, "Trigonometri"), kayit("Matematik", "Trigonometri")];

  const { rows: secilen, scope } = selectStyleScope(rows, { subject: "Matematik" });

  assert.equal(scope, "ders");
  assert.deepEqual(secilen, [kayit("Matematik", "Trigonometri")]);
});

test("ders yazimindaki buyuk/kucuk harf farki eslesmeyi bozmaz", () => {
  const rows = [kayit("matematik", "Trigonometri")];

  const { scope } = selectStyleScope(rows, { subject: "  Matematik " });

  assert.equal(scope, "ders");
});

test("ders belirtilmezse kapsam genel kalir", () => {
  const rows = [kayit("Tarih", "Beylikler")];

  const { scope } = selectStyleScope(rows, {});

  assert.equal(scope, "genel");
});

test("hic kayit yoksa bos ve genel doner", () => {
  const { rows, scope } = selectStyleScope([], { subject: "Matematik" });

  assert.deepEqual(rows, []);
  assert.equal(scope, "genel");
});
