import assert from "node:assert/strict";
import test from "node:test";

import { defaultRole, grantedRoles } from "../lib/roles.ts";
import type { UserRole } from "../lib/types.ts";

/**
 * `users.roles` bir Postgres enum dizisidir ve enum veritabani tarafinda
 * arayuzden once buyuyebilir. Karsiligi olmayan bir deger suzulmeden gecerse
 * ROLE_DEFINITIONS[rol] `undefined` doner ve rol degistirici ile kullanici
 * yonetim tablosu calisma zamaninda cokuyor. Bu testler suzgecin yerinde
 * kaldigini garanti eder.
 *
 * ORNEK ROL DEGISTI: bu testler yazildiginda taninmayan rol ornegi 'veli'
 * idi - o zaman enum'da vardi ama arayuzde yoktu. Sonra veli GERCEK bir rol
 * oldu (ROLE_DEFINITIONS + /dashboard/veli) ve suzgec onu haklı olarak
 * tutmaya basladi, testler de kirildi. Kod dogruydu, testin varsayimi
 * eskimisti. Artik hic tanimlanmamis bir yer tutucu kullaniliyor; ayni sey
 * bir daha yasanmasin diye ROLE_DEFINITIONS'ta karsiligi OLMAYAN bir ad
 * secildi. Suzgecin kendisi hala gerekli - veritabani enum'u yarin yine
 * arayuzun onune gecebilir.
 */

// Veritabanindan gelen ham satiri taklit eder: tip sistemi enum'a sonradan
// eklenmis bir degeri bilemez, o yuzden burada bilerek zorlanir.
function profile(role: string, roles: string[]) {
  return { role, roles } as { role: UserRole; roles: UserRole[] };
}

test("taninmayan roller kumeden elenir", () => {
  assert.deepEqual(
    grantedRoles(profile("egitmen", ["icerik_uzmani", "mudur_yardimcisi", "egitmen"])),
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
  assert.deepEqual(
    grantedRoles(profile("mudur_yardimcisi", ["mudur_yardimcisi"])),
    ["ogrenci"],
  );
});

test("varsayilan rol, elenmis degerleri atlayip ilk gecerli rolu verir", () => {
  assert.equal(
    defaultRole(profile("egitmen", ["mudur_yardimcisi", "egitmen"])),
    "egitmen",
  );
});

test("veli artik GERCEK bir rol - elenmez", () => {
  // Regresyon koruması: veli bir donem taninmayan rol ornegi olarak
  // kullaniliyordu. ROLE_DEFINITIONS'tan yanlislikla dusurulurse veli
  // paneli sessizce erisilemez hale gelir; bu test onu yakalar.
  assert.deepEqual(grantedRoles(profile("veli", ["veli"])), ["veli"]);
  assert.equal(defaultRole(profile("veli", ["veli"])), "veli");
});
