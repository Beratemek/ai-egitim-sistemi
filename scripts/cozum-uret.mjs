/**
 * Çözümü olmayan onaylı sorular için toplu çözüm üretir.
 *
 * NEDEN BETİK, ARAYÜZ DEĞİL: çözüm üretimi içerik uzmanının onayına
 * girmiyor (bilinçli karar). Onay ekranına bir AI çağrısı koymak onayı
 * yavaşlatırdı - üstelik sorular toplu onaylanıyor. Ayrı bir betik hem
 * birikmiş soruları hem bundan sonrakileri aynı araçla halleder ve en
 * önemlisi KOTAYI İNSAN YÖNETİR: ne zaman, kaç tane, hangi derste.
 *
 * Kullanım:
 *   npm run cozum:uret                    -> en fazla 20 soru
 *   npm run cozum:uret -- --limit 5       -> 5 soru
 *   npm run cozum:uret -- --ders Biyoloji -> yalnızca o ders
 *   npm run cozum:uret -- --tur acik_uclu -> yalnızca açık uçlu sorular
 *   npm run cozum:uret -- --model gemini-3.1-flash-lite -> başka modelle
 *
 * NEDEN --model: Gemini ücretsiz katmanında kota MODEL BAŞINA ayrı. Üretim
 * modeli tükendiğinde iş tamamen duruyordu; bu bayrak aynı anahtarla kotası
 * dolmamış bir modele geçmeyi sağlıyor. `.env` dosyasına dokunmadığı için
 * diğer özellikler etkilenmiyor.
 *   npm run cozum:uret -- --kuru          -> hiçbir şey yazma, ne yapacağını göster
 *
 * NEDEN TÜR SÜZGECİ: kota bitince kalanlar üretilmeden kalıyor ve sıra
 * `created_at`'e göre ilerlediği için hangi türe denk geleceği şansa
 * kalıyordu. Açık uçlu sorular sayıca az ama çözümü en çok gereken tür -
 * öğrenci orada "neden yanlış" sorusunun cevabını başka hiçbir yerde
 * bulamıyor. Süzgeç, sınırlı kotayı bilerek yönlendirmeyi sağlıyor.
 *
 * VARSAYILAN SINIR 20: yanlışlıkla 196 soruyu birden üretip kotayı
 * yakmamak için. Bilerek daha fazlası isteniyorsa --limit ile açıkça
 * söylenmeli.
 */

import fs from "node:fs";
import path from "node:path";

/* --- .env.local okuma ---------------------------------------------------- */
/* Berat'in migration-durumu.mjs betigi `.env` ariyor ama projede `.env.local`
   var; ayni hataya dusmemek icin ikisi de deneniyor. */
function envYukle() {
  for (const ad of [".env.local", ".env"]) {
    const yol = path.resolve(process.cwd(), ad);
    if (!fs.existsSync(yol)) continue;
    for (const satir of fs.readFileSync(yol, "utf8").split(/\r?\n/)) {
      if (!satir.includes("=") || satir.trim().startsWith("#")) continue;
      const i = satir.indexOf("=");
      const anahtar = satir.slice(0, i).trim();
      const deger = satir.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!(anahtar in process.env)) process.env[anahtar] = deger;
    }
    return ad;
  }
  return null;
}

const envDosyasi = envYukle();
if (!envDosyasi) {
  console.error("HATA: .env.local bulunamadi.");
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error("HATA: Supabase adresi veya anahtari tanimli degil.");
  process.exit(1);
}

/* --- Argumanlar ---------------------------------------------------------- */
const arg = process.argv.slice(2);
const deger = (ad) => {
  const i = arg.indexOf(ad);
  return i !== -1 && arg[i + 1] ? arg[i + 1] : null;
};
const LIMIT = Math.max(1, Number.parseInt(deger("--limit") ?? "20", 10) || 20);
const DERS = deger("--ders");
const TUR = deger("--tur");
const MODEL = deger("--model");
const KURU = arg.includes("--kuru");

/* --- Giris --------------------------------------------------------------- */
const EPOSTA = process.env.COZUM_EPOSTA;
const PAROLA = process.env.COZUM_PAROLA;

if (!EPOSTA || !PAROLA) {
  console.error(
    "HATA: Bu betik icerik uzmani/egitmen yetkisiyle calisir.\n" +
      "  .env.local dosyasina ekleyin:\n" +
      "    COZUM_EPOSTA=\"...\"\n" +
      "    COZUM_PAROLA=\"...\"",
  );
  process.exit(1);
}

const giris = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EPOSTA, password: PAROLA }),
}).then((r) => r.json());

if (!giris.access_token) {
  console.error("HATA: Giris basarisiz.", JSON.stringify(giris).slice(0, 200));
  process.exit(1);
}

const BASLIK = {
  apikey: ANON,
  Authorization: `Bearer ${giris.access_token}`,
  "Content-Type": "application/json",
};

/* --- Cozumsuz sorulari getir --------------------------------------------- */
/* `solution_json=is.null` icin kismi indeks var (BEKLEYEN-soru-cozumu.sql),
   havuz buyudukce tarama maliyeti artmiyor. */
let sorgu =
  `${URL}/rest/v1/questions?select=id,subject,topic,text,type,options_json,` +
  `correct_answer,rubric,outcome_id&status=eq.onayli&solution_json=is.null` +
  `&order=created_at&limit=${LIMIT}`;
if (DERS) sorgu += `&subject=eq.${encodeURIComponent(DERS)}`;
if (TUR) sorgu += `&type=eq.${encodeURIComponent(TUR)}`;

const sorular = await fetch(sorgu, { headers: BASLIK }).then((r) => r.json());

if (!Array.isArray(sorular)) {
  console.error("HATA: Sorular alinamadi.", JSON.stringify(sorular).slice(0, 200));
  process.exit(1);
}

if (sorular.length === 0) {
  console.log("Cozumu eksik onayli soru yok. Yapilacak is bulunamadi.");
  process.exit(0);
}

console.log(
  `${sorular.length} soru islenecek` +
    (DERS ? ` (ders: ${DERS})` : "") +
    (TUR ? ` (tur: ${TUR})` : "") +
    (MODEL ? ` (model: ${MODEL})` : "") +
    (KURU ? "  [KURU CALISMA - hicbir sey yazilmayacak]" : ""),
);
console.log("");

/* --- Kazanim metinleri (toplu) ------------------------------------------- */
const kazanimIdler = [...new Set(sorular.map((s) => s.outcome_id).filter(Boolean))];
const kazanimlar = new Map();
if (kazanimIdler.length > 0) {
  const liste = await fetch(
    `${URL}/rest/v1/learning_outcomes?select=id,outcome_text&id=in.(${kazanimIdler.join(",")})`,
    { headers: BASLIK },
  ).then((r) => r.json());
  if (Array.isArray(liste)) {
    for (const k of liste) kazanimlar.set(k.id, k.outcome_text);
  }
}

/* --- Uretim -------------------------------------------------------------- */
/* Uygulama sunucusundaki uc nokta kullaniliyor: model secimi, saglayici
   anahtarlari ve istem hep ayni yerde kalsin. Betik kendi basina model
   cagirsaydi iki ayri istem olusur ve zamanla ayrisirlardi. */
const UC = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:8080"}/api/ai/solution`;

/*
  ISTEKLER ARASINDA BEKLEME + KOTA HATASINDA TEK TEKRAR.

  Ucretsiz katmandaki "kota doldu" hatalarinin cogu gunluk sinir degil,
  DAKIKALIK hiz siniri. Araliksiz istek atinca sunucu pes ediyor ve sorular
  cozumsuz kaliyor; kisa bir bekleme cogunu kurtariyor.

  Tek tekrar, cifte degil: kota gercekten bittiyse israr etmek yalnizca
  zaman kaybi. Kalanlar zaten betik yeniden calistirilinca aliniyor.
*/
const BEKLEME_MS = 1_200;
const KOTA_BEKLEME_MS = 20_000;
const uyu = (ms) => new Promise((c) => setTimeout(c, ms));

let basarili = 0;
let hatali = 0;

for (const [sira, soru] of sorular.entries()) {
  const etiket = `${String(sira + 1).padStart(3)}/${sorular.length}`;
  const ozet = String(soru.text).replace(/\s+/g, " ").slice(0, 55);

  if (KURU) {
    console.log(`${etiket}  [kuru] ${soru.subject} · ${ozet}...`);
    continue;
  }

  async function dene() {
    const cevap = await fetch(UC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${giris.access_token}`,
      },
      body: JSON.stringify({ questionId: soru.id, model: MODEL }),
    });
    return { cevap, govde: await cevap.json() };
  }

  try {
    if (sira > 0) await uyu(BEKLEME_MS);

    let { cevap, govde } = await dene();

    /* Kota/hiz hatasi ise bir kez daha, biraz bekleyerek dene. */
    const kotaHatasi =
      (!cevap.ok || govde.ok !== true) &&
      /kota|quota|rate|429|exhaust/i.test(String(govde.error ?? cevap.status));
    if (kotaHatasi) {
      console.log(`${etiket}  ...hiz siniri, ${KOTA_BEKLEME_MS / 1000}sn bekleniyor`);
      await uyu(KOTA_BEKLEME_MS);
      ({ cevap, govde } = await dene());
    }

    if (!cevap.ok || govde.ok !== true) {
      hatali += 1;
      console.log(`${etiket}  HATA  ${ozet}...`);
      console.log(`       ${String(govde.error ?? cevap.status).slice(0, 90)}`);
      continue;
    }

    basarili += 1;
    const c = govde.data;
    console.log(
      `${etiket}  OK    ${ozet}...` +
        `  (${c.steps.length} adim, ${c.options.length} sik)`,
    );
  } catch (hata) {
    hatali += 1;
    console.log(`${etiket}  HATA  ${ozet}...`);
    console.log(`       ${String(hata?.message ?? hata).slice(0, 90)}`);
  }
}

console.log("");
if (KURU) {
  console.log(`Kuru calisma bitti. ${sorular.length} soru islenecekti.`);
} else {
  console.log(`Bitti. Basarili: ${basarili}  Hatali: ${hatali}`);
  if (hatali > 0) {
    console.log("Hatali olanlar cozumsuz kaldi; betigi tekrar calistirinca yeniden denenir.");
  }
}
