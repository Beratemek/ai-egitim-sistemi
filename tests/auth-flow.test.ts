import assert from "node:assert/strict";
import test from "node:test";

import { safeNextPath } from "../lib/auth-cookies.ts";
import {
  SESSION_IDLE_TIMEOUT_MS,
  isSessionIdle,
  parseSessionActivity,
} from "../lib/session-activity.ts";

test("safeNextPath yalnizca uygulama ici yollari kabul eder", () => {
  assert.equal(safeNextPath("/dashboard/ogrenci"), "/dashboard/ogrenci");
  assert.equal(safeNextPath("https://ornek.com"), null);
  assert.equal(safeNextPath("//ornek.com"), null);
  assert.equal(safeNextPath("/\\ornek.com"), null);
  assert.equal(safeNextPath(null), null);
});

test("oturum etkinlik zamani yalnizca gecerli zaman damgasini kabul eder", () => {
  assert.equal(parseSessionActivity("1700000000000"), 1700000000000);
  assert.equal(parseSessionActivity("bozuk"), null);
  assert.equal(parseSessionActivity(null), null);
});

test("oturum 30 dakika dolmadan aktif, esikte pasiftir", () => {
  const lastActivity = 1_700_000_000_000;
  assert.equal(
    isSessionIdle(lastActivity, lastActivity + SESSION_IDLE_TIMEOUT_MS - 1),
    false,
  );
  assert.equal(
    isSessionIdle(lastActivity, lastActivity + SESSION_IDLE_TIMEOUT_MS),
    true,
  );
  assert.equal(isSessionIdle(null, lastActivity + SESSION_IDLE_TIMEOUT_MS), false);
});
