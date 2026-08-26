import assert from "node:assert/strict";
import test from "node:test";

import { defaultRole, grantedRoles } from "../lib/roles.ts";
import type { UserRole } from "../lib/types.ts";

/**
 * `users.roles` bir Postgres enum dizisidir ve enum veritabani tarafinda
 * arayuzden once buyuyebilir. Ornegin enum'a elle eklenen 'veli' rolu
 * ROLE_DEFINITIONS'ta karsiligi olmadigi icin rol degistiriciyi ve kullanici
 * yonetim tablosunu calisma zamaninda cokertiyordu. Bu testler suzgecin
 * yerinde kaldigini garanti eder.
 */

// Veritabanindan gelen ham satiri taklit eder: tip sistemi enum'a sonradan
// eklenmis bir degeri bilemez, o yuzden burada bilerek zorlanir.
function profile(role: string, roles: string[]) {
  return { role, roles } as { role: UserRole; roles: UserRole[] };
}

test("taninmayan roller kumeden elenir", () => {
  assert.deepEqual(
    grantedRoles(profile("egitmen", ["icerik_uzmani", "veli", "egitmen"])),
    ["icerik_uzmani", "egitmen"],
  );
});

test("atama sirasi korunur", () => {
  assert.deepEqual(
    grantedRoles(profile("ogrenci", ["egitim_yoneticisi", "egitmen", "ogrenci"])),
    ["egitim_yoneticisi", "egitmen", "ogrenci"],
  );
});

test("kume bossa aktif rol tek eleman olur", () => {
  assert.deepEqual(grantedRoles(profile("egitmen", [])), ["egitmen"]);
});

test("kumede de aktif rolde de gecerli rol yoksa ogrenciye duser", () => {
  // Panelin cokmesindense en dar yetkili role duşulur; middleware.ts de
  // taninmayan `role` degerini ayni sekilde 'ogrenci' kabul eder.
  assert.deepEqual(grantedRoles(profile("veli", ["veli"])), ["ogrenci"]);
});

test("varsayilan rol, elenmis degerleri atlayip ilk gecerli rolu verir", () => {
  assert.equal(defaultRole(profile("egitmen", ["veli", "egitmen"])), "egitmen");
});
