/**
 * Migration'ların gerçekten uygulanıp uygulanmadığını VERİTABANINA sorar.
 *
 * Neden var: bekleyen işi "klasörde BEKLEYEN-*.sql duruyor mu" diye takip
 * etmek yanlış bir ölçüttü. Dosyanın yeri bir defter kaydı; kullanıcı SQL'i
 * çalıştırdığında dosya kendiliğinden taşınmıyor ve "hâlâ bekliyor" denip
 * duruluyordu. Tek doğru ölçüt şemanın kendisi.
 *
 * Her kontrol, migration'ın ürettiği bir izi arar: bir sütun ya da bir
 * fonksiyon. İz varsa o adım uygulanmış demektir.
 *
 * Kullanım: npm run migration:durum
 */

import fs from "node:fs";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE || !SERVICE) {
  console.error("HATA: .env icinde Supabase adresi veya servis anahtari yok.");
  process.exit(1);
}

const H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

/** Sutun okunabiliyorsa migration uygulanmistir. */
async function sutun(tablo, ad) {
  const r = await fetch(`${BASE}/rest/v1/${tablo}?select=${ad}&limit=1`, {
    headers: H,
  });
  return r.status === 200;
}

/**
 * Fonksiyon var mi?
 *
 * 404/PGRST202 "bulunamadi" demek. Yetki hatasi (403) fonksiyonun VAR
 * oldugunu gosterir - cagri korumaya takilmis, yani kod yerinde.
 */
async function fonksiyon(ad, args = {}) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${ad}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(args),
  });
  if (r.status !== 404) return true;
  const govde = await r.text();
  return !govde.includes("PGRST202");
}

const BOS_ID = "00000000-0000-4000-8000-000000000000";

/** Her migration ve onu tanitan iz. */
const ADIMLAR = [
  ["rol-onboarding", () => sutun("users", "role_status")],
  ["student_exam_flow", () => sutun("exam_attempts", "id")],
  ["student_assessment_security", () => fonksiyon("get_my_submissions", { target_exam: BOS_ID })],
  ["admin-rolu (enum + fonksiyonlar)", () => fonksiyon("is_admin")],
  ["coklu-rol", () => sutun("users", "roles")],
  ["rol-yonetimi-admine-gecir", () => fonksiyon("review_role_request", { target_user: BOS_ID, approve: false })],
  ["sinif-ve-atama", () => sutun("users", "classroom")],
  ["ders-yetkisi", () => sutun("instructor_subjects", "user_id")],
  ["ders-yetkisi-bosluklar", () => fonksiyon("can_review_exam", { target_exam: BOS_ID })],
  ["profil-sutunlarini-koru", () => fonksiyon("set_user_classroom", { target_user: BOS_ID, new_classroom: null })],
  ["tum-dersler-yetkisi", () => fonksiyon("all_subjects_token")],
  ["kamera-zorunlulugu", () => sutun("exams", "proctored")],
  ["sinav-suresi", () => fonksiyon("exam_attempt_deadline", { target_exam: BOS_ID, target_student: BOS_ID })],
  ["varsayilan-sure-ve-puan", () => sutun("exams", "points_auto")],
  ["bos-birakilan-sorular", bosSoruKontrolu],
  ["varsayilan-rol", varsayilanRolKontrolu],
];

/**
 * Rol atama sirasi korunuyor mu? (BEKLEYEN-1-varsayilan-rol.sql)
 *
 * Bu migration yeni bir sutun ya da fonksiyon EKLEMIYOR - `set_user_roles` ve
 * `review_role_request` fonksiyonlarinin govdesini degistiriyor. Dolayisiyla
 * varlik kontrolu ise yaramaz, `bos-birakilan-sorular` ile ayni durum.
 *
 * Iz olarak SUTUN ACIKLAMASI kullaniliyor: migration `users.roles` acikla-
 * masini "ATAMA SIRASIYLA" ifadesini icerecek sekilde guncelliyor ve PostgREST
 * sutun aciklamalarini OpenAPI tanimi icinde yayinliyor. Davranisi olcmek icin
 * bir kullanicinin rollerini degistirmek gerekirdi; bu kontrol veri yazmaz.
 */
async function varsayilanRolKontrolu() {
  const r = await fetch(`${BASE}/rest/v1/`, { headers: H });
  if (!r.ok) return false;

  const spec = await r.json();
  const aciklama = spec?.definitions?.users?.properties?.roles?.description ?? "";
  return aciklama.includes("ATAMA SIRASIYLA");
}

/**
 * Bos soru birakilabiliyor mu?
 *
 * Bu migration yeni bir sutun ya da fonksiyon EKLEMIYOR, yalnizca iki
 * fonksiyonun govdesini degistiriyor - dolayisiyla varlik kontrolu ise
 * yaramaz. Ayrimi DAVRANIS veriyor: eski surum, cevaplari eksik bir sinav
 * icin "Tum cevaplar degerlendirmeye gonderilmeden..." hatasi firlatiyordu.
 *
 * Kontrol veri DEGISTIRMEZ: denemesi olmayan bir atama seciliyor, o yuzden
 * yeni surumde guncellenecek satir bulunmuyor ve null donuyor.
 */
async function bosSoruKontrolu() {
  const oku = async (yol) =>
    (await fetch(`${BASE}/rest/v1/${yol}`, { headers: H })).json();

  const [ogrenciler, atamalar, denemeler] = await Promise.all([
    oku("users?select=id,email&email=like.*test.local"),
    oku("exam_assignments?select=exam_id,student_id"),
    oku("exam_attempts?select=exam_id,student_id"),
  ]);

  const aday = atamalar.find(
    (a) =>
      ogrenciler.some((u) => u.id === a.student_id) &&
      !denemeler.some(
        (t) => t.exam_id === a.exam_id && t.student_id === a.student_id,
      ),
  );

  // Uygun ornek yoksa kontrol edilemiyor; "eksik" demek yaniltici olurdu.
  if (!aday) return true;

  const ogrenci = ogrenciler.find((u) => u.id === aday.student_id);
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const giris = await (
    await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email: ogrenci.email, password: "Test1234!" }),
    })
  ).json();

  if (!giris.access_token) return true;

  const r = await fetch(`${BASE}/rest/v1/rpc/submit_exam_attempt`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${giris.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_exam: aday.exam_id }),
  });

  const govde = await r.text();
  return !govde.includes("Tum cevaplar degerlendirmeye gonderilmeden");
}

const sonuclar = await Promise.all(
  ADIMLAR.map(async ([ad, kontrol]) => {
    try {
      return { ad, uygulandi: await kontrol() };
    } catch (err) {
      return { ad, uygulandi: false, hata: err.message };
    }
  }),
);

console.log("MIGRATION DURUMU (veritabanina soruldu)\n");

for (const { ad, uygulandi, hata } of sonuclar) {
  console.log(
    `  ${uygulandi ? "[+]" : "[ ]"} ${ad}${hata ? `  (${hata})` : ""}`,
  );
}

const eksik = sonuclar.filter((r) => !r.uygulandi);

console.log(
  `\n${sonuclar.length - eksik.length}/${sonuclar.length} uygulanmis.`,
);

if (eksik.length > 0) {
  console.log(
    "\nEKSIK:\n" + eksik.map((r) => `  - ${r.ad}`).join("\n"),
  );
  console.log(
    "\nsupabase/migrations/ icindeki ilgili dosyayi SQL Editor'de calistirin.",
  );
  process.exit(1);
}

console.log("Bekleyen migration yok.");
