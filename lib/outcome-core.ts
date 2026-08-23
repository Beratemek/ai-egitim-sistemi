/**
 * Kazanim tekrarini yakalama.
 *
 * SORUN: kazanim serbest metin. Iki hoca ayni seyi olcmek isteyip farkli
 * yazinca ("Fotosentez bilgisi" / "Fotosentez hakkinda her sey") havuz iki
 * kazanima bolunuyor. Ayni sorular ayri kimliklere dagildigi icin kazanim
 * bazli basari yuzdesi hicbir zaman anlamli bir orneklem toplayamiyor. Bu
 * sessiz bir bozulma: kimse hata gormuyor, rapor yalnizca ise yaramaz hale
 * geliyor.
 *
 * COZUM: kazanim metnini CEKIRDEGINE indirip karsilastirmak. Dolgu kelimeler
 * atiliyor, kalan anlamli kelimeler orani olculuyor.
 *
 * FIILLER ATILMIYOR. "evrelerini aciklar" ile "evrelerini siralar" AYNI
 * kazanim degil - biri kavrama, oteki hatirlama olcer. Fiili atsaydik iki
 * farkli bilissel seviyeyi tek kazanima yikardik.
 */

/**
 * Anlam tasimayan kelimeler.
 *
 * Yalnizca DOLGU olanlar: zamirler, baglaclar ve "bilgisi / hakkinda / her
 * sey" gibi kazanimi belirsizlestiren kaliplar. Alan sozcukleri ve fiiller
 * listede YOK - onlar kazanimi kazanim yapan seyler.
 */
const DOLGU = new Set([
  "ogrenci",
  "ogrenciler",
  "ogrencinin",
  "ogrencileri",
  "bilgi",
  "bilgisi",
  "bilgileri",
  "bilgiler",
  "hakkinda",
  "hakkindaki",
  "her",
  "sey",
  "seyi",
  "seyler",
  "seyleri",
  "konu",
  "konusu",
  "konusunda",
  "konuyu",
  "konular",
  "ile",
  "ilgili",
  "iliskin",
  "ve",
  "veya",
  "ya",
  "bir",
  "bu",
  "su",
  "bunlar",
  "tum",
  "tumu",
  "butun",
  "hepsi",
  "genel",
  "genelde",
  "olarak",
  "icin",
  "gibi",
  "kadar",
  "daha",
  "cok",
  "az",
]);

/** Ayni sayilmak icin gereken cekirdek ortakligi. */
export const BENZERLIK_ESIGI = 0.7;

/**
 * Turkce metni ASCII'ye indirger.
 *
 * `toLocaleLowerCase("tr")` once uygulaniyor ("MÜFREDAT" -> "müfredat"), sonra
 * harfler elle cevriliyor: JS'in kucultme kurali i/I ayrimini tek basina
 * dogru tasimiyor.
 */
function asciiye(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[ıi̇]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/**
 * Kazanim metnini anlamli kelime kumesine indirir.
 *
 * "Öğrenci, fotosentez hakkında her şeyi bilir." -> ["fotosentez", "bilir"]
 */
export function outcomeCore(text: string): string[] {
  const kelimeler = asciiye(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !DOLGU.has(word));

  return [...new Set(kelimeler)];
}

/** Kok sayilmak icin gereken en az ortak harf. */
const KOK_EN_AZ = 5;

/** Ortak onekin kisa kelimeye orani bu esigi gecmeli. */
const KOK_ORANI = 0.7;

/**
 * Iki kelime ayni koke mi isaret ediyor?
 *
 * Turkce eklemeli bir dil: "fotosentez" / "fotosentezin" ve "aciklar" /
 * "aciklanir" ayni koke bagli ama dizge olarak farkli. Tam bir govdeleme
 * (stemming) kutuphanesi getirmek yerine ORTAK ONEK ORANI kullaniliyor:
 * paylasilan bas kisim yeterince uzun VE kisa kelimenin buyuk bolumunu
 * kapliyorsa ayni kok sayiliyor.
 *
 * Katı `startsWith` yetmiyordu: "aciklar" "aciklanir"in oneki degil, ikisi
 * de "acikla" kokunden geliyor ve dorduncu harften sonra ayriliyor.
 *
 * Iki esik birlikte yanlis eslesmeyi onluyor:
 *   - En az 5 harf: "ev" ile "evre" eslesemez (ortak onek 2 harf).
 *   - %70 orani  : "acik" ile "aciklamalarindaki" eslesemez, cunku ortak
 *                  kisim uzun kelimeye gore anlamsiz kalir... daha onemlisi
 *                  kisa kelimenin tumunu kapsamayan kismi eslesmeler duser.
 */
function ayniKok(a: string, b: string): boolean {
  if (a === b) return true;

  const [kisa, uzun] = a.length <= b.length ? [a, b] : [b, a];

  let ortak = 0;
  while (ortak < kisa.length && kisa[ortak] === uzun[ortak]) ortak += 1;

  return ortak >= KOK_EN_AZ && ortak / kisa.length >= KOK_ORANI;
}

/**
 * Iki kazanim metninin cekirdek ortakligi (0-1).
 *
 * Jaccard benzerligi, ama esitlik testi `ayniKok` ile yapiliyor.
 */
export function outcomeSimilarity(a: string, b: string): number {
  const solda = outcomeCore(a);
  const sagda = outcomeCore(b);

  // Ikisi de tumuyle dolgudan olusuyorsa ham metne dusuluyor: bos kume
  // karsilastirmasi her seyi ayni gosterirdi.
  if (solda.length === 0 || sagda.length === 0) {
    return asciiye(a).trim() === asciiye(b).trim() ? 1 : 0;
  }

  const kesisim = solda.filter((word) =>
    sagda.some((other) => ayniKok(word, other)),
  ).length;

  // Jaccard: kesisim / birlesim. Birlesim = |A| + |B| - kesisim.
  const birlesim = solda.length + sagda.length - kesisim;

  return birlesim === 0 ? 0 : kesisim / birlesim;
}

export interface OutcomeLike {
  id: string;
  outcome_text: string;
}

/**
 * Verilen metne yeterince benzeyen ilk kazanimi dondurur.
 *
 * Cagiran taraf listeyi AYNI DERS + AYNI KONU ile sinirlamis olmali:
 * "Fotosentez bilgisi" iki farkli derste ayni sey olmak zorunda degil.
 */
export function findSimilarOutcome<T extends OutcomeLike>(
  text: string,
  list: readonly T[],
): T | null {
  let enIyi: { outcome: T; score: number } | null = null;

  for (const outcome of list) {
    const score = outcomeSimilarity(text, outcome.outcome_text);
    if (score < BENZERLIK_ESIGI) continue;
    if (!enIyi || score > enIyi.score) enIyi = { outcome, score };
  }

  return enIyi?.outcome ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Canli arama                                                               */
/* -------------------------------------------------------------------------- */

export interface OutcomeSearchable extends OutcomeLike {
  topic?: string;
  subject?: string | null;
}

/** Aramada bir kaydin listeye girmesi icin gereken en dusuk benzerlik. */
const ARAMA_ESIGI = 0.3;

/**
 * Yazilan metne uyan kazanimlari SIRALI dondurur.
 *
 * `findSimilarOutcome` tek bir "bu zaten var" adayi verir ve esigi yuksektir
 * (BENZERLIK_ESIGI); amaci tekrari engellemek. Bu fonksiyonun isi baska:
 * kullanici yazarken ALTINDA liste acmak, yani ad ararken cikan oneriler
 * gibi davranmak. O yuzden esik dusuk ve sonuc coklu.
 *
 * Iki sinyal birlestiriliyor:
 *   1. ALT DIZI eslesmesi - "fotos" yazinca "Fotosentez" gelmeli. Kelime
 *      cekirdegi benzerligi bunu yakalayamaz; yarim yazilmis bir kelime
 *      hicbir koke tam oturmaz.
 *   2. CEKIRDEK benzerligi - "bitkilerin besin uretimi" yazan biri
 *      "Fotosentezin evreleri"ni gormeli. Alt dizi bunu yakalayamaz.
 *
 * Alt dizi eslesmesi daha guclu bir niyet gostergesi oldugu icin daha
 * yuksek puan alir; konu ve ders eslesmesi ondan biraz daha zayif.
 */
export function searchOutcomes<T extends OutcomeSearchable>(
  query: string,
  list: readonly T[],
  limit = 6,
): T[] {
  const aranan = asciiye(query).trim();
  if (aranan.length < 2) return [];

  const puanli: { outcome: T; score: number }[] = [];

  for (const outcome of list) {
    const metin = asciiye(outcome.outcome_text);
    const konu = asciiye(outcome.topic ?? "");
    const ders = asciiye(outcome.subject ?? "");

    let score = 0;

    if (metin.includes(aranan)) {
      // Bastan eslesme daha anlamli: "foto" -> "Fotosentez..." aranan seydir,
      // cumlenin ortasinda gecen "foto" daha zayif bir sinyal.
      score = metin.startsWith(aranan) ? 1 : 0.85;
    } else if (konu.includes(aranan) || ders.includes(aranan)) {
      score = 0.7;
    }

    const benzerlik = outcomeSimilarity(query, outcome.outcome_text);
    if (benzerlik > score) score = benzerlik;

    if (score >= ARAMA_ESIGI) puanli.push({ outcome, score });
  }

  return puanli
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.outcome);
}
