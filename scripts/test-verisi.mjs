/**
 * Test verisi uretici.
 *
 * Sistemi gercekten deneyebilmek icin sahte ogrenciler ve cesitli
 * durumlardaki sinavlar olusturur. Iki farkli kimlikle calisir:
 *
 *   - SERVIS ANAHTARI: sinav/soru/cevap tablolarina yazar. Bu tablolarda
 *     ogrenci koruma tetikleyicisi auth.uid() null oldugunda devreye girmez.
 *   - ADMIN OTURUMU: rol ve sinif atar. Bu iki alan guard_role_columns ile
 *     korunuyor ve yalnizca is_admin() gerektiren RPC'lerden yazilabiliyor,
 *     yani servis anahtari YETMEZ - gercek bir yonetici oturumu gerekir.
 *
 * Tekrar calistirilabilir: onceki test verisi MARKER ile bulunup silinir.
 */

import fs from "node:fs";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD;

/** Test verisini tanimak icin; temizlik bununla yapilir. */
const MARKER = "[test-verisi]";
const STUDENT_DOMAIN = "@test.local";

const svc = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...svc, Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function adminRpc(token, name, args) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`rpc ${name} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const gun = 24 * 60 * 60 * 1000;
const simdi = Date.parse(process.env.SEED_NOW ?? "2026-08-22T12:00:00.000Z");
const tarih = (gunFarki, saat = 9) =>
  new Date(simdi + gunFarki * gun + saat * 60 * 60 * 1000).toISOString();

const OGRENCILER = [
  ["Ada Yilmaz", "Derslik-1"],
  ["Bora Demir", "Derslik-1"],
  ["Ceren Kaya", "Derslik-1"],
  ["Deniz Arslan", "Derslik-2"],
  ["Ege Sahin", "Derslik-2"],
  ["Feyza Dogan", "Derslik-2"],
  ["Gokhan Celik", "Derslik-3"],
  ["Hazal Aydin", "Derslik-3"],
  ["Irem Kurt", "Derslik-3"],
];

function slug(ad) {
  return ad
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[^a-z ]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
}

/* -------------------------------------------------------------------------- */

async function temizle() {
  console.log("\n--- Onceki test verisi temizleniyor ---");

  const eskiSinavlar = await rest(
    `exams?select=id,title&description=like.*${encodeURIComponent(MARKER)}*`,
  );
  for (const sinav of eskiSinavlar) {
    // submissions / exam_questions / exam_assignments / exam_attempts
    // hepsi exam_id uzerinden CASCADE ile gider.
    await rest(`exams?id=eq.${sinav.id}`, { method: "DELETE" });
  }
  console.log(`  ${eskiSinavlar.length} sinav silindi`);

  const listeR = await fetch(`${BASE}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const { users = [] } = await listeR.json();
  const eskiOgrenciler = users.filter((u) => (u.email ?? "").endsWith(STUDENT_DOMAIN));

  for (const u of eskiOgrenciler) {
    await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
  }
  console.log(`  ${eskiOgrenciler.length} sahte ogrenci silindi`);
}

async function adminGirisi() {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await r.json();
  if (!r.ok) {
    throw new Error(
      `Yonetici girisi basarisiz (${ADMIN_EMAIL}): ${JSON.stringify(body)}`,
    );
  }
  return body.access_token;
}

async function ogrencileriOlustur(token) {
  console.log("\n--- Ogrenciler ---");
  const sonuc = [];

  for (const [ad, sinif] of OGRENCILER) {
    const email = `${slug(ad)}${STUDENT_DOMAIN}`;

    const r = await fetch(`${BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { full_name: ad, role: "ogrenci" },
      }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(`ogrenci olusturulamadi ${email}: ${JSON.stringify(body)}`);

    // Rol ve sinif YALNIZCA yonetici oturumuyla yazilabilir.
    await adminRpc(token, "set_user_roles", { target_user: body.id, new_roles: ["ogrenci"] });
    await adminRpc(token, "set_user_classroom", { target_user: body.id, new_classroom: sinif });

    sonuc.push({ id: body.id, ad, email, sinif });
    console.log(`  ${ad.padEnd(15)} ${sinif}  ${email}`);
  }

  return sonuc;
}

/* -------------------------------------------------------------------------- */

async function main() {
  if (!ADMIN_PASSWORD) throw new Error("DEV_ADMIN_PASSWORD .env icinde yok.");

  await temizle();

  const token = await adminGirisi();
  console.log(`\nYonetici oturumu acildi: ${ADMIN_EMAIL}`);

  const ogrenciler = await ogrencileriOlustur(token);
  const sinifOgrencileri = (sinif) => ogrenciler.filter((o) => o.sinif === sinif);

  // Egitmen: sinavlarin sahibi.
  const kullanicilar = await rest("users?select=id,email,full_name");
  const egitmen =
    kullanicilar.find((u) => u.email === "emekberat19@gmail.com") ?? kullanicilar[0];

  const sorular = await rest(
    "questions?select=id,subject,topic,type,correct_answer,options_json&status=eq.onayli",
  );
  const derse = (ders) => sorular.filter((q) => q.subject === ders);

  const BIYOLOJI = derse("Biyoloji");
  const ROBOTIK = derse("Robotik ve Kodlama");

  /**
   * On tane sinav, bilerek FARKLI durumlarda: yayinda/taslak, teslim
   * edilmis/edilmemis, onay bekleyen/onaylanmis, suresi gecmis/baslamamis,
   * dersi atanmis/atanmamis. Boylece her ekran gercek bir ornekle test
   * edilebiliyor.
   */
  const PLAN = [
    { baslik: "Biyoloji 1. Donem Yazili",        ders: "Biyoloji",           sinif: "Derslik-1", havuz: BIYOLOJI, soru: 5, yayin: true,  durum: "onay_bekliyor" },
    { baslik: "Biyoloji Fotosentez Testi",       ders: "Biyoloji",           sinif: "Derslik-2", havuz: BIYOLOJI, soru: 3, yayin: true,  durum: "onaylandi" },
    { baslik: "Biyoloji Tekrar Sinavi",          ders: "Biyoloji",           sinif: "Derslik-3", havuz: BIYOLOJI, soru: 4, yayin: true,  durum: "kismi_teslim" },
    { baslik: "Robotik Sensorler Quiz",          ders: "Robotik ve Kodlama", sinif: "Derslik-1", havuz: ROBOTIK,  soru: 5, yayin: true,  durum: "onay_bekliyor" },
    { baslik: "Robotik Mikrodenetleyici Sinavi", ders: "Robotik ve Kodlama", sinif: "Derslik-2", havuz: ROBOTIK,  soru: 6, yayin: true,  durum: "teslim_yok" },
    { baslik: "Robotik Donem Sonu (Taslak)",     ders: "Robotik ve Kodlama", sinif: "Derslik-3", havuz: ROBOTIK,  soru: 4, yayin: false, durum: "taslak" },
    { baslik: "Biyoloji Telafi Sinavi",          ders: "Biyoloji",           sinif: "Derslik-1", havuz: BIYOLOJI, soru: 3, yayin: true,  durum: "suresi_gecti" },
    { baslik: "Robotik Uygulama Sinavi",         ders: "Robotik ve Kodlama", sinif: "Derslik-2", havuz: ROBOTIK,  soru: 5, yayin: true,  durum: "onay_bekliyor" },
    { baslik: "Genel Degerlendirme",             ders: null,                 sinif: "Derslik-3", havuz: ROBOTIK,  soru: 4, yayin: true,  durum: "onay_bekliyor" },
    { baslik: "Biyoloji Hazirlik Sinavi",        ders: "Biyoloji",           sinif: "Derslik-2", havuz: BIYOLOJI, soru: 3, yayin: true,  durum: "baslamadi" },
  ];

  console.log("\n--- Sinavlar ---");

  for (const [i, p] of PLAN.entries()) {
    const secilen = p.havuz.slice(0, Math.min(p.soru, p.havuz.length));
    if (secilen.length === 0) {
      console.log(`  ! ${p.baslik}: havuzda uygun soru yok, atlandi`);
      continue;
    }

    const zaman =
      p.durum === "suresi_gecti"
        ? { starts_at: tarih(-9), ends_at: tarih(-8) }
        : p.durum === "baslamadi"
          ? { starts_at: tarih(4), ends_at: tarih(5) }
          : { starts_at: tarih(-3), ends_at: tarih(3) };

    const [sinav] = await rest("exams", {
      method: "POST",
      body: JSON.stringify({
        title: p.baslik,
        description: `${p.sinif} icin hazirlanmis deneme sinavi. ${MARKER}`,
        subject: p.ders,
        instructor_id: egitmen.id,
        is_published: p.yayin,
        ...zaman,
      }),
    });

    await rest("exam_questions", {
      method: "POST",
      body: JSON.stringify(
        secilen.map((q, idx) => ({
          exam_id: sinav.id,
          question_id: q.id,
          position: idx,
          points: 10,
        })),
      ),
    });

    const sinifOgr = sinifOgrencileri(p.sinif);

    if (p.durum !== "taslak") {
      await rest("exam_assignments", {
        method: "POST",
        body: JSON.stringify(
          sinifOgr.map((o) => ({
            exam_id: sinav.id,
            student_id: o.id,
            assigned_by: egitmen.id,
            due_at: zaman.ends_at,
          })),
        ),
      });
    }

    // Hangi ogrenciler teslim etmis olsun?
    const teslimEdenler =
      p.durum === "taslak" || p.durum === "teslim_yok" || p.durum === "baslamadi"
        ? []
        : p.durum === "kismi_teslim"
          ? sinifOgr.slice(0, 1)
          : sinifOgr;

    for (const [oi, ogr] of teslimEdenler.entries()) {
      await rest("exam_attempts", {
        method: "POST",
        body: JSON.stringify({
          exam_id: sinav.id,
          student_id: ogr.id,
          status: "degerlendiriliyor",
          started_at: tarih(-2, 9),
          submitted_at: tarih(-2, 10),
        }),
      });

      const cevaplar = secilen.map((q, qi) => {
        // Ogrenciye gore degisen bir dogruluk deseni: her sinav duz 0 ya da
        // 100 olmasin, ortalamalar anlamli ciksin.
        const dogru = (oi + qi) % 3 !== 0;
        const test = q.type === "test";

        const cevap = test
          ? dogru
            ? q.correct_answer
            : (q.options_json ?? []).find((o) => o.key !== q.correct_answer)?.key ?? "A"
          : dogru
            ? "Fotosentez, isik enerjisinin kimyasal enerjiye donusturuldugu surectir. Kloroplastta gerceklesir ve karbondioksit ile suyu kullanir."
            : "Bitkilerin yaptigi bir islem.";

        const puan = test ? (dogru ? 100 : 0) : dogru ? 85 : 35;

        return {
          exam_id: sinav.id,
          question_id: q.id,
          student_id: ogr.id,
          answer_text: cevap,
          ai_score: puan,
          ai_feedback: test
            ? dogru
              ? "Dogru cevap."
              : `Yanlis cevap. Dogru sik: ${q.correct_answer}.`
            : dogru
              ? "Rubrigin cogu maddesine deginmissiniz; ornek vererek guclendirebilirsiniz."
              : "Cevap yuzeysel kalmis; surecin asamalarina deginmelisiniz.",
          ai_criteria_json: [],
          status: p.durum === "onaylandi" ? "egitmen_onayli" : "ai_degerlendirildi",
          ...(p.durum === "onaylandi"
            ? { instructor_approved_score: puan, reviewed_by: egitmen.id }
            : {}),
        };
      });

      await rest("submissions", { method: "POST", body: JSON.stringify(cevaplar) });
    }

    console.log(
      `  ${String(i + 1).padStart(2)}. ${p.baslik.padEnd(30)} ${String(p.ders ?? "(ders yok)").padEnd(20)} ${p.sinif}  ${secilen.length} soru  ${teslimEdenler.length} teslim  [${p.durum}]`,
    );
  }

  // Onaylanan sinavlarin sonucu hesaplanmis gorunsun.
  console.log("\n--- Sonuclar hesaplaniyor ---");
  const onaylanan = await rest(
    `exams?select=id&description=like.*${encodeURIComponent(MARKER)}*`,
  );
  let hesaplanan = 0;
  for (const sinav of onaylanan) {
    const denemeler = await rest(
      `exam_attempts?select=student_id&exam_id=eq.${sinav.id}`,
    );
    for (const d of denemeler) {
      try {
        await adminRpc(token, "recalculate_exam_attempt_result", {
          target_exam: sinav.id,
          target_student: d.student_id,
        });
        hesaplanan += 1;
      } catch {
        // Cevaplarin tamami onayli degilse fonksiyon false doner; sorun degil.
      }
    }
  }
  console.log(`  ${hesaplanan} deneme icin sonuc hesaplandi`);

  console.log("\nTest verisi hazir.");
  console.log(`Sahte ogrenci sifresi: Test1234!  (e-postalar ${STUDENT_DOMAIN})`);
}

main().catch((err) => {
  console.error("\nHATA:", err.message);
  process.exit(1);
});
