/**
 * Soru havuzunu doldurur: 6 ders x 10 konu x 5 soru = 300 onayli soru.
 *
 * Sorular AI ile UYRETILMEZ; elle yazilmis bir bankadan gelir. Sebebi iki
 * yonlu: 300 soruyu modele urettirmek kotayi tuketirdi ve uretilen icerigin
 * dogrulugu tek tek denetlenemezdi. Test verisinin dogru olmasi, gercekci
 * gorunmesinden daha onemli.
 *
 * Her konu icin bir KAZANIM da olusturulur ve sorular ona baglanir; boylece
 * ogrencinin "Gelisimim" ekrani kazanim bazli calisir. Kazanim olmadan o
 * ekran bos kalirdi.
 *
 * Tekrar calistirilabilir: bu betigin yazdigi kazanimlar ve onlara bagli
 * sorular MARKER ile bulunup silinir, sonra yeniden yazilir. Bir sinavda
 * KULLANILMIS sorulara dokunulmaz - silinmeleri sinavi bozardi.
 */

import fs from "node:fs";

import { BOLUM_1 } from "./soru-bankasi-1.mjs";
import { BOLUM_2 } from "./soru-bankasi-2.mjs";
import { BOLUM_3 } from "./soru-bankasi-3.mjs";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Bu betigin urettigi kayitlari tanimak icin; temizlik bununla yapilir. */
const MARKER = "[soru-bankasi]";

const H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const SIK_ANAHTARLARI = ["A", "B", "C", "D"];

/**
 * Bankadaki kaydi `questions` satirina cevirir.
 *
 * Dogru sik her zaman ilk sirada yazildi (bankada okunakli olsun diye);
 * burada konumu KAYDIRILIR, aksi halde tum testlerin cevabi A olurdu ve
 * sinav kagidi ise yaramazdi. Kaydirma indekse bagli, yani her calistirmada
 * ayni sonucu verir - rastgelelik yok, tekrar uretilebilir olsun diye.
 */
function testSorusu(kayit, sira) {
  const [metin, siklar, dogruIndex] = kayit;

  const kaydirma = sira % siklar.length;
  const siralanmis = siklar.map(
    (_, i) => siklar[(i - kaydirma + siklar.length * 2) % siklar.length],
  );
  const yeniDogruIndex = (dogruIndex + kaydirma) % siklar.length;

  return {
    type: "test",
    text: metin,
    options_json: siralanmis.map((text, i) => ({
      key: SIK_ANAHTARLARI[i],
      text,
    })),
    correct_answer: SIK_ANAHTARLARI[yeniDogruIndex],
    rubric: null,
  };
}

function acikUcluSoru(kayit) {
  const [metin, rubrik] = kayit;
  return {
    type: "acik_uclu",
    text: metin,
    options_json: null,
    correct_answer: null,
    rubric: rubrik,
  };
}

/* -------------------------------------------------------------------------- */

async function temizle() {
  console.log("--- Onceki soru bankasi temizleniyor ---");

  const kazanimlar = await rest(
    `learning_outcomes?select=id&source_text=like.*${encodeURIComponent(MARKER)}*`,
  );

  if (kazanimlar.length === 0) {
    console.log("  temizlenecek kayit yok");
    return;
  }

  const idler = kazanimlar.map((k) => k.id);

  // Sinavda KULLANILMIS sorular korunur: silmek o sinavlari bozardi.
  const kullanilan = await rest("exam_questions?select=question_id");
  const kullanilanIdler = new Set(kullanilan.map((r) => r.question_id));

  const sorular = await rest(
    `questions?select=id&outcome_id=in.(${idler.join(",")})`,
  );

  const silinecek = sorular
    .map((s) => s.id)
    .filter((id) => !kullanilanIdler.has(id));

  for (let i = 0; i < silinecek.length; i += 50) {
    const parca = silinecek.slice(i, i + 50);
    await rest(`questions?id=in.(${parca.join(",")})`, { method: "DELETE" });
  }

  const korunan = sorular.length - silinecek.length;
  console.log(
    `  ${silinecek.length} soru silindi` +
      (korunan > 0 ? `, ${korunan} tanesi sinavda kullanildigi icin korundu` : ""),
  );

  // Kazanimi olan soru kalmadiysa kazanim da gider.
  const kalan = await rest(
    `questions?select=outcome_id&outcome_id=in.(${idler.join(",")})`,
  );
  const hala = new Set(kalan.map((r) => r.outcome_id));
  const bosKazanimlar = idler.filter((id) => !hala.has(id));

  if (bosKazanimlar.length > 0) {
    for (let i = 0; i < bosKazanimlar.length; i += 50) {
      const parca = bosKazanimlar.slice(i, i + 50);
      await rest(`learning_outcomes?id=in.(${parca.join(",")})`, { method: "DELETE" });
    }
  }
  console.log(`  ${bosKazanimlar.length} kazanim silindi`);
}

async function main() {
  const DERSLER = [...BOLUM_1, ...BOLUM_2, ...BOLUM_3];

  await temizle();

  const kullanicilar = await rest("users?select=id,email");
  const yazar =
    kullanicilar.find((u) => u.email === "emekberat19@gmail.com") ?? kullanicilar[0];

  console.log("\n--- Sorular yaziliyor ---");

  let toplamSoru = 0;
  let sira = 0;

  for (const ders of DERSLER) {
    let dersSoru = 0;

    for (const { konu, sorular } of ders.konular) {
      const [kazanim] = await rest("learning_outcomes", {
        method: "POST",
        body: JSON.stringify({
          category: ders.category,
          topic: konu,
          outcome_text: `${konu} konusunda temel kavramları açıklar ve uygular.`,
          source_text: `${ders.subject} dersi "${konu}" konusu için hazırlanmış soru bankası. ${MARKER}`,
          created_by: yazar.id,
        }),
      });

      const satirlar = sorular.map((kayit) => {
        const ortak = {
          category: ders.category,
          subject: ders.subject,
          topic: konu,
          status: "onayli",
          outcome_id: kazanim.id,
          created_by: yazar.id,
          reviewed_by: yazar.id,
          ai_generated: false,
        };

        // Acik uclu kayitlar iki elemanlidir (metin + rubrik); test
        // kayitlari uc elemanli (metin + siklar + dogru index).
        const govde =
          kayit.length === 2 ? acikUcluSoru(kayit) : testSorusu(kayit, sira++);

        return { ...ortak, ...govde };
      });

      await rest("questions", { method: "POST", body: JSON.stringify(satirlar) });
      dersSoru += satirlar.length;
    }

    toplamSoru += dersSoru;
    console.log(
      `  ${ders.subject.padEnd(24)} ${String(ders.konular.length).padStart(2)} konu  ${String(dersSoru).padStart(3)} soru`,
    );
  }

  console.log(`\nToplam ${toplamSoru} soru yazildi.`);

  // Dogru sik dagilimi: hepsi A olsaydi sinav kagidi ise yaramazdi.
  const dagilim = await rest("questions?select=correct_answer&type=eq.test");
  const sayac = {};
  for (const row of dagilim) {
    const k = row.correct_answer ?? "-";
    sayac[k] = (sayac[k] ?? 0) + 1;
  }
  console.log("Dogru sik dagilimi:", sayac);
}

main().catch((err) => {
  console.error("\nHATA:", err.message);
  process.exit(1);
});
