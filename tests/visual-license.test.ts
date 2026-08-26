import assert from "node:assert/strict";
import { test } from "node:test";

import { atifGerekli } from "../lib/visual.ts";

/*
  Bu kural IKI yerde birden kullaniliyor ve ikisinin ayni olmasi sart:

    lib/visual-search.ts             -> atif isteyen gorseli hic secmemek
    components/shared/question-visual.tsx -> gene de gelmisse altyaziyi cizmek

  Ayrisirlarsa ya telif ihlali olur (secilir ama atif cizilmez) ya da
  kullanicinin istemedigi altyazi geri gelir. Testin asil isi bu.
*/

test("kamu mali gorseller atif istemez", () => {
  assert.equal(atifGerekli("Public domain"), false);
  assert.equal(atifGerekli("public domain"), false);
  assert.equal(atifGerekli("PD-old-100"), false);
  assert.equal(atifGerekli("PD-US"), false);
  assert.equal(atifGerekli("CC0"), false);
  assert.equal(atifGerekli("Kamu malı"), false);
});

test("CC BY ve turevleri atif ISTER", () => {
  // Bunlar ekran goruntusunde gelen gercek degerler.
  assert.equal(atifGerekli("CC BY-SA 2.0"), true);
  assert.equal(atifGerekli("CC BY-SA 3.0"), true);
  assert.equal(atifGerekli("CC BY-SA 4.0"), true);
  assert.equal(atifGerekli("CC BY 4.0"), true);
  assert.equal(atifGerekli("GFDL"), true);
});

test("bilinmeyen lisans GUVENLI TARAFTA kalir - atif ister", () => {
  // Yanlis tarafta hata yapmak telif ihlali; dogru tarafta yalnizca
  // gereksiz bir satir yazi.
  assert.equal(atifGerekli(""), true);
  assert.equal(atifGerekli("Wikimedia Commons lisansı"), true);
  assert.equal(atifGerekli("bilinmeyen bir sey"), true);
});

test("buyuk/kucuk harf farki kurali bozmaz", () => {
  assert.equal(atifGerekli("PUBLIC DOMAIN"), false);
  assert.equal(atifGerekli("Cc0"), false);
});
