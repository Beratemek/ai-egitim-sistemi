import assert from "node:assert/strict";
import test from "node:test";

import {
  puanGosterimi,
  puanMetni,
  puandanYuzdeye,
  tamPuanaOturt,
  yuzdedenPuana,
} from "../lib/score-scale.ts";

test("yuzde sorunun puanina cevrilir", () => {
  assert.equal(yuzdedenPuana(100, 25), 25);
  assert.equal(yuzdedenPuana(80, 25), 20);
  assert.equal(yuzdedenPuana(0, 25), 0);
});

test("soru puani yuzdeye cevrilir", () => {
  assert.equal(puandanYuzdeye(25, 25), 100);
  assert.equal(puandanYuzdeye(20, 25), 80);
  assert.equal(puandanYuzdeye(7, 25), 28);
});

test("0 puanlik soruda bolme yapilmaz", () => {
  assert.equal(puandanYuzdeye(5, 0), 0);
});

test("gidis-donus egitmenin girdigi puani korur", () => {
  // Egitmen 25 uzerinden 7 verir; veritabani yuzde tutar; ekran yine 7 der.
  for (const soruPuani of [10, 20, 25, 30, 33]) {
    for (let puan = 0; puan <= soruPuani; puan += 1) {
      const geri = yuzdedenPuana(puandanYuzdeye(puan, soruPuani), soruPuani);
      assert.equal(puanGosterimi(geri), puanGosterimi(puan));
    }
  }
});

test("ondalik yalnizca gerektiginde gosterilir", () => {
  assert.equal(puanGosterimi(17), "17");
  assert.equal(puanGosterimi(6.999), "7");
  assert.equal(puanGosterimi(16.5), "16.5");
});

test("sorunun puani bilinmiyorsa yuzde gosterilir", () => {
  assert.equal(puanMetni(85, undefined), "%85");
  assert.equal(puanMetni(null, 25), "—");
  assert.equal(puanMetni(80, 25), "20 / 25 puan");
});

test("bucuklu puan kaydedilemez - tam puana oturur", () => {
  // %83,33 x 25 = 20,83 puan -> 21
  assert.equal(yuzdedenPuana(tamPuanaOturt(83.33, 25), 25), 21);
  // %50 x 25 = 12,5 -> 13
  assert.equal(yuzdedenPuana(tamPuanaOturt(50, 25), 25), 13);
  // Zaten tam olan puan degismez.
  assert.equal(yuzdedenPuana(tamPuanaOturt(80, 25), 25), 20);
});

test("hicbir yuzde ekranda bucuklu puan uretmez", () => {
  // Sozlesme "kayitli deger tam sayidir" DEGIL, "egitmen bucuk gormez".
  // Yuzde sutunu numeric(5,2): 100u tam bolmeyen puanlarda (30) 1 puan
  // %3,33 olarak yuvarlanir ve geri 0,999 doner. Onemli olan gosterim.
  for (const soruPuani of [2, 3, 7, 10, 25, 30]) {
    for (let yuzde = 0; yuzde <= 100; yuzde += 1) {
      const gosterim = puanGosterimi(
        yuzdedenPuana(tamPuanaOturt(yuzde, soruPuani), soruPuani),
      );
      assert.ok(
        !gosterim.includes("."),
        "%" + yuzde + " x " + soruPuani + " puan -> " + gosterim,
      );
    }
  }
});

test("sorunun puani bilinmiyorsa yuzde korunur", () => {
  assert.equal(tamPuanaOturt(83.33, undefined), 83.33);
  assert.equal(tamPuanaOturt(83.33, 0), 83.33);
});
