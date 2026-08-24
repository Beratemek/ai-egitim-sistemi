import assert from "node:assert/strict";
import test from "node:test";

import {
  authCookieOptions,
  authPersistenceFromCookie,
  safeNextPath,
} from "../lib/auth-cookies.ts";

test("safeNextPath yalnizca uygulama ici yollari kabul eder", () => {
  assert.equal(safeNextPath("/dashboard/ogrenci"), "/dashboard/ogrenci");
  assert.equal(safeNextPath("https://ornek.com"), null);
  assert.equal(safeNextPath("//ornek.com"), null);
  assert.equal(safeNextPath("/\\ornek.com"), null);
  assert.equal(safeNextPath(null), null);
});

test("oturum tercihi bilinmeyen degerde guvenli varsayilana duser", () => {
  assert.equal(authPersistenceFromCookie("session"), "session");
  assert.equal(authPersistenceFromCookie("persistent"), "persistent");
  assert.equal(authPersistenceFromCookie(undefined), "persistent");
});

test("hatirlanmayan oturumdan kalicilik alanlari kaldirilir", () => {
  const original = {
    path: "/",
    sameSite: "lax" as const,
    maxAge: 123,
    expires: new Date("2030-01-01T00:00:00.000Z"),
  };

  const session = authCookieOptions(original, "auth-value", "session");
  assert.equal(session.maxAge, undefined);
  assert.equal(session.expires, undefined);
  assert.equal(session.path, "/");
  assert.equal(original.maxAge, 123);

  const deletion = authCookieOptions({ ...original, maxAge: 0 }, "", "session");
  assert.equal(deletion.maxAge, 0);
});
