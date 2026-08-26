/**
 * `.env` dosyasindaki degiskenleri Vercel'e yukler.
 *
 * NEDEN: Vercel panelinden dokuz degiskeni elle girmek hem yorucu hem hataya
 * acik - bir karakteri eksik yapistirilan servis anahtari uretimde "Internal
 * Server Error" olarak geri doner ve sebebi gorunmez.
 *
 * GONDERILMEYENLER (bilerek):
 *   DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD  - yerel hizli giris icin; uretimde
 *                                           gercek bir hesabin parolasini
 *                                           sunucuya koymanin anlami yok.
 *   NEXT_PUBLIC_DEV_ROLE_SWITCH           - yalnizca gelistirme kolayligi.
 *
 * ONKOSUL: `npx vercel login` ve `npx vercel link` calistirilmis olmali.
 *
 * Kullanim:
 *   node scripts/vercel-env.mjs           (uretim ortamina yazar)
 *   node scripts/vercel-env.mjs preview   (onizleme ortamina yazar)
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const ORTAM = process.argv[2] ?? "production";

/** Uretime gidecek degiskenler. Listede olmayan hicbir sey gonderilmez. */
const GONDERILECEK = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "AI_PROVIDER",
  "AI_MODEL_GENERATION",
  "AI_MODEL_GRADING",
  "AI_MOCK_MODE",
  "NEXT_PUBLIC_SITE_URL",
];

if (!fs.existsSync(".env")) {
  console.error(".env dosyasi bulunamadi. Proje klasorunde calistirin.");
  process.exit(1);
}

if (!fs.existsSync(".vercel")) {
  console.error("Proje bir Vercel projesine bagli degil. Once: npx vercel link");
  process.exit(1);
}

const degerler = {};
for (const satir of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = satir.match(/^([A-Z_]+)=(.*)$/);
  if (m) degerler[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}

console.log(`Ortam: ${ORTAM}\n`);

let yazilan = 0;
let atlanan = 0;

for (const ad of GONDERILECEK) {
  const deger = degerler[ad];
  if (!deger) {
    console.log(`  atlandi  ${ad}  (.env icinde bos veya yok)`);
    atlanan++;
    continue;
  }

  // Ayni isim zaten varsa Vercel soru sorar; once kaldirip yeniden yaziyoruz
  // ki betik tekrar calistirilabilir olsun.
  spawnSync("npx", ["vercel", "env", "rm", ad, ORTAM, "--yes"], {
    shell: true,
    stdio: "ignore",
  });

  const sonuc = spawnSync("npx", ["vercel", "env", "add", ad, ORTAM], {
    shell: true,
    input: deger + "\n",
    encoding: "utf8",
  });

  if (sonuc.status === 0) {
    // Deger EKRANA BASILMAZ - servis anahtari terminal gecmisinde kalmasin.
    console.log(`  yazildi  ${ad}  (${deger.length} karakter)`);
    yazilan++;
  } else {
    console.log(`  HATA     ${ad}: ${(sonuc.stderr ?? "").trim().split("\n")[0]}`);
    atlanan++;
  }
}

console.log(`\n${yazilan} degisken yazildi, ${atlanan} atlandi.`);
console.log(
  "\nNOT: NEXT_PUBLIC_SITE_URL su an .env'deki degeri tasiyor. Ilk deploy'dan\n" +
    "sonra gercek Vercel adresiyle guncelleyip YENIDEN deploy alin - e-posta\n" +
    "dogrulama ve sifre sifirlama baglantilari bu adresi kullaniyor.",
);
