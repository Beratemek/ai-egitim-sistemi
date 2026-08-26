/**
 * Sunum/demo verisi ureticisi.
 *
 * Amac: jüri sunumunda ekrana gelen HER tablonun dolu, dengeli ve okunabilir
 * olmasi. Uc isi birlikte yapar:
 *
 *   1. HAVUZ  - soru bankasini DENGESIZ dagilimla yazar (50/47/43/38/34/29).
 *               Esit 50'ler "uretilmis veri" gibi durur; gercek bir havuzda
 *               dersler farkli olgunlukta olur.
 *   2. GIZLE  - elle denenmis cirkin kayitlari sahneden cikarir. HICBIRI
 *               SILINMEZ: sinavlar arsivlenir, sorular 'reddedildi' olur.
 *               Ikisi de arayuzden geri alinabilir.
 *   3. SINAV  - dolu sinif listeleri, gercekci cevaplar ve EN ONEMLISI
 *               "okunmayi bekleyen" sinavlar uretir. Bu olmadan egitmenin
 *               puan onay ekrani - urunun temel iddiasinin gorundugu yer -
 *               bos kalir.
 *
 * ai_criteria_json BILEREK DOLDURULUR. Onceki test verisi burayi bos
 * birakiyordu; o zaman onay diyalogunda AI'in gerekcesi ve kriter kirilimi
 * hic gorunmuyor, ekran "AI 70 verdi" demekten ibaret kaliyordu. Kriterler
 * sorunun KENDI rubriginden turetilir, yani ekranda gorunen kirilim rubrikle
 * tutarlidir.
 *
 * Tekrar calistirilabilir: kendi yazdigi kayitlari MARKER ile bulup siler.
 *
 * Kullanim:  node scripts/demo-verisi.mjs
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
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD;

const MARKER = "[demo-verisi]";
const BANKA_MARKER = "[soru-bankasi]";
const OGRENCI_DOMAIN = "@demo.local";

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

async function adminRpc(token, name, args) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`rpc ${name} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const parcala = (dizi, n) =>
  Array.from({ length: Math.ceil(dizi.length / n) }, (_, i) => dizi.slice(i * n, i * n + n));

const gun = 24 * 60 * 60 * 1000;
const simdi = Date.parse(process.env.SEED_NOW ?? new Date().toISOString());
const tarih = (gunFarki, saat = 9) =>
  new Date(simdi + gunFarki * gun + saat * 60 * 60 * 1000).toISOString();

/* ========================================================================== */
/*  1. HAVUZ                                                                  */
/* ========================================================================== */

/**
 * Ders basina konu ve soru sayisi - BILEREK DENGESIZ.
 *
 * `konu` bankadan kac konunun alinacagi, `soru` o konulardan toplam kac
 * sorunun yazilacagi. Konu x 5 tavan sayidir; `soru` ondan kucuk secilerek
 * yuvarlak olmayan toplamlar elde edilir.
 *
 * `taslak` kadari onay BEKLER halde birakilir - "Soru Havuzu Onayi" ekrani
 * bos kalmasin diye. Bu ekran urunun uretim -> onay zincirini gosterdigi yer.
 */
const DERS_PLANI = [
  { subject: "Yapay Zekâ", konu: 10, soru: 50, taslak: 4 },
  { subject: "Yazılım Teknolojileri", konu: 10, soru: 47, taslak: 3 },
  { subject: "Siber Güvenlik", konu: 9, soru: 43, taslak: 2 },
  { subject: "Elektronik ve IoT", konu: 8, soru: 38, taslak: 4 },
  { subject: "Enerji Teknolojileri", konu: 7, soru: 34, taslak: 2 },
  { subject: "Robotik ve Kodlama", konu: 6, soru: 29, taslak: 3 },
];

/** Zorluk dagilimi. Hepsi 'orta' olsaydi zorluk suzgeci ise yaramazdi. */
const ZORLUK_DESENI = ["orta", "kolay", "orta", "zor", "orta", "zor", "kolay", "orta", "zor", "orta"];
const ACIK_UCLU_ZORLUK = ["zor", "orta", "zor"];

const SIK_ANAHTARLARI = ["A", "B", "C", "D"];

/** Dogru sik her bankada ilk sirada yazili; burada kaydirilir. */
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
    options_json: siralanmis.map((text, i) => ({ key: SIK_ANAHTARLARI[i], text })),
    correct_answer: SIK_ANAHTARLARI[yeniDogruIndex],
    rubric: null,
  };
}

function acikUcluSoru(kayit) {
  const [metin, rubrik] = kayit;
  return { type: "acik_uclu", text: metin, options_json: null, correct_answer: null, rubric: rubrik };
}

/**
 * Gercekten DOKUNULAMAZ sorularin kimlikleri.
 *
 * Kural `guard_locked_exam_question_content` ile ayni: bir soru ancak KANIT
 * OLUSMUS (oturum ya da cevap kaydi bulunan) bir sinavda kullaniliyorsa
 * kilitlidir. "Herhangi bir sinavda geciyor" yetmez.
 *
 * Bu ayrimi yapmak sart: aksi halde eski, arsivlenmis deneme sinavlarina
 * bagli yuzlerce soru her turda korunuyor, yeni uretilen kopyalari mukerrer
 * sayilip siliniyor ve havuz eski kayitlarin (hepsi varsayilan 'orta'
 * zorlukta) elinde kaliyordu.
 */
async function kilitliSorular() {
  const kanitli = new Set([
    ...(await rest("exam_attempts?select=exam_id&limit=5000")).map((a) => a.exam_id),
    ...(await rest("submissions?select=exam_id&limit=5000")).map((s) => s.exam_id),
  ]);
  return new Set(
    (await rest("exam_questions?select=exam_id,question_id&limit=5000"))
      .filter((r) => kanitli.has(r.exam_id))
      .map((r) => r.question_id),
  );
}

async function havuzuTemizle() {
  const kazanimlar = await rest(
    `learning_outcomes?select=id&source_text=like.*${encodeURIComponent(BANKA_MARKER)}*`,
  );
  if (kazanimlar.length === 0) return { soru: 0, kazanim: 0 };

  const idler = kazanimlar.map((k) => k.id);
  const kullanilan = await kilitliSorular();

  let silinen = 0;
  for (const grup of parcala(idler, 40)) {
    const sorular = await rest(`questions?select=id&outcome_id=in.(${grup.join(",")})`);
    const silinecek = sorular.map((s) => s.id).filter((id) => !kullanilan.has(id));
    for (const p of parcala(silinecek, 50)) {
      await rest(`questions?id=in.(${p.join(",")})`, { method: "DELETE" });
      silinen += p.length;
    }
  }

  let silinenKazanim = 0;
  for (const grup of parcala(idler, 40)) {
    const kalan = new Set(
      (await rest(`questions?select=outcome_id&outcome_id=in.(${grup.join(",")})`)).map((r) => r.outcome_id),
    );
    const bos = grup.filter((id) => !kalan.has(id));
    for (const p of parcala(bos, 50)) {
      await rest(`learning_outcomes?id=in.(${p.join(",")})`, { method: "DELETE" });
      silinenKazanim += p.length;
    }
  }
  return { soru: silinen, kazanim: silinenKazanim };
}

/**
 * Ayni metne sahip mukerrer sorulari temizler.
 *
 * NEDEN GEREKLI: `havuzuTemizle()` bir sinavda KULLANILAN soruyu silmez -
 * dogru davranis, ama betik birden cok kez calistirildiginda onceki turun
 * demo sinavlarinda kullanilan sorular korunur, ardindan o sinavlar silinir
 * ve geride sahipsiz kopyalar kalir. Bu adim onlari toplar.
 *
 * Korunan kopya: bir sinavda kullanilani, yoksa ilki. Kilitli kayda
 * dokunulmaz.
 */
async function tekrarlariTemizle() {
  const sorular = await rest("questions?select=id,subject,text,status,created_at&limit=5000");
  const kilitli = await kilitliSorular();

  const kumeler = new Map();
  for (const q of sorular) {
    const anahtar = `${q.subject}||${(q.text ?? "").trim()}`;
    if (!kumeler.has(anahtar)) kumeler.set(anahtar, []);
    kumeler.get(anahtar).push(q);
  }

  /**
   * Korunacak kopya: kilitli olan varsa o (baska secenek yok), yoksa EN YENI.
   * En yeniyi tutmak onemli - bu turda yazilan kayit zorluk dagilimi ve
   * taslak/onayli durumu bakimindan dogru olandir.
   */
  const silinecek = [];
  for (const kume of kumeler.values()) {
    if (kume.length < 2) continue;
    const sirali = [...kume].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const korunan = sirali.find((q) => kilitli.has(q.id)) ?? sirali[0];
    for (const q of kume) {
      if (q.id !== korunan.id && !kilitli.has(q.id)) silinecek.push(q.id);
    }
  }

  for (const p of parcala(silinecek, 40)) {
    await rest(`questions?id=in.(${p.join(",")})`, { method: "DELETE" });
  }

  // Sorusu kalmamis kazanimlar da gitsin - havuz tarayicisinda bos konu basligi olur.
  const kazanimlar = await rest("learning_outcomes?select=id&limit=1000");
  const dolu = new Set(
    (await rest("questions?select=outcome_id&limit=5000")).map((r) => r.outcome_id).filter(Boolean),
  );
  const bosKazanim = kazanimlar.map((k) => k.id).filter((id) => !dolu.has(id));
  for (const p of parcala(bosKazanim, 40)) {
    await rest(`learning_outcomes?id=in.(${p.join(",")})`, { method: "DELETE" });
  }

  return { soru: silinecek.length, kazanim: bosKazanim.length };
}

/** Onceki turun demo sinavlarini ve ogrencilerini siler. HAVUZDAN ONCE calismali. */
async function demoyuTemizle() {
  console.log("\n--- 0. Önceki demo verisi ---");
  const eski = await rest(`exams?select=id&description=like.*${encodeURIComponent(MARKER)}*`);
  for (const s of eski) {
    /**
     * `guard_locked_exam_delete` cevap ya da oturum kaydi olan sinavin
     * silinmesini engelliyor - gercek bir sinavin kanitini korumak icin dogru
     * kural. Demo verisini geri almak icin once kanit kayitlari kaldirilir.
     */
    await rest(`submissions?exam_id=eq.${s.id}`, { method: "DELETE" });
    await rest(`exam_attempts?exam_id=eq.${s.id}`, { method: "DELETE" });
    await rest(`exam_assignments?exam_id=eq.${s.id}`, { method: "DELETE" });
    await rest(`exams?id=eq.${s.id}`, { method: "DELETE" });
  }
  const ogr = await ogrencileriTemizle();
  console.log(`  ${eski.length} sınav, ${ogr} öğrenci silindi`);
}

async function havuzuKur(yazarId) {
  console.log("\n--- 1. Soru havuzu ---");
  const temiz = await havuzuTemizle();
  console.log(`  onceki banka temizlendi: ${temiz.soru} soru, ${temiz.kazanim} kazanım`);

  const bankaDersleri = new Map(
    [...BOLUM_1, ...BOLUM_2, ...BOLUM_3].map((d) => [d.subject, d]),
  );

  let sira = 0;
  const ozet = [];

  for (const plan of DERS_PLANI) {
    const ders = bankaDersleri.get(plan.subject);
    if (!ders) {
      console.log(`  ! ${plan.subject}: bankada yok, atlandı`);
      continue;
    }

    const konular = ders.konular.slice(0, plan.konu);
    /** Konu sinirini asmadan, ders toplami `plan.soru` olacak sekilde dagit. */
    let kalan = plan.soru;
    let yazilan = 0;
    let taslakKalan = plan.taslak;

    for (const [ki, { konu, sorular }] of konular.entries()) {
      const kalanKonu = konular.length - ki;
      const pay = Math.min(sorular.length, Math.max(1, Math.round(kalan / kalanKonu)));
      const secilen = sorular.slice(0, pay);
      kalan -= secilen.length;

      const [kazanim] = await rest("learning_outcomes", {
        method: "POST",
        body: JSON.stringify({
          category: ders.category,
          subject: ders.subject, // eskiden yazilmiyordu: uretim formunda ders suzgeci bosa dusuyordu
          topic: konu,
          outcome_text: `${konu} konusunda temel kavramları açıklar ve uygular.`,
          source_text: `${ders.subject} dersi "${konu}" konusu için hazırlanmış soru bankası. ${BANKA_MARKER}`,
          created_by: yazarId,
        }),
      });

      const satirlar = secilen.map((kayit, si) => {
        const govde = kayit.length === 2 ? acikUcluSoru(kayit) : testSorusu(kayit, sira++);
        /**
         * Onay bekleyen taslaklar KONUYA BIRER dagitilir.
         *
         * Onceden son iki konuya yigiliyordu; o konularin onayli soru sayisi
         * bire dusuyor, havuz tarayicisinda "tek soruluk konu" gibi cirkin
         * satirlar cikiyordu. Simdi her konudan en fazla bir soru taslak
         * kalir, hicbir konu bosalmaz.
         */
        const taslak =
          taslakKalan > 0 && si === secilen.length - 1 && ki >= konular.length - plan.taslak;
        if (taslak) taslakKalan--;
        return {
          category: ders.category,
          subject: ders.subject,
          topic: konu,
          status: taslak ? "taslak" : "onayli",
          difficulty:
            govde.type === "acik_uclu"
              ? ACIK_UCLU_ZORLUK[si % ACIK_UCLU_ZORLUK.length]
              : ZORLUK_DESENI[(sira + si) % ZORLUK_DESENI.length],
          outcome_id: kazanim.id,
          created_by: yazarId,
          reviewed_by: taslak ? null : yazarId,
          ai_generated: taslak,
          ...govde,
        };
      });

      await rest("questions", { method: "POST", body: JSON.stringify(satirlar) });
      yazilan += satirlar.length;
    }

    ozet.push({ ders: ders.subject, konu: konular.length, soru: yazilan, taslak: plan.taslak });
    console.log(
      `  ${ders.subject.padEnd(24)} ${String(konular.length).padStart(2)} konu  ${String(yazilan).padStart(3)} soru  (${plan.taslak} onay bekliyor)`,
    );
  }

  const tekrar = await tekrarlariTemizle();
  if (tekrar.soru) console.log(`  mükerrer kayıt temizlendi: ${tekrar.soru} soru, ${tekrar.kazanim} kazanım`);

  const toplam = ozet.reduce((a, o) => a + o.soru, 0);
  console.log(`  toplam ${toplam} soru`);
  return ozet;
}

/* ========================================================================== */
/*  2. CIRKINLIKLERI GIZLE                                                    */
/* ========================================================================== */

/**
 * Elle denenmis kayitlari sahneden cikarir.
 *
 * SILMEZ. Sinav `archived_at` ile arsive, soru `reddedildi` durumuna gecer;
 * ikisi de geri alinabilir. Demo verisini duzeltmek icin gercek kaydi yok
 * etmek gereksiz bir risk.
 */
async function gizle() {
  console.log("\n--- 2. Çirkin kayıtlar gizleniyor ---");

  // --- Elle olusturulmus sinavlar: arsive ---------------------------------
  const sinavlar = await rest("exams?select=id,title,description,archived_at");
  const demoSinav = (s) => (s.description ?? "").includes(MARKER);
  const arsivlenecek = sinavlar.filter((s) => !demoSinav(s) && !s.archived_at);

  for (const s of arsivlenecek) {
    await rest(`exams?id=eq.${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived_at: new Date(simdi).toISOString() }),
    });
    console.log(`  arşiv: "${s.title}"`);
  }
  if (arsivlenecek.length === 0) console.log("  arşivlenecek sınav yok");

  // --- Cilizi kalmis dersler ve parcali konular: reddedildi ---------------
  const sorular = await rest("questions?select=id,subject,topic,status,text&limit=3000");
  const bankaDersleri = new Set(DERS_PLANI.map((p) => p.subject));

  const dersSayaci = {};
  const konuSayaci = {};
  for (const q of sorular) {
    dersSayaci[q.subject ?? "-"] = (dersSayaci[q.subject ?? "-"] ?? 0) + 1;
    const k = `${q.subject}||${q.topic}`;
    konuSayaci[k] = (konuSayaci[k] ?? 0) + 1;
  }

  const aday = sorular.filter((q) => {
    if (q.status !== "onayli") return false;
    if (bankaDersleri.has(q.subject) === false && (dersSayaci[q.subject ?? "-"] ?? 0) < 15) {
      return true; // DENEYAP disi, cilizi kalmis ders (Tarih 13, Matematik 5, Biyoloji 3 ...)
    }
    if (bankaDersleri.has(q.subject) && (konuSayaci[`${q.subject}||${q.topic}`] ?? 0) < 3) {
      return true; // bankadaki dersin altinda tek soruluk, elle uretilmis parcali konu
    }
    if (!q.text || q.text.trim().length < 25) return true; // tek cumlelik, govdesiz soru
    return false;
  });

  /**
   * Baslanmis bir sinavda kullanilan soru havuzdan CEKILEMEZ:
   * `guard_locked_exam_question_content` status degisimini de engelliyor.
   * Bu bilincli bir urun kurali - puanlanmis bir sinavin sorusunu sonradan
   * reddetmek o sinavin kanitini bozardi. Burada kurala uyulur, engellenen
   * kayitlar sayilip raporlanir.
   */
  const kanitliSinavlar = new Set([
    ...(await rest("exam_attempts?select=exam_id")).map((a) => a.exam_id),
    ...(await rest("submissions?select=exam_id&limit=5000")).map((s) => s.exam_id),
  ]);
  const kilitli = new Set(
    (await rest("exam_questions?select=exam_id,question_id&limit=5000"))
      .filter((r) => kanitliSinavlar.has(r.exam_id))
      .map((r) => r.question_id),
  );

  const reddedilecek = aday.filter((q) => !kilitli.has(q.id));
  const atlanan = aday.filter((q) => kilitli.has(q.id));

  for (const p of parcala(reddedilecek.map((q) => q.id), 40)) {
    await rest(`questions?id=in.(${p.join(",")})`, {
      method: "PATCH",
      body: JSON.stringify({ status: "reddedildi" }),
    });
  }
  console.log(`  havuzdan çıkarıldı (reddedildi): ${reddedilecek.length} soru`);
  if (atlanan.length) {
    const dersBazinda = atlanan.reduce((a, q) => ((a[q.subject ?? "-"] = (a[q.subject ?? "-"] ?? 0) + 1), a), {});
    console.log(
      `  ! ${atlanan.length} soru puanlanmış bir sınavda kullanıldığı için havuzda kaldı: ` +
        Object.entries(dersBazinda).map(([k, v]) => `${k}=${v}`).join(", "),
    );
  }

  // --- Dersi bos kazanimlar: soru tablosundan turet ------------------------
  const kazanimlar = await rest("learning_outcomes?select=id,subject,topic&subject=is.null");
  let duzeltilen = 0;
  for (const k of kazanimlar) {
    const eslesen = sorular.find((q) => q.topic === k.topic && q.subject);
    if (!eslesen) continue;
    await rest(`learning_outcomes?id=eq.${k.id}`, {
      method: "PATCH",
      body: JSON.stringify({ subject: eslesen.subject }),
    });
    duzeltilen++;
  }
  console.log(`  dersi boş kazanım düzeltildi: ${duzeltilen}`);

  return { arsiv: arsivlenecek.length, reddedilen: reddedilecek.length, kazanim: duzeltilen };
}

/* ========================================================================== */
/*  3. OGRENCILER                                                             */
/* ========================================================================== */

/** Sinif mevcutlari bilerek esit degil. */
const OGRENCILER = [
  ["Ada Yılmaz", "Derslik-1"], ["Bora Demir", "Derslik-1"], ["Ceren Kaya", "Derslik-1"],
  ["Doruk Şahin", "Derslik-1"], ["Elif Aydın", "Derslik-1"], ["Fatih Öztürk", "Derslik-1"],
  ["Gizem Arslan", "Derslik-1"], ["Halil Koç", "Derslik-1"], ["Irmak Yıldız", "Derslik-1"],
  ["Kaan Erdoğan", "Derslik-2"], ["Leyla Çetin", "Derslik-2"], ["Mert Doğan", "Derslik-2"],
  ["Nazlı Güneş", "Derslik-2"], ["Onur Aksoy", "Derslik-2"], ["Pelin Kurt", "Derslik-2"],
  ["Rüzgar Balcı", "Derslik-2"],
  ["Selin Tunç", "Derslik-3"], ["Tolga Ünal", "Derslik-3"], ["Umut Karaca", "Derslik-3"],
  ["Vildan Şen", "Derslik-3"], ["Yağmur Polat", "Derslik-3"], ["Zeynep Acar", "Derslik-3"],
  ["Emre Bulut", "Derslik-3"], ["Nehir Sarı", "Derslik-3"],
];

function slug(ad) {
  return ad
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z ]/g, "")
    .trim().split(/\s+/).join(".");
}

async function ogrencileriTemizle() {
  const r = await fetch(`${BASE}/auth/v1/admin/users?per_page=500`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const { users = [] } = await r.json();
  const eski = users.filter((u) => (u.email ?? "").endsWith(OGRENCI_DOMAIN));
  for (const u of eski) {
    await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
  }
  return eski.length;
}

async function ogrencileriOlustur(token) {
  console.log("\n--- 3. Öğrenciler ---");
  const sonuc = [];
  for (const [ad, sinif] of OGRENCILER) {
    const email = `${slug(ad)}${OGRENCI_DOMAIN}`;
    const r = await fetch(`${BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "Demo1234!",
        email_confirm: true,
        user_metadata: { full_name: ad, role: "ogrenci" },
      }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(`öğrenci oluşturulamadı ${email}: ${JSON.stringify(body)}`);

    await adminRpc(token, "set_user_roles", { target_user: body.id, new_roles: ["ogrenci"] });
    await adminRpc(token, "set_user_classroom", { target_user: body.id, new_classroom: sinif });
    sonuc.push({ id: body.id, ad, sinif });
  }

  const sayim = sonuc.reduce((a, o) => ((a[o.sinif] = (a[o.sinif] ?? 0) + 1), a), {});
  console.log(`  ${sonuc.length} öğrenci: ` + Object.entries(sayim).map(([k, v]) => `${k}=${v}`).join("  "));
  return sonuc;
}

/* ========================================================================== */
/*  4. CEVAP URETIMI                                                          */
/* ========================================================================== */

/**
 * Rubrik metnini kriterlere ayirir.
 *
 * Banka rubrikleri "Olcut (N puan). Olcut (N puan). Toplam M puan." yapisinda.
 * Buradan cikan kirilim, egitmenin onay diyalogunda GORDUGU kirilimdir; yani
 * ekrandaki puanlar sorunun kendi rubrigiyle tutarli olur.
 */
function rubrigiAyristir(rubrik) {
  if (!rubrik) return [];
  const kriterler = [];
  const re = /([^.]+?)\s*\((\d+)\s*puan\)/g;
  let m;
  while ((m = re.exec(rubrik)) !== null) {
    const metin = m[1].replace(/^[\s.]+/, "").trim();
    if (!metin || /^toplam/i.test(metin)) continue;
    kriterler.push({ criterion: metin, max: Number(m[2]) });
  }
  return kriterler;
}

/**
 * Ogrencinin seviyesine gore kriter bazli puan dagitir.
 *
 * "guclu" tam yakin, "orta" ilk yarisini toplar, "zayif" yalnizca ilk
 * olcutten kismi puan alir. Duz bir yuzde vermek yerine kriter kriter
 * dagitmak onemli: ekranda gorunen sey bu.
 */
function kriterPuanla(kriterler, seviye) {
  return kriterler.map((k, i) => {
    let earned;
    let comment;
    if (seviye === "guclu") {
      earned = i === kriterler.length - 1 && kriterler.length > 2 ? Math.max(1, k.max - 1) : k.max;
      comment = earned === k.max ? "Ölçüt tam karşılanmış." : "Büyük ölçüde karşılanmış, örnek zayıf kalmış.";
    } else if (seviye === "orta") {
      earned = i < Math.ceil(kriterler.length / 2) ? k.max : Math.floor(k.max / 2);
      comment = i < Math.ceil(kriterler.length / 2)
        ? "Doğru açıklanmış."
        : "Değinilmiş ama gerekçelendirilmemiş.";
    } else {
      earned = i === 0 ? Math.max(1, Math.floor(k.max / 2)) : 0;
      comment = i === 0 ? "Kısmen doğru, eksik." : "Cevapta bu ölçüte değinilmemiş.";
    }
    return { criterion: k.criterion, earned, max: k.max, comment };
  });
}

/**
 * Kameraya girecek konular icin ELLE yazilmis cevaplar.
 *
 * Rubrikten uretilen cevaplar uzaktan makul durur ama yakin cekimde
 * "sablondan cikmis" gibi okunur. Sunumda acilacak sinavlarin konulari
 * burada elle yazildi.
 */
const CEVAPLAR = {
  "Yapay Zekâya Giriş": {
    guclu:
      "Sağlıkta yapay zekâ, röntgen ve MR görüntülerini inceleyip şüpheli bölgeleri işaretliyor; doktor kararı yine kendisi veriyor ama tarama hızlanıyor. Ulaşımda navigasyon uygulamaları geçmiş trafik verisiyle varış süresini tahmin edip alternatif güzergâh öneriyor. Eğitimde ise soru çözüm geçmişine bakan sistemler öğrencinin zayıf olduğu konuyu belirleyip ona uygun soru öneriyor. Üçünde de yapay zekânın yaptığı iş, geçmiş veriden örüntü çıkarıp yeni bir durum için tahmin üretmek.",
    orta:
      "Sağlıkta hastalık teşhisinde kullanılıyor, röntgen görüntülerine bakıyor. Navigasyon uygulamalarında yol tarifi veriyor. Bir de telefonlardaki sesli asistanlar var, söylediğimizi anlıyorlar. Bunlar veriye bakarak çalışıyor.",
    zayif: "Yapay zekâ telefonlarda ve bilgisayarlarda kullanılıyor. Mesela sesli asistanlar yapay zekâdır.",
  },
  "Veri ve Veri Seti": {
    guclu:
      "Satışın saate, güne ve hava durumuna göre değiştiğini varsayarak şu özellikleri toplarım: satış saati, haftanın günü, o günkü hava durumu, ürün fiyatı ve okulda etkinlik olup olmadığı. Etiket, o gün en çok satan ürünün adı olur; yani problem çok sınıflı bir sınıflandırma. Veriyi kantin kasasının satış kayıtlarından günlük olarak çekerim, hava durumunu da açık bir servisten eşleştiririm. Öğrencilerin kim ne aldığı bilgisini toplamam; kişiye bağlanabilen veri gerekmiyor, ürün bazında toplam yeterli.",
    orta:
      "Saat, gün ve ürün fiyatı bilgilerini toplarım. Etiket en çok satan ürün olur. Verileri kantindeki kasadan alırız. Öğrencilerin bilgilerini almamak gerekir.",
    zayif: "Kantinde satılan ürünlerin listesini toplarım. Hangisi çok satıyorsa onu tahmin eder.",
  },
  "Denetimli Öğrenme": {
    guclu:
      "Aşırı öğrenme, modelin eğitim verisindeki gürültüyü de dahil ederek örüntü yerine örnekleri ezberlemesidir. Bunu eğitim başarısının çok yüksek, test veya doğrulama başarısının belirgin biçimde düşük olmasından anlarız; iki eğri eğitim ilerledikçe birbirinden ayrılır. Önlem olarak veri artırma ile örnek çeşitliliğini yükseltmek, düzenlileştirme (L2, dropout) uygulamak, gereğinden karmaşık olmayan bir model seçmek ve doğrulama kaybı yükselmeye başladığında erken durdurmak kullanılabilir.",
    orta:
      "Model eğitim verisini ezberler ve yeni veride başarısız olur. Eğitim doğruluğu yüksek ama test doğruluğu düşükse anlarız. Önlem olarak daha fazla veri toplanabilir ve model basitleştirilebilir.",
    zayif: "Model çok fazla öğrenirse olur. Test sonucu kötü çıkar. Daha az eğitmek gerekir.",
  },
  "Sensör Temelleri": {
    guclu:
      "Hassasiyet, aynı ölçümü art arda tekrarladığımızda sonuçların birbirine ne kadar yakın çıktığıdır; tekrarlanabilirlikle ilgilidir. Doğruluk ise ölçülen değerin gerçek değere ne kadar yakın olduğudur. Bir sensör hassas olup doğru olmayabilir: kalibrasyonu bozuk bir termometre 25 derecelik odada her seferinde 27,1 - 27,2 - 27,1 gösteriyorsa ölçümleri birbirine çok yakındır, yani hassastır, ama gerçek değerden 2 derece saptığı için doğru değildir.",
    orta:
      "Hassasiyet ölçümlerin birbirine yakın olmasıdır, doğruluk ise gerçek değere yakın olmasıdır. Bir sensör hassas olup doğru olmayabilir.",
    zayif: "Hassasiyet sensörün küçük değişimleri ölçmesidir. Doğruluk da doğru ölçmesidir.",
  },
  "Ultrasonik Mesafe Sensörü": {
    guclu:
      "Önce tek ölçüme güvenmem: art arda beş ölçüm alıp medyanını kullanırım, böylece tek seferlik sapmalar elenir. Ölçümler arasına en az 60 milisaniye beklerim; aksi hâlde önceki yankı yeni ölçüme karışır. Engel kararını tek bir eşikle değil histerezisle veririm, mesela 20 santimetrede dur, 25 santimetrede devam et; bu sınırda gidip gelmeyi önler. Kritik durumlarda tek sensöre bağlı kalmam, ikinci bir ultrasonik ya da kızılötesi sensörle doğrularım.",
    orta:
      "Birden fazla ölçüm alıp ortalamasını kullanırım. Ölçümler arasında biraz beklerim. Eşik değeri belirlerim. Böylece hatalar azalır.",
    zayif: "Sensörü daha iyi bir yere takarım ve birkaç kere ölçerim.",
  },
  "LDR ve Işık Sensörleri": {
    guclu:
      "LDR'yi sabit bir dirençle gerilim bölücü kuracak şekilde bağlarım ve orta noktayı mikrodenetleyicinin analog girişine veririm; karanlıkta LDR direnci büyüdüğü için okunan gerilim değişir. Gündüz ve gece değerlerini ölçüp aralarında bir eşik belirlerim. Okunan değer eşiğin altına inince röleyi çekip lambayı yakarım. Bulut geçişlerinde lambanın sürekli yanıp sönmemesi için iki ayrı eşik kullanırım ve durumu değiştirmeden önce birkaç saniye beklerim.",
    orta:
      "LDR'yi gerilim bölücüyle analog girişe bağlarım. Bir eşik değeri belirleyip altına düşünce lambayı yakarım. Röle ile kontrol edilir.",
    zayif: "LDR karanlıkta direnci değişir, ona göre lamba yanar.",
  },
};

/** Elle yazilmis cevap yoksa rubrigin olcut ifadelerinden makul bir cevap kur. */
function rubriktenCevap(kriterler, seviye) {
  const say = seviye === "guclu" ? kriterler.length : seviye === "orta" ? Math.ceil(kriterler.length / 2) : 1;
  const parcalar = kriterler.slice(0, say).map((k) =>
    k.criterion
      .replace(/^[A-ZÇĞİÖŞÜ][^:]*:\s*/, "")
      .replace(/\s*(belirtme|açıklama|verme|kullanma|değinme|alma|ekleme|yazılması|kurulması|seçimi)$/i, "")
      .trim(),
  );
  const govde = parcalar.join(". ");
  return govde.charAt(0).toUpperCase() + govde.slice(1) + ".";
}

/* ========================================================================== */
/*  5. SINAVLAR                                                               */
/* ========================================================================== */

/**
 * durum:
 *   okuma_bekliyor  - sinif teslim etti, AI puanladi, EGITMEN ONAYI BEKLIYOR
 *   kismi           - sinifin bir bolumu teslim etti, onlar onay bekliyor
 *   sonuclandi      - egitmen onayladi, ogrenci sonucunu goruyor
 *   teslim_yok      - yayinda, henuz kimse girmemis (yaklasan sinav)
 *   taslak          - yayinlanmamis; sinav kurma / kalite kontrol sahnesi icin
 */
const SINAV_PLANI = [
  { baslik: "Yapay Zekâ · 1. Dönem Değerlendirme", ders: "Yapay Zekâ", sinif: "Derslik-1", soru: 14, sure: 50, durum: "okuma_bekliyor" },
  { baslik: "Robotik ve Kodlama · Sensörler Uygulama Sınavı", ders: "Robotik ve Kodlama", sinif: "Derslik-3", soru: 12, sure: 45, durum: "okuma_bekliyor" },
  { baslik: "Siber Güvenlik Ara Sınavı", ders: "Siber Güvenlik", sinif: "Derslik-2", soru: 11, sure: 40, durum: "kismi" },
  { baslik: "Yazılım Teknolojileri · Döngüler ve Diziler", ders: "Yazılım Teknolojileri", sinif: "Derslik-1", soru: 16, sure: 55, durum: "sonuclandi" },
  { baslik: "Elektronik ve IoT · Devre Temelleri", ders: "Elektronik ve IoT", sinif: "Derslik-2", soru: 10, sure: 35, durum: "teslim_yok" },
  { baslik: "Enerji Teknolojileri · Dönem Sonu", ders: "Enerji Teknolojileri", sinif: "Derslik-3", soru: 18, sure: 60, durum: "taslak" },
];

const ACIKLAMALAR = {
  "Yapay Zekâ · 1. Dönem Değerlendirme":
    "Veri, denetimli öğrenme ve model değerlendirme kazanımlarını kapsar. Açık uçlu sorular rubriğe göre değerlendirilir.",
  "Robotik ve Kodlama · Sensörler Uygulama Sınavı":
    "Sensör temelleri, ultrasonik mesafe ölçümü ve ışık sensörleri konularını kapsar.",
  "Siber Güvenlik Ara Sınavı":
    "Parola güvenliği, kimlik doğrulama ve temel saldırı türleri üzerine ara değerlendirme.",
  "Yazılım Teknolojileri · Döngüler ve Diziler":
    "Değişkenler, döngüler ve dizi işlemleri kazanımlarını ölçer.",
  "Elektronik ve IoT · Devre Temelleri":
    "Ohm yasası, dirençler ve temel devre kurulumu konularını kapsar.",
  "Enerji Teknolojileri · Dönem Sonu":
    "Dönem boyunca işlenen tüm kazanımları kapsayan genel değerlendirme. Yayına alınmadan önce kalite kontrolünden geçirilecek.",
};

/** 100 puani sorulara tam sayi olarak dagitir. */
function puanDagit(adet) {
  const taban = Math.floor(100 / adet);
  const artan = 100 - taban * adet;
  return Array.from({ length: adet }, (_, i) => taban + (i < artan ? 1 : 0));
}

/** Ogrencinin bu sinavdaki genel seviyesi - sinif ortalamasi duz cikmasin. */
const SEVIYELER = ["guclu", "orta", "guclu", "zayif", "orta", "guclu", "orta", "guclu", "zayif"];

async function sinavlariKur(egitmenId, ogrenciler) {
  console.log("\n--- 4. Sınavlar ---");

  // Onceki demo sinavlari `demoyuTemizle()` icinde, HAVUZDAN ONCE silindi.
  const havuz = await rest(
    "questions?select=id,subject,topic,type,text,rubric,correct_answer,options_json&status=eq.onayli&limit=3000",
  );

  const rapor = [];

  for (const plan of SINAV_PLANI) {
    const dersSorulari = havuz.filter((q) => q.subject === plan.ders);
    /** Acik uclu sorular one alinir: onay ekraninin gosterecegi sey onlar. */
    const acik = dersSorulari.filter((q) => q.type === "acik_uclu");
    const test = dersSorulari.filter((q) => q.type === "test");
    const acikPay = Math.min(acik.length, Math.max(2, Math.round(plan.soru * 0.25)));
    const secilen = [...acik.slice(0, acikPay), ...test.slice(0, plan.soru - acikPay)];

    if (secilen.length < plan.soru) {
      console.log(`  ! ${plan.baslik}: havuzda yeterli soru yok (${secilen.length}/${plan.soru})`);
      if (secilen.length === 0) continue;
    }

    const zaman =
      plan.durum === "teslim_yok"
        ? { starts_at: tarih(2, 10), ends_at: tarih(2, 12) }
        : plan.durum === "taslak"
          ? { starts_at: null, ends_at: null }
          : { starts_at: tarih(-4, 9), ends_at: tarih(-4, 11) };

    const [sinav] = await rest("exams", {
      method: "POST",
      body: JSON.stringify({
        title: plan.baslik,
        description: `${ACIKLAMALAR[plan.baslik]} ${MARKER}`,
        subject: plan.ders,
        instructor_id: egitmenId,
        is_published: false, // sorular eklendikten SONRA yayina alinir
        duration_minutes: plan.sure,
        ...zaman,
      }),
    });

    const puanlar = puanDagit(secilen.length);
    await rest("exam_questions", {
      method: "POST",
      body: JSON.stringify(
        secilen.map((q, i) => ({ exam_id: sinav.id, question_id: q.id, position: i, points: puanlar[i] })),
      ),
    });

    if (plan.durum !== "taslak") {
      await rest(`exams?id=eq.${sinav.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_published: true }),
      });
    }

    const sinif = ogrenciler.filter((o) => o.sinif === plan.sinif);

    if (plan.durum !== "taslak") {
      await rest("exam_assignments", {
        method: "POST",
        body: JSON.stringify(
          sinif.map((o, i) => ({
            exam_id: sinav.id,
            student_id: o.id,
            assigned_by: egitmenId,
            due_at: zaman.ends_at,
            booklet: ["A", "B", "C", "D"][i % 4],
          })),
        ),
      });
    }

    const teslimEdenler =
      plan.durum === "taslak" || plan.durum === "teslim_yok"
        ? []
        : plan.durum === "kismi"
          ? sinif.slice(0, Math.ceil(sinif.length * 0.6))
          : sinif;

    let bekleyenCevap = 0;

    for (const [oi, ogr] of teslimEdenler.entries()) {
      const seviye = SEVIYELER[oi % SEVIYELER.length];
      const sonuclandi = plan.durum === "sonuclandi";

      const cevaplar = secilen.map((q, qi) => {
        const puan = puanlar[qi];

        if (q.type === "test") {
          const dogru = seviye === "guclu" ? (oi + qi) % 5 !== 0 : seviye === "orta" ? (oi + qi) % 3 !== 0 : (oi + qi) % 2 === 0;
          const yanlisSik = (q.options_json ?? []).find((o) => o.key !== q.correct_answer)?.key ?? "A";
          return {
            exam_id: sinav.id,
            question_id: q.id,
            student_id: ogr.id,
            answer_text: dogru ? q.correct_answer : yanlisSik,
            ai_score: dogru ? 100 : 0,
            ai_feedback: dogru ? "Doğru cevap." : `Yanlış cevap. Doğru şık: ${q.correct_answer}.`,
            ai_criteria_json: [],
            status: sonuclandi ? "egitmen_onayli" : "ai_degerlendirildi",
            ...(sonuclandi ? { instructor_approved_score: dogru ? 100 : 0, reviewed_by: egitmenId } : {}),
          };
        }

        const kriterler = rubrigiAyristir(q.rubric);
        const puanlanmis = kriterPuanla(kriterler, seviye);
        const kazanilan = puanlanmis.reduce((a, k) => a + k.earned, 0);
        const tavan = puanlanmis.reduce((a, k) => a + k.max, 0) || 1;
        const yuzde = Math.round((kazanilan / tavan) * 100);

        const elle = CEVAPLAR[q.topic];
        const cevap = elle ? elle[seviye] : rubriktenCevap(kriterler, seviye);

        return {
          exam_id: sinav.id,
          question_id: q.id,
          student_id: ogr.id,
          answer_text: cevap,
          ai_score: yuzde,
          ai_feedback:
            seviye === "guclu"
              ? "Rubriğin ölçütlerinin tamamına değinilmiş, açıklamalar örnekle desteklenmiş."
              : seviye === "orta"
                ? "Temel ölçütler karşılanmış; son ölçütlerde gerekçelendirme eksik kalmış."
                : "Cevap yüzeysel; rubrikteki ölçütlerin çoğuna değinilmemiş.",
          ai_criteria_json: puanlanmis,
          status: sonuclandi ? "egitmen_onayli" : "ai_degerlendirildi",
          ...(sonuclandi
            ? {
                instructor_approved_score: yuzde,
                reviewed_by: egitmenId,
                ...(seviye === "orta" ? { instructor_note: "Örnek eklenmiş, bir ölçüt için tam puan verildi." } : {}),
              }
            : {}),
        };
      });

      const toplamPuan = puanlar.reduce((a, b) => a + b, 0);
      const kazanilanPuan = cevaplar.reduce(
        (a, c, i) => a + (Number(c.ai_score) / 100) * puanlar[i],
        0,
      );

      await rest("exam_attempts", {
        method: "POST",
        body: JSON.stringify({
          exam_id: sinav.id,
          student_id: ogr.id,
          status: sonuclandi ? "sonuclandi" : "degerlendiriliyor",
          started_at: tarih(-4, 9),
          submitted_at: tarih(-4, 10),
          ...(sonuclandi
            ? {
                completed_at: tarih(-3, 14),
                earned_points: Math.round(kazanilanPuan * 100) / 100,
                total_points: toplamPuan,
                final_score: Math.round((kazanilanPuan / toplamPuan) * 100),
              }
            : {}),
        }),
      });

      /**
       * PostgREST toplu insert'te BUTUN satirlarin ayni anahtarlari tasimasini
       * ister ("All object keys must match"). Test ve acik uclu satirlar farkli
       * alanlar uretiyor; burada tek semaya oturtulur.
       */
      const duz = cevaplar.map((c) => ({
        exam_id: c.exam_id,
        question_id: c.question_id,
        student_id: c.student_id,
        answer_text: c.answer_text,
        ai_score: c.ai_score,
        ai_feedback: c.ai_feedback,
        ai_criteria_json: c.ai_criteria_json,
        status: c.status,
        instructor_approved_score: c.instructor_approved_score ?? null,
        instructor_note: c.instructor_note ?? null,
        reviewed_by: c.reviewed_by ?? null,
      }));

      for (const p of parcala(duz, 20)) {
        await rest("submissions", { method: "POST", body: JSON.stringify(p) });
      }
      if (!sonuclandi) bekleyenCevap += cevaplar.length;
    }

    rapor.push({ ...plan, soruSayisi: secilen.length, teslim: teslimEdenler.length, bekleyen: bekleyenCevap });
    console.log(
      `  ${plan.baslik.padEnd(46)} ${String(secilen.length).padStart(2)} soru  ${String(teslimEdenler.length).padStart(2)}/${sinif.length} teslim  ${String(bekleyenCevap).padStart(3)} cevap onay bekliyor  [${plan.durum}]`,
    );
  }

  return rapor;
}

/* ========================================================================== */

async function main() {
  if (!BASE || !SERVICE) throw new Error("Supabase anahtarları .env içinde yok.");
  if (!ADMIN_PASSWORD) throw new Error("DEV_ADMIN_PASSWORD .env içinde yok.");

  const kullanicilar = await rest("users?select=id,email,full_name,roles");
  const egitmen =
    kullanicilar.find((u) => u.email === ADMIN_EMAIL) ??
    kullanicilar.find((u) => (u.roles ?? []).includes("egitmen")) ??
    kullanicilar[0];
  if (!egitmen) throw new Error("Sınavların sahibi olacak kullanıcı bulunamadı.");
  console.log(`Sınavların sahibi: ${egitmen.full_name} <${egitmen.email}>`);

  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const oturum = await r.json();
  if (!r.ok) throw new Error(`Yönetici girişi başarısız: ${JSON.stringify(oturum)}`);
  const token = oturum.access_token;

  await demoyuTemizle();
  await havuzuKur(egitmen.id);
  await gizle();
  const ogrenciler = await ogrencileriOlustur(token);
  const sinavlar = await sinavlariKur(egitmen.id, ogrenciler);

  const bekleyenToplam = sinavlar.reduce((a, s) => a + s.bekleyen, 0);
  const havuzSay = await rest("questions?select=status,subject&limit=3000");
  const onayli = havuzSay.filter((q) => q.status === "onayli").length;
  const taslak = havuzSay.filter((q) => q.status === "taslak").length;

  console.log("\n=========================================");
  console.log(`  Havuz:  ${onayli} onaylı soru, ${taslak} onay bekleyen taslak`);
  console.log(`  Sınav:  ${sinavlar.length} sınav`);
  console.log(`  Okuma:  ${bekleyenToplam} cevap eğitmen onayı bekliyor`);
  console.log("=========================================");
}

main().catch((e) => {
  console.error("\nHATA:", e.message);
  process.exit(1);
});
