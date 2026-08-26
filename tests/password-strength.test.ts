import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePasswordStrength } from "../lib/password-strength.ts";

test("bos parola sifir guc dondurur", () => {
  assert.equal(evaluatePasswordStrength("").score, 0);
});

test("sekiz karakter altindaki parola cok kisa kalir", () => {
  assert.equal(evaluatePasswordStrength("kitap7").score, 1);
});

test("uzunluk parola gucunun ana etkenidir", () => {
  assert.ok(
    evaluatePasswordStrength("uzun-bir-ders-parolasi").score >
      evaluatePasswordStrength("Ders123!").score,
  );
});

test("yaygin diziler gucu bir kademe dusurur", () => {
  assert.ok(
    evaluatePasswordStrength("Guvenli1234").score <
      evaluatePasswordStrength("Guvenli7391").score,
  );
});
