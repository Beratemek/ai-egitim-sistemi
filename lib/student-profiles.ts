/**
 * OGRENCI PROFILI - simule ogrencinin tek ve ortak modeli.
 *
 * Iki ayri yerde ayni profil kullaniliyor:
 *
 *   1. SORU KALITESI (lib/student-agents.ts) - tek bir soruyu zit yetkinlikte
 *      profillere cozdurup madde analizi cikarmak. Burada profil bir OLCU
 *      ALETIDIR: ayirt edicilik ancak ust ve alt grup varsa hesaplanabilir,
 *      cevap anahtari hatasi ancak kazanimi bilen bir referans profil varsa
 *      yakalanabilir. Bu yuzden o katman SABIT ve zit bir takim kullanir.
 *
 *   2. SINAV KESTIRIMI (lib/exam-simulation.ts) - egitmenin kurdugu ya da
 *      gercek bir siniftan turetilen kadro butun sinavi cozer; puan dagilimi,
 *      soru bazinda tahmin ve sure uyumu cikar. Burada profil bir SINIF
 *      MODELIDIR.
 *
 * Ikisi ayni tipi paylasiyor cunku fark kullanimda, ogrencinin kendisinde
 * degil. Ayri iki persona tanimi tutmak, ayni brief metinlerini iki yerde
 * surdurmek demekti.
 *
 * PARAMETRELER
 *   ability          kazanimi bilme duzeyi (0-1)
 *   subjectAbility   ders bazinda ezme - "matematikte iyi, fizikte zayif"
 *   diligence        dikkat (1 titiz, 0 aceleci)
 *   misconception    tasidigi kavram yanilgisi
 *
 * `brief` alani modele giden karakter tanimi. Hazir profillerde elle
 * yazilmistir; egitmenin kurdugu profillerde `describeProfile()` uretir.
 * Tek alan, tek yol: prompt kuran katman "bu profil hazir mi, elle mi" diye
 * sormak zorunda kalmiyor.
 */

/* -------------------------------------------------------------------------- */
/*  Model                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ayirt edicilik hesabindaki grup.
 *
 * Klasik madde analizinde sinif basariya gore ust %27 / alt %27 diye ikiye
 * bolunur ve iki grubun basari oranlari cikarilir. Ortadaki dilim bilerek
 * disarida birakilir - ayrimi zayiflatir. `notr` grup budur.
 */
export type ProfileGroup = "ust" | "alt" | "notr";

export interface StudentProfile {
  /** Kararli anahtar; model ciktisinda cevabi bu profile baglar. */
  id: string;
  /** Arayuzde gorunen ad. */
  label: string;
  /** Kart altindaki tek cumlelik aciklama. */
  summary: string;
  /** Genel yetkinlik, 0-1. */
  ability: number;
  /**
   * Ders bazinda yetkinlik ezmesi (ders adi -> 0-1).
   *
   * Coklu dersli sinavlarda gerekli: "matematikte iyi ama fizikte zayif" bir
   * ogrenci tek bir `ability` sayisiyla anlatilamaz.
   */
  subjectAbility?: Record<string, number>;
  /** Dikkat duzeyi, 0-1: 1 titiz ve kontrol eder, 0 aceleci. */
  diligence: number;
  /** Tasidigi kavram yanilgisi; yoksa null. */
  misconception: string | null;
  group: ProfileGroup;
  /** Modele verilen karakter tanimi. */
  brief: string;
}

/**
 * Kadrodaki bir profil ve kac gercek ogrenciyi temsil ettigi.
 *
 * AGIRLIK NEDEN VAR: 25 kisilik bir sinifi 25 ayri agent'la simule etmek 25
 * kat maliyet demek. Oysa amac tek tek ogrencileri degil DAGILIMI kestirmek;
 * sinif yetkinlik dilimlerine bolunup her dilim bir temsilciyle canlandirilir
 * ve temsilci kac kisiyi tasiyorsa o kadar agirlik alir. Ortalama, dagilim ve
 * ayirt edicilik bu agirliklarla hesaplanir.
 */
export interface CohortMember {
  profile: StudentProfile;
  /** Kac gercek ogrenciyi temsil ediyor; en az 1. */
  weight: number;
}

/* -------------------------------------------------------------------------- */
/*  Parametreden metin uretme                                                 */
/* -------------------------------------------------------------------------- */

interface Band<T extends string> {
  /** Bu bandin ALT siniri (dahil). */
  from: number;
  key: T;
  text: string;
}

const ABILITY_BANDS: readonly Band<"cok_iyi" | "iyi" | "orta" | "zayif" | "cok_zayif">[] = [
  {
    from: 0.85,
    key: "cok_iyi",
    text:
      "Konuyu tam ogrenmis. Soruyu bastan sona okur, gerekirse islem yapar ve " +
      "secenekleri tek tek eler.",
  },
  {
    from: 0.65,
    key: "iyi",
    text:
      "Konuyu iyi biliyor. Tanimlari ve temel islemleri guvenle yapar; cok " +
      "adimli ya da alisilmadik kurgularda tereddut edebilir.",
  },
  {
    from: 0.45,
    key: "orta",
    text:
      "Konuyu genel hatlariyla biliyor. Tanidik kaliplari cozer, ayrintida ve " +
      "cok adimli islemde takilir; iki secenek arasinda kalirsa asina olani secer.",
  },
  {
    from: 0.25,
    key: "zayif",
    text:
      "On bilgisi eksik. Temel kavramlari yarim ogrenmis; uzun soru kokunde " +
      "kaybolur ve anahtar kelimelere tutunarak tahmin yurutur.",
  },
  {
    from: 0,
    key: "cok_zayif",
    text:
      "Konuyu neredeyse hic bilmiyor. Cogu soruda elemeye ve tahmine dayanir; " +
      "bilmedigini acikca soyler.",
  },
];

const DILIGENCE_BANDS: readonly Band<"titiz" | "normal" | "aceleci">[] = [
  {
    from: 0.75,
    key: "titiz",
    text:
      "Titiz calisir: soru kokunu iki kez okur, olumsuz kaliplari ('degildir', " +
      "'hangisi olamaz') kacirmaz, cevabini kontrol eder.",
  },
  {
    from: 0.4,
    key: "normal",
    text: "Normal bir dikkatle calisir; nadiren okuma hatasi yapar.",
  },
  {
    from: 0,
    key: "aceleci",
    text:
      "Aceleci: soru kokunu hizli okur, olumsuz kaliplari atlayabilir ve ilk " +
      "makul secenege atlar. Ifade muglak ya da tuzakliysa hata yapar.",
  },
];

function bandOf<T extends string>(bands: readonly Band<T>[], value: number): Band<T> {
  const found = bands.find((band) => value >= band.from);
  // Son bandin `from` degeri 0 oldugu icin normal sartlarda hep eslesir;
  // NaN gibi bir girdide de son banda dusuyoruz.
  return found ?? (bands[bands.length - 1] as Band<T>);
}

export interface DescribeProfileInput {
  ability: number;
  diligence: number;
  misconception?: string | null;
  /** Ders bazinda yetkinlik; brief'e "sunda iyi, sunda zayif" satiri ekler. */
  subjectAbility?: Record<string, number> | undefined;
}

/**
 * Parametrelerden modele verilecek karakter tanimini uretir.
 *
 * Sayiyi metne cevirmek sart: "ability 0.35" modele hicbir sey anlatmaz, ama
 * "on bilgisi eksik, anahtar kelimelere tutunarak tahmin yurutur" davranisi
 * dogrudan tarif eder. Bantlar ayri durdugu icin esik degistirmek tek yerden
 * yapiliyor ve birim testi yazilabiliyor.
 */
export function describeProfile(input: DescribeProfileInput): string {
  const parts = [
    bandOf(ABILITY_BANDS, input.ability).text,
    bandOf(DILIGENCE_BANDS, input.diligence).text,
  ];

  const subjects = Object.entries(input.subjectAbility ?? {});
  if (subjects.length > 0) {
    const sirali = subjects.sort(([, a], [, b]) => b - a);
    parts.push(
      "DERS BAZINDA DUZEYI: " +
        sirali
          .map(([subject, value]) => `${subject}: ${bandOf(ABILITY_BANDS, value).key.replace("_", " ")}`)
          .join(", ") +
        ". Sorunun dersi hangisiyse O dersteki duzeyini uygula.",
    );
  }

  if (input.misconception) {
    parts.push(
      `TASIDIGI KAVRAM YANILGISI: ${input.misconception}. Kendince tutarli ama ` +
        "temelde hatali bu modelle dusun; hangi secenek yanilgiyi karsiliyorsa onu sec.",
    );
  }

  return parts.join(" ");
}

/**
 * Yetkinlige gore ust/alt grup atamasi.
 *
 * Elle profil kuran egitmen grup kavramini bilmek zorunda kalmasin diye var:
 * "%85 seviyesinde bir ogrenci" denince o profil kendiliginden ust gruba
 * girer ve ayirt edicilik hesabina dogru tarafta katilir.
 */
export function groupFromAbility(ability: number): ProfileGroup {
  if (ability >= 0.7) return "ust";
  if (ability <= 0.45) return "alt";
  return "notr";
}

export interface CreateProfileInput extends DescribeProfileInput {
  id: string;
  label: string;
  summary?: string;
  /** Verilmezse `groupFromAbility()` karar verir. */
  group?: ProfileGroup;
  /** Verilmezse `describeProfile()` uretir. */
  brief?: string;
}

/** Parametrelerden eksiksiz bir profil kurar. */
export function createProfile(input: CreateProfileInput): StudentProfile {
  const ability = clamp01(input.ability);
  const diligence = clamp01(input.diligence);

  return {
    id: input.id,
    label: input.label,
    summary: input.summary ?? defaultSummary(ability, diligence),
    ability,
    ...(input.subjectAbility ? { subjectAbility: input.subjectAbility } : {}),
    diligence,
    misconception: input.misconception ?? null,
    group: input.group ?? groupFromAbility(ability),
    brief:
      input.brief ??
      describeProfile({
        ability,
        diligence,
        misconception: input.misconception ?? null,
        subjectAbility: input.subjectAbility,
      }),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function defaultSummary(ability: number, diligence: number): string {
  const yetkinlik = bandOf(ABILITY_BANDS, ability).key;
  const dikkat = bandOf(DILIGENCE_BANDS, diligence).key;
  const yetkinlikMetni: Record<string, string> = {
    cok_iyi: "Konuyu tam biliyor",
    iyi: "Konuyu iyi biliyor",
    orta: "Konuyu orta düzeyde biliyor",
    zayif: "Ön bilgisi eksik",
    cok_zayif: "Konuyu bilmiyor",
  };
  const dikkatMetni: Record<string, string> = {
    titiz: "titiz çalışıyor",
    normal: "normal dikkatle çalışıyor",
    aceleci: "aceleci",
  };
  return `${yetkinlikMetni[yetkinlik] ?? "Düzeyi belirsiz"}, ${dikkatMetni[dikkat] ?? "dikkati belirsiz"}.`;
}

/* -------------------------------------------------------------------------- */
/*  Hazir profiller - soru kalitesi olcumunun sabit takimi                    */
/* -------------------------------------------------------------------------- */

/**
 * Soru kalitesi panelinin kullandigi ZIT takim.
 *
 * Bu bes profil bir sinif degil, bir OLCU ALETIDIR ve bu yuzden sabittir:
 *
 *   - Hepsi ayni derste iyi olsaydi hepsi dogru bilir, ayirt edicilik
 *     hesaplanamaz, celdiricilerin hangisinin ise yaradigi gorulemezdi.
 *   - Kazanimi bilen bir referans profil (guclu) olmasaydi "cevap anahtari
 *     hatali" bulgusu hicbir zaman uretilemezdi.
 *
 * Brief metinleri elle yazili: `describeProfile()` genel bir tarif uretir,
 * burada ise her profilin ne ISE YARADIGINI da anlatan ozel bir metin var
 * (ozellikle "belirsizligi fark et ve soyle" talimati).
 */
export const PRESET_PROFILES: readonly StudentProfile[] = [
  {
    id: "guclu",
    label: "Güçlü öğrenci",
    summary: "Kazanımı tam öğrenmiş; bu öğrenci yanılıyorsa soruda sorun var.",
    ability: 0.9,
    diligence: 0.9,
    misconception: null,
    group: "ust",
    brief:
      "Kazanimi tam ogrenmis, dikkatli ve sistemli calisan bir ogrenci. " +
      "Soruyu bastan sona okur, gerekirse islem yapar, secenekleri tek tek eler. " +
      "Bildigi konuda emin cevap verir; ama soru belirsizse ya da iki secenek de " +
      "savunulabilirse bunu FARK EDER ve acikca belirtir.",
  },
  {
    id: "ortalama",
    label: "Ortalama öğrenci",
    summary: "Konuyu genel hatlarıyla bilir, ayrıntıda tereddüt eder.",
    ability: 0.65,
    diligence: 0.7,
    misconception: null,
    group: "ust",
    brief:
      "Konuyu genel hatlariyla bilen, temel tanimlari hatirlayan ama ayrintida ve " +
      "cok adimli islemde tereddut eden bir ogrenci. Tanidik gelen secenege yonelir; " +
      "iki secenek arasinda kalirsa daha asina oldugunu secer.",
  },
  {
    id: "zorlanan",
    label: "Zorlanan öğrenci",
    summary: "Ön bilgisi eksik; sorunun okunabilirliğini test eder.",
    ability: 0.3,
    diligence: 0.6,
    misconception: null,
    group: "alt",
    brief:
      "On bilgisi eksik, konunun temel kavramlarini yarim ogrenmis bir ogrenci. " +
      "Uzun ve karmasik soru kokunde kaybolur, anahtar kelimelere tutunarak tahmin " +
      "yurutur. Bilmiyorsa bilmedigini soyler ve en makul gorduguyle gider.",
  },
  {
    id: "yanilgili",
    label: "Kavram yanılgılı öğrenci",
    summary: "Yaygın bir yanılgıyla düşünür; çeldiricilerin gücünü ölçer.",
    ability: 0.45,
    diligence: 0.7,
    misconception: "konudaki en yaygin kavram yanilgisi",
    group: "alt",
    brief:
      "Konuda YAYGIN bir kavram yanilgisi tasiyan ogrenci. Kendince tutarli ama " +
      "temelde hatali bir modelle dusunur (or. 'agir cisim daha hizli duser', " +
      "'buyuk paydali kesir daha buyuktur'). Once bu konudaki en yaygin yanilgiyi " +
      "belirle, sonra o yanilgiyla cevap ver: hangi secenek o yanilgiyi karsiliyorsa " +
      "onu sec.",
  },
  {
    id: "aceleci",
    label: "Aceleci öğrenci",
    summary: "Soruyu hızlı okur; tuzaklı ve muğlak ifadeleri ortaya çıkarır.",
    ability: 0.75,
    diligence: 0.25,
    misconception: null,
    group: "notr",
    brief:
      "Konuyu bilen ama sinavda aceleci davranan bir ogrenci. Soru kokunu hizli " +
      "okur; 'degildir', 'yanlistir', 'hangisi olamaz' gibi olumsuz kaliplari " +
      "atlayabilir ve ilk makul secenege atlar. Ifade muglak ya da tuzakliysa hata " +
      "yapar; ifade netse dogru cevabi verir.",
  },
];

/** Kadroda bir kimlige karsilik gelen profili bulur. */
export function findProfile(
  profiles: readonly StudentProfile[],
  id: string,
): StudentProfile | null {
  return profiles.find((profile) => profile.id === id) ?? null;
}

/** Hazir takimi kadro bicimine cevirir; her profil tek bir ogrenciyi temsil eder. */
export function presetCohort(): CohortMember[] {
  return PRESET_PROFILES.map((profile) => ({ profile, weight: 1 }));
}

/* -------------------------------------------------------------------------- */
/*  Dijital ikiz - gercek siniftan kadro turetme                              */
/* -------------------------------------------------------------------------- */

/**
 * Gercek bir ogrencinin gecmis basari ozeti.
 *
 * AD YOK, KIMLIK YOK. Kadro kurulurken yalnizca sayilar kullaniliyor ve
 * uretilen profiller "ust dilim", "alt dilim" diye anonim adlandiriliyor.
 * Gercek ad modele gitseydi, ogrenci kisisel verisi ucuncu taraf bir model
 * saglayicisina tasinmis olurdu - ve simulasyon icin hicbir faydasi yok.
 */
export interface StudentPerformanceSample {
  /** Yalniz gruplama icin; profile yazilmaz. */
  studentId: string;
  /** Egitmen onayli cevaplarin ortalamasi, 0-100. Olculmemisse null. */
  averageScore: number | null;
  /** Ders bazinda ortalama, 0-100. */
  bySubject: Record<string, number>;
  /** Bos birakilan soru orani, 0-1. */
  blankRate: number;
  /** Ortalamaya giren onayli cevap sayisi. */
  answerCount: number;
}

export const TWIN_DEFAULTS = {
  /** Uretilecek temsilci profil sayisi. */
  size: 5,
  /** Bir ogrencinin dilime girmesi icin gereken en az onayli cevap sayisi. */
  minAnswers: 3,
} as const;

export interface ClassroomTwinResult {
  cohort: CohortMember[];
  /** Kadroya giren gercek ogrenci sayisi. */
  studentCount: number;
  /** Yeterli verisi olmadigi icin disarida kalan ogrenci sayisi. */
  skippedCount: number;
  /** Sinifin gercek ortalamasi, 0-100; hesaplanamazsa null. */
  classAverage: number | null;
}

/**
 * Gercek sinif verisinden temsilci kadro uretir.
 *
 * YONTEM: ogrenciler basariya gore siralanir ve `size` dilime bolunur; her
 * dilim tek bir profille temsil edilir, agirligi dilimdeki ogrenci sayisidir.
 * Yetkinlik dilimin ortalamasindan, ders bazli yetkinlik o dilimdeki
 * ogrencilerin ders ortalamalarindan, dikkat ise bos birakma oranindan gelir.
 *
 * GRUP ATAMASI dilimin sirasindan: en alt dilim `alt`, en ust dilim `ust`,
 * aradakiler `notr`. Klasik madde analizindeki ust/alt %27 ayrimiyla ayni
 * mantik - ortadaki yigin ayrimi zayiflattigi icin disarida birakilir.
 *
 * Sinif `size` kisiden azsa her ogrenci kendi profiliyle temsil edilir.
 */
export function buildClassroomTwin(
  samples: readonly StudentPerformanceSample[],
  options: { label?: string; size?: number; minAnswers?: number } = {},
): ClassroomTwinResult {
  const size = Math.max(1, options.size ?? TWIN_DEFAULTS.size);
  const minAnswers = options.minAnswers ?? TWIN_DEFAULTS.minAnswers;

  const usable = samples
    .filter(
      (sample) => sample.averageScore !== null && sample.answerCount >= minAnswers,
    )
    .sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0));

  const skippedCount = samples.length - usable.length;

  if (usable.length === 0) {
    return { cohort: [], studentCount: 0, skippedCount, classAverage: null };
  }

  const classAverage =
    usable.reduce((total, sample) => total + (sample.averageScore ?? 0), 0) /
    usable.length;

  const dilimler = splitIntoBuckets(usable, Math.min(size, usable.length));
  const sonDilim = dilimler.length - 1;

  const cohort = dilimler.map((dilim, index): CohortMember => {
    const ortalama =
      dilim.reduce((total, sample) => total + (sample.averageScore ?? 0), 0) / dilim.length;
    const blankRate =
      dilim.reduce((total, sample) => total + sample.blankRate, 0) / dilim.length;

    const ability = clamp01(ortalama / 100);
    const subjectAbility = averageSubjectAbility(dilim);
    const group: ProfileGroup =
      dilimler.length === 1
        ? "notr"
        : index === 0
          ? "alt"
          : index === sonDilim
            ? "ust"
            : "notr";

    return {
      weight: dilim.length,
      profile: createProfile({
        id: `dilim-${index + 1}`,
        label: bucketLabel(index, dilimler.length, ortalama),
        summary: `${dilim.length} öğrenciyi temsil ediyor · geçmiş ortalaması %${Math.round(ortalama)}`,
        ability,
        // Bos birakma dikkatin gozlenebilir izi: cok bos birakan ogrenci ya
        // zaman yetistiremiyor ya da soruyu okumadan geciyor.
        diligence: clamp01(1 - blankRate),
        group,
        ...(Object.keys(subjectAbility).length > 0 ? { subjectAbility } : {}),
      }),
    };
  });

  return {
    cohort,
    studentCount: usable.length,
    skippedCount,
    classAverage: Math.round(classAverage * 10) / 10,
  };
}

/** Sirali diziyi olabildigince esit `count` dilime boler. */
function splitIntoBuckets<T>(items: readonly T[], count: number): T[][] {
  const buckets: T[][] = [];
  const base = Math.floor(items.length / count);
  const fazla = items.length % count;

  let cursor = 0;
  for (let index = 0; index < count; index += 1) {
    // Bolunemeyen ogrenciler ilk dilimlere birer birer dagitilir; boylece
    // dilim boyutlari en fazla bir kisi farkla esit kalir.
    const boyut = base + (index < fazla ? 1 : 0);
    buckets.push(items.slice(cursor, cursor + boyut));
    cursor += boyut;
  }

  return buckets.filter((bucket) => bucket.length > 0);
}

/** Dilimdeki ogrencilerin ders ortalamalarini 0-1 yetkinlige cevirir. */
function averageSubjectAbility(
  bucket: readonly StudentPerformanceSample[],
): Record<string, number> {
  const toplam = new Map<string, { sum: number; count: number }>();

  for (const sample of bucket) {
    for (const [subject, score] of Object.entries(sample.bySubject)) {
      const entry = toplam.get(subject) ?? { sum: 0, count: 0 };
      entry.sum += score;
      entry.count += 1;
      toplam.set(subject, entry);
    }
  }

  const result: Record<string, number> = {};
  for (const [subject, entry] of toplam) {
    result[subject] = clamp01(entry.sum / entry.count / 100);
  }
  return result;
}

function bucketLabel(index: number, total: number, ortalama: number): string {
  const yuzde = Math.round(100 / total);
  const puan = `ort. %${Math.round(ortalama)}`;

  if (total === 1) return `Sınıf ortalaması (${puan})`;
  if (index === 0) return `En alt %${yuzde} (${puan})`;
  if (index === total - 1) return `En üst %${yuzde} (${puan})`;
  return `${index + 1}. dilim (${puan})`;
}
