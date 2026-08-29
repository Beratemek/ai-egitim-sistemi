/**
 * SANAL SINIF - soru kalitesini ogrenciye ULASMADAN once olcen katman.
 *
 * Problem: bir soru "iyi mi" sorusunun cevabi ancak ogrenciler cozdukten
 * sonra ortaya cikar. Klasik olcme-degerlendirmede buna PILOT UYGULAMA denir
 * ve madde analizi (p degeri, ayirt edicilik, celdirici dagilimi) oradan
 * hesaplanir. Ama pilot uygulama gercek ogrenci, gercek zaman ister; bir
 * kazanim icin bes soru ureten icerik uzmani bunu asla yapamaz.
 *
 * Bu modul pilot uygulamayi SIMULE eder: farkli bilissel profillerdeki
 * ogrenci agent'lari soruyu -CEVAP ANAHTARINI GORMEDEN- cozer, sonra ayni
 * madde analizi metrikleri onlarin cevaplarindan hesaplanir.
 *
 * IKI PARCA, BILEREK AYRI:
 *   - Bu dosya SAF: persona tanimlari + metrik/bulgu hesabi. Ag cagrisi yok,
 *     dolayisiyla birim testi yazilabiliyor (tests/student-agents.test.ts).
 *   - Model cagrilari `lib/ai.ts` icindeki `runVirtualClass()`de. Projedeki
 *     tum AI cagrilari orada toplaniyor: mock modu, anahtar cozumu ve hata
 *     cevirisi tek yerde kalsin diye.
 *
 * KRITIK TASARIM KARARI - CEVAP ANAHTARI MODELE VERILMEZ.
 * Verilseydi "guclu ogrenci" personasi anahtari kopyalar, p degeri her soruda
 * 1.0 cikardi ve olcum hicbir sey soylemezdi. Anahtar yalnizca BURADA,
 * cevaplar geldikten SONRA karsilastirmaya girer. Bu yuzden "guclu
 * ogrencinin yanlis yapmasi" gercek bir sinyaldir: ya cevap anahtari
 * hatalidir ya da soru belirsizdir.
 *
 * Metrikler `lib/question-analytics.ts` ile AYNI kavramlari kullaniyor
 * (p degeri, ayirt edicilik, celdirici dagilimi). Boylece soru gercek sinavda
 * kullanildiginda simulasyon tahmini ile gercek sonuc yan yana konabiliyor.
 */

import { normalizeOptionKey } from "./answer-normalization.ts";
import type { GeneratedQuestion, QuestionDifficulty } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Personalar                                                                */
/* -------------------------------------------------------------------------- */

export const STUDENT_PERSONA_IDS = [
  "guclu",
  "ortalama",
  "zorlanan",
  "yanilgili",
  "aceleci",
] as const;

export type StudentPersonaId = (typeof STUDENT_PERSONA_IDS)[number];

/**
 * Ayirt edicilik hesabindaki grup.
 *
 * Klasik madde analizinde sinif basariya gore ust %27 / alt %27 diye ikiye
 * bolunur ve iki grubun dogru oranlari cikarilir. Burada grup personanin
 * TANIMINDAN geliyor: kimin "ust" kimin "alt" oldugunu simulasyon degil biz
 * biliyoruz. `notr` grup hesaba girmez - aceleci ogrenci bilgi duzeyini degil
 * DIKKATI olcer, ayirt edicilige karistirilirsa metrigi bozar.
 */
export type PersonaGroup = "ust" | "alt" | "notr";

export interface StudentPersona {
  id: StudentPersonaId;
  /** Arayuzde gorunen ad. */
  label: string;
  /** Persona kartinin altindaki tek cumlelik aciklama. */
  summary: string;
  group: PersonaGroup;
  /** Modele verilen karakter tanimi. */
  brief: string;
}

export const STUDENT_PERSONAS: readonly StudentPersona[] = [
  {
    id: "guclu",
    label: "Güçlü öğrenci",
    summary: "Kazanımı tam öğrenmiş; bu öğrenci yanılıyorsa soruda sorun var.",
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
    group: "notr",
    brief:
      "Konuyu bilen ama sinavda aceleci davranan bir ogrenci. Soru kokunu hizli " +
      "okur; 'degildir', 'yanlistir', 'hangisi olamaz' gibi olumsuz kaliplari " +
      "atlayabilir ve ilk makul secenege atlar. Ifade muglak ya da tuzakliysa hata " +
      "yapar; ifade netse dogru cevabi verir.",
  },
];

export function personaById(id: StudentPersonaId): StudentPersona {
  const persona = STUDENT_PERSONAS.find((item) => item.id === id);
  if (!persona) throw new Error(`[sanal-sinif] Bilinmeyen persona: ${id}`);
  return persona;
}

/* -------------------------------------------------------------------------- */
/*  Simulasyon ciktilari (modelin doldurdugu sekiller)                        */
/* -------------------------------------------------------------------------- */

/** Tek bir ogrenci agent'inin soruya verdigi cevap. */
export interface StudentAgentAnswer {
  personaId: StudentPersonaId;
  /** Test sorusunda sik anahtari ("B"), acik ucluda kisa cevap metni. */
  answer: string;
  /** Ogrencinin kendi eminlik duzeyi, 0-100. */
  confidence: number;
  /** Bu cevaba nasil vardigi - bir iki cumle. */
  reasoning: string;
  /** Ogrenci soruyu belirsiz ya da eksik buldu mu? */
  ambiguous: boolean;
  /** Belirsizligin nesi oldugu; `ambiguous` false ise null. */
  ambiguityNote: string | null;
}

/**
 * "Test kurnazi" sondasi - soruyu KONUYU BILMEDEN cozmeye calisir.
 *
 * Ayri bir model cagrisi olmak zorunda: ayni cagrida sorulsaydi model soruyu
 * zaten guclu ogrenci olarak cozmus olurdu ve buradaki tahmin onun kopyasi
 * cikardi. Bu sonda yalnizca soru kokunu ve sikleri gorur; ders, konu ve
 * kazanim verilmez.
 *
 * Amac sorunun BICIMSEL ipucu sizdirip sizdirmadigini olcmek. En uzun sik,
 * dilbilgisi uyumu, "hepsi/hicbiri", asiri kesin ifadeler ("asla", "her
 * zaman") gibi kaliplar konuyu bilmeyen ogrencinin dogru cevabi bulmasini
 * saglar; boyle bir soru artik bilgiyi degil sinav teknigini olcuyordur.
 */
export interface CueLeakProbe {
  /** Bicimsel ipuclarina bakarak yapilan tahmin. */
  guess: string;
  confidence: number;
  /** Dayanilan bicimsel ipucu; boyle bir ipucu yoksa null. */
  cue: string | null;
}

/** Acik uclu soruda bir personanin cevabinin rubrige gore puani. */
export interface PersonaRubricScore {
  personaId: StudentPersonaId;
  /** 0-100. */
  score: number;
  comment: string;
}

/* -------------------------------------------------------------------------- */
/*  Rapor                                                                     */
/* -------------------------------------------------------------------------- */

export const VIRTUAL_CLASS_THRESHOLDS = {
  /** p degeri bunun ustundeyse soru cok kolay: herkes dogru bildi. */
  cokKolayP: 0.95,
  /** p degeri bunun altindaysa soru cok zor: guclu ogrenci bile bilemedi. */
  cokZorP: 0.25,
  /** Ayirt edicilik bunun altindaysa madde sinifi ayristirmiyor. */
  dusukAyirtEdicilik: 0.25,
  /** Ayirt edicilik bunun altindaysa madde TERS calisiyor - agir bulgu. */
  tersAyirtEdicilik: 0,
  /** Bu kadar persona belirsizlik isaretlerse ifade sorunu vardir. */
  belirsizlikEsigi: 2,
  /** Kurnaz sonda bu guvenin uzerinde tutturduysa ipucu sizmis sayilir. */
  ipucuGuvenEsigi: 60,
  /** Bir celdiriciyi bu kadar ogrenci secerse celdirici asiri cekicidir. */
  asiriCekiciSecim: 3,
  /** Acik ucluda ust ve alt grup ortalamasi en az bu kadar ayrismalidir. */
  rubrikAyrismaEsigi: 15,
} as const;

export const QUALITY_FINDING_CODES = [
  "cevap_anahtari_supheli",
  "ipucu_sizintisi",
  "belirsiz_ifade",
  "ters_ayirt_edicilik",
  "dusuk_ayirt_edicilik",
  "cok_kolay",
  "cok_zor",
  "zorluk_uyusmazligi",
  "olu_celdirici",
  "asiri_cekici_celdirici",
  "rubrik_ayirt_etmiyor",
] as const;

export type QualityFindingCode = (typeof QUALITY_FINDING_CODES)[number];

export type FindingSeverity = "yuksek" | "orta" | "dusuk";

export interface QualityFinding {
  code: QualityFindingCode;
  severity: FindingSeverity;
  /** Panelde satir basligi olarak gorunen kisa ad. */
  title: string;
  /** Bulgunun KANITI: hangi ogrenci ne yapti. */
  detail: string;
  /**
   * Otomatik onarimda modele verilecek talimat parcasi.
   *
   * Bulgular dogrudan `reviseQuestion()` talimatina cevriliyor; boylece
   * "tespit -> duzeltme" dongusu insan yazmadan kapaniyor.
   */
  repairInstruction: string;
}

/** Bir sikkin sanal sinifta ne kadar tercih edildigi. */
export interface OptionUptake {
  key: string;
  text: string;
  count: number;
  /** 0-1. */
  rate: number;
  correct: boolean;
  personaIds: StudentPersonaId[];
}

export type VirtualClassVerdict = "hazir" | "gozden_gecir" | "revizyon";

export interface VirtualClassReport {
  /** Soru tipi - rapor okunurken sik metrikleri var mi belli olsun diye. */
  questionType: GeneratedQuestion["type"];
  /**
   * p degeri (madde guclugu): dogru cevaplayanlarin orani, 0-1.
   * Acik ucluda rubrik puanlarinin ortalamasinin yuzdeligi.
   */
  pDegeri: number | null;
  /**
   * Ayirt edicilik: ust grup basarisi - alt grup basarisi, -1..1 arasi.
   * Pozitif ve yuksek olmasi istenir; negatif deger maddenin TERS
   * calistigini, yani konuyu bilen ogrenciyi cezalandirdigini gosterir.
   */
  ayirtEdicilik: number | null;
  /** Belirsizlik isaretleyen persona sayisi. */
  belirsizlikSayisi: number;
  /** Test sorusunda sik dagilimi; acik ucluda bos dizi. */
  siklar: OptionUptake[];
  /** Test sorusunda ipucu sondasi; acik ucluda null. */
  ipucuSondasi: (CueLeakProbe & { sizinti: boolean }) | null;
  /** Acik ucluda persona bazinda rubrik puani; testte null. */
  rubrikPuanlari: PersonaRubricScore[] | null;
  cevaplar: StudentAgentAnswer[];
  bulgular: QualityFinding[];
  /** 0-100; bulgularin agirlikli cezasi 100'den dusulerek bulunur. */
  kaliteSkoru: number;
  verdict: VirtualClassVerdict;
}

/* -------------------------------------------------------------------------- */
/*  Metrik hesabi                                                             */
/* -------------------------------------------------------------------------- */

/** Bulgu agirliklari - kalite skoru bunlardan hesaplanir. */
const SEVERITY_PENALTY: Readonly<Record<FindingSeverity, number>> = {
  yuksek: 30,
  orta: 15,
  dusuk: 5,
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Persona test sorusunu dogru cevaplamis mi? */
function isCorrect(answer: StudentAgentAnswer, correctKey: string): boolean {
  return normalizeOptionKey(answer.answer) === normalizeOptionKey(correctKey);
}

export interface VirtualClassInput {
  question: GeneratedQuestion;
  answers: readonly StudentAgentAnswer[];
  /** Test sorusunda ipucu sondasi; acik uclu soruda null. */
  cueProbe: CueLeakProbe | null;
  /** Acik ucluda persona cevaplarinin rubrik puanlari; testte null. */
  rubricScores: readonly PersonaRubricScore[] | null;
}

/**
 * Simulasyon ciktilarindan madde analizi raporu uretir.
 *
 * SAF FONKSIYON: ayni girdi her zaman ayni raporu verir. Model cagrisi burada
 * degil, bu sayede esik degisikligi ya da yeni bir bulgu kurali kota
 * harcamadan test edilebiliyor.
 */
export function buildVirtualClassReport(input: VirtualClassInput): VirtualClassReport {
  const { question, answers, cueProbe, rubricScores } = input;
  const isTest = question.type === "test";

  const basari = successByPersona(question, answers, rubricScores);
  const pDegeri = mean([...basari.values()]);
  const ayirtEdicilik = discrimination(basari);

  const siklar = isTest ? optionUptake(question, answers) : [];
  const ipucuSondasi = buildProbeVerdict(question, cueProbe);
  const belirsizlikSayisi = answers.filter((answer) => answer.ambiguous).length;

  const bulgular = collectFindings({
    question,
    answers,
    basari,
    pDegeri,
    ayirtEdicilik,
    siklar,
    ipucuSondasi,
    belirsizlikSayisi,
    rubricScores,
  });

  const ceza = bulgular.reduce(
    (total, finding) => total + SEVERITY_PENALTY[finding.severity],
    0,
  );
  const kaliteSkoru = Math.max(0, Math.min(100, 100 - ceza));

  return {
    questionType: question.type,
    pDegeri: pDegeri === null ? null : round(pDegeri),
    ayirtEdicilik: ayirtEdicilik === null ? null : round(ayirtEdicilik),
    belirsizlikSayisi,
    siklar,
    ipucuSondasi,
    rubrikPuanlari: rubricScores ? [...rubricScores] : null,
    cevaplar: [...answers],
    bulgular,
    kaliteSkoru,
    verdict:
      kaliteSkoru >= 80 ? "hazir" : kaliteSkoru >= 60 ? "gozden_gecir" : "revizyon",
  };
}

/**
 * Persona -> basari (0-1) haritasi.
 *
 * Test sorusunda basari ikili (dogru/yanlis), acik ucluda rubrik puaninin
 * yuzdeligi. Ikisi ayni olcege indirildigi icin p degeri ve ayirt edicilik
 * her iki soru tipinde AYNI formulle hesaplanabiliyor.
 */
function successByPersona(
  question: GeneratedQuestion,
  answers: readonly StudentAgentAnswer[],
  rubricScores: readonly PersonaRubricScore[] | null,
): Map<StudentPersonaId, number> {
  const result = new Map<StudentPersonaId, number>();

  if (question.type === "test") {
    const key = question.correct_answer;
    if (!key) return result;
    for (const answer of answers) {
      result.set(answer.personaId, isCorrect(answer, key) ? 1 : 0);
    }
    return result;
  }

  for (const score of rubricScores ?? []) {
    result.set(score.personaId, Math.max(0, Math.min(100, score.score)) / 100);
  }
  return result;
}

/** Ust grup ortalamasi eksi alt grup ortalamasi. `notr` personalar disarida. */
function discrimination(basari: ReadonlyMap<StudentPersonaId, number>): number | null {
  const ust: number[] = [];
  const alt: number[] = [];

  for (const [personaId, value] of basari) {
    const group = personaById(personaId).group;
    if (group === "ust") ust.push(value);
    else if (group === "alt") alt.push(value);
  }

  const ustOrtalama = mean(ust);
  const altOrtalama = mean(alt);
  if (ustOrtalama === null || altOrtalama === null) return null;

  return ustOrtalama - altOrtalama;
}

/** Siklarin kac ogrenci tarafindan secildigi. */
function optionUptake(
  question: GeneratedQuestion,
  answers: readonly StudentAgentAnswer[],
): OptionUptake[] {
  const options = question.options ?? [];
  if (options.length === 0) return [];

  const secenler = new Map<string, StudentPersonaId[]>();
  for (const answer of answers) {
    const key = normalizeOptionKey(answer.answer);
    const list = secenler.get(key);
    if (list) list.push(answer.personaId);
    else secenler.set(key, [answer.personaId]);
  }

  const correctKey = question.correct_answer
    ? normalizeOptionKey(question.correct_answer)
    : null;

  return options.map((option) => {
    const key = normalizeOptionKey(option.key);
    const personaIds = secenler.get(key) ?? [];
    return {
      key: option.key,
      text: option.text,
      count: personaIds.length,
      rate: answers.length > 0 ? round(personaIds.length / answers.length) : 0,
      correct: correctKey !== null && key === correctKey,
      personaIds,
    };
  });
}

/** Sondanin gercekten ipucu sizdirip sizdirmadigina karar verir. */
function buildProbeVerdict(
  question: GeneratedQuestion,
  cueProbe: CueLeakProbe | null,
): (CueLeakProbe & { sizinti: boolean }) | null {
  if (!cueProbe || question.type !== "test" || !question.correct_answer) return null;

  /*
    Sizinti icin UC sart birden aranir:
      1. tahmin dogru cevabi TUTTURMUS olacak,
      2. sonda kendinden EMIN olacak,
      3. dayandigi BICIMSEL IPUCUNU adiyla soyleyebilecek.

    Ucuncu sart onemli: model konuyu zaten biliyor ve "bilmiyormus gibi yap"
    talimatina ragmen dogru cevabi tutturabilir. Gerekce sart kosulmazsa her
    kolay soru "ipucu siziyor" diye isaretlenirdi. Adi konmus bir bicimsel
    ipucu (en uzun sik, dilbilgisi uyumu, "hepsi") ise gercekten duzeltilmesi
    gereken bir kusurdur.
  */
  const cue = cueProbe.cue?.trim() || null;
  const sizinti =
    cue !== null &&
    cueProbe.confidence >= VIRTUAL_CLASS_THRESHOLDS.ipucuGuvenEsigi &&
    normalizeOptionKey(cueProbe.guess) === normalizeOptionKey(question.correct_answer);

  return { ...cueProbe, cue, sizinti };
}

/* -------------------------------------------------------------------------- */
/*  Bulgular                                                                  */
/* -------------------------------------------------------------------------- */

interface FindingContext {
  question: GeneratedQuestion;
  answers: readonly StudentAgentAnswer[];
  basari: ReadonlyMap<StudentPersonaId, number>;
  pDegeri: number | null;
  ayirtEdicilik: number | null;
  siklar: readonly OptionUptake[];
  ipucuSondasi: (CueLeakProbe & { sizinti: boolean }) | null;
  belirsizlikSayisi: number;
  rubricScores: readonly PersonaRubricScore[] | null;
}

function collectFindings(context: FindingContext): QualityFinding[] {
  const findings: QualityFinding[] = [
    ...keyErrorFinding(context),
    ...cueLeakFinding(context),
    ...ambiguityFinding(context),
    ...discriminationFindings(context),
    ...difficultyFindings(context),
    ...distractorFindings(context),
    ...rubricFinding(context),
  ];

  const order: Readonly<Record<FindingSeverity, number>> = {
    yuksek: 0,
    orta: 1,
    dusuk: 2,
  };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Cevap anahtari suphesi - raporun en degerli bulgusu.
 *
 * Guclu ogrenci kazanimi bilen ogrencidir; onun cevabi anahtardan farkliysa ya
 * anahtar yanlistir ya da soru birden fazla dogru cevaba aciktir. Ikisi de
 * ogrenciye ulasmadan yakalanmasi gereken hatalardir: yayina cikarsa itiraza,
 * puan iptaline ve guven kaybina yol acar.
 */
function keyErrorFinding(context: FindingContext): QualityFinding[] {
  const { question, answers, basari } = context;
  if (question.type !== "test" || !question.correct_answer) return [];

  const guclu = answers.find((answer) => answer.personaId === "guclu");
  if (!guclu || basari.get("guclu") !== 0) return [];

  const ortalamaDaYanlis = basari.get("ortalama") === 0;
  const secilen = normalizeOptionKey(guclu.answer);

  /*
    Sinyalin gucu iki sarta bagli: guclu ogrenci EMIN miydi ve ortalama
    ogrenci de ayni yone mi gitti. Ikisinden biri varsa yuksek oncelik.
  */
  const severity: FindingSeverity =
    guclu.confidence >= 70 || ortalamaDaYanlis ? "yuksek" : "orta";

  return [
    {
      code: "cevap_anahtari_supheli",
      severity,
      title: "Cevap anahtarı şüpheli",
      detail:
        `Kazanımı bilen öğrenci ${secilen} şıkkını seçti (güven %${Math.round(guclu.confidence)}), ` +
        `anahtar ise ${normalizeOptionKey(question.correct_answer)}. ` +
        (ortalamaDaYanlis ? "Ortalama öğrenci de anahtarı bulamadı. " : "") +
        `Gerekçesi: ${guclu.reasoning}`,
      repairInstruction:
        `Doğru cevabı yeniden denetle: güçlü bir öğrenci ${secilen} şıkkını savunulabilir buldu. ` +
        "Ya anahtarı düzelt ya da o şıkkı tek doğru olmaktan çıkaracak biçimde soru kökünü " +
        "netleştir. Geriye tek bir tartışmasız doğru cevap kalmalı.",
    },
  ];
}

function cueLeakFinding(context: FindingContext): QualityFinding[] {
  const { ipucuSondasi } = context;
  if (!ipucuSondasi?.sizinti) return [];

  return [
    {
      code: "ipucu_sizintisi",
      severity: "yuksek",
      title: "Şıklar ipucu sızdırıyor",
      detail:
        "Konuyu hiç bilmeyen bir öğrenci yalnızca şıkların biçimine bakarak doğru cevabı buldu. " +
        `Dayandığı ipucu: ${ipucuSondasi.cue}. Bu soru bilgiyi değil sınav tekniğini ölçüyor.`,
      repairInstruction:
        `Şıklardaki biçimsel ipucunu gider: ${ipucuSondasi.cue}. ` +
        "Tüm şıkları benzer uzunlukta, aynı dilbilgisi yapısında ve aynı ayrıntı düzeyinde yaz. " +
        "Doğru cevabı diğerlerinden ayıran tek şey İÇERİĞİ olmalı.",
    },
  ];
}

function ambiguityFinding(context: FindingContext): QualityFinding[] {
  const { answers, belirsizlikSayisi } = context;
  if (belirsizlikSayisi < VIRTUAL_CLASS_THRESHOLDS.belirsizlikEsigi) return [];

  const notlar = answers
    .filter((answer) => answer.ambiguous && answer.ambiguityNote)
    .map((answer) => `${personaById(answer.personaId).label}: ${answer.ambiguityNote}`);

  return [
    {
      code: "belirsiz_ifade",
      severity: belirsizlikSayisi >= 3 ? "yuksek" : "orta",
      title: "Soru ifadesi belirsiz",
      detail: `${belirsizlikSayisi} öğrenci soruyu belirsiz buldu. ${notlar.join(" | ")}`,
      repairInstruction:
        "Soru kökünü tek anlama gelecek biçimde yeniden yaz. Öğrencilerin işaret ettiği " +
        `belirsizlikler: ${notlar.join(" | ")}. Neyin sorulduğu ilk okuyuşta anlaşılmalı.`,
    },
  ];
}

function discriminationFindings(context: FindingContext): QualityFinding[] {
  const { ayirtEdicilik } = context;
  if (ayirtEdicilik === null) return [];

  if (ayirtEdicilik < VIRTUAL_CLASS_THRESHOLDS.tersAyirtEdicilik) {
    return [
      {
        code: "ters_ayirt_edicilik",
        severity: "yuksek",
        title: "Madde ters çalışıyor",
        detail:
          `Ayırt edicilik ${ayirtEdicilik.toFixed(2)}: konuyu bilmeyen öğrenciler bilenlerden ` +
          "daha başarılı oldu. Soru bilgiyi ödüllendirmiyor, cezalandırıyor.",
        repairInstruction:
          "Soru, konuyu bilen öğrenciyi cezalandırıyor. Olası sebepler: tuzak ifade, yanlış " +
          "anahtar ya da yalnızca yüzeysel okumayla doğru görünen bir şık. Soru kökünü " +
          "sadeleştir, tuzağı kaldır ve doğru cevabın kazanımı bilen öğrenci için açıkça doğru " +
          "olduğundan emin ol.",
      },
    ];
  }

  if (ayirtEdicilik < VIRTUAL_CLASS_THRESHOLDS.dusukAyirtEdicilik) {
    return [
      {
        code: "dusuk_ayirt_edicilik",
        severity: "orta",
        title: "Ayırt ediciliği düşük",
        detail:
          `Ayırt edicilik ${ayirtEdicilik.toFixed(2)}: konuyu bilen ve bilmeyen öğrenciler ` +
          "benzer sonuç verdi. Soru sınıfı ayrıştırmıyor.",
        repairInstruction:
          "Soru, konuyu bilenle bilmeyeni ayırmıyor. Kazanımın ayırt edici çekirdeğini hedef al: " +
          "yalnızca konuyu gerçekten anlayan öğrencinin geçebileceği tek bir adım ekle ve " +
          "çeldiricileri yaygın kavram yanılgılarından üret.",
      },
    ];
  }

  return [];
}

function difficultyFindings(context: FindingContext): QualityFinding[] {
  const { pDegeri, question } = context;
  if (pDegeri === null) return [];

  const findings: QualityFinding[] = [];

  if (pDegeri >= VIRTUAL_CLASS_THRESHOLDS.cokKolayP) {
    findings.push({
      code: "cok_kolay",
      severity: "orta",
      title: "Soru çok kolay",
      detail:
        "Zorlanan öğrenci dahil bütün profiller doğru cevapladı; soru hiçbir ayrım üretmiyor.",
      repairInstruction:
        "Soruyu bir bilişsel basamak yukarı taşı: doğrudan hatırlama yerine uygulama ya da " +
        "gerekçelendirme iste, çeldiricileri doğru cevaba yaklaştır.",
    });
  }

  if (pDegeri <= VIRTUAL_CLASS_THRESHOLDS.cokZorP) {
    findings.push({
      code: "cok_zor",
      severity: "orta",
      title: "Soru çok zor",
      detail:
        "Kazanımı bilen öğrenci bile zorlandı; soru kazanımın ötesini ölçüyor olabilir.",
      repairInstruction:
        "Soruyu kazanımın kapsamına geri çek: gereksiz işlem adımlarını azalt, soru kökündeki " +
        "verileri eksiksiz ver ve dili sadeleştir. Ölçülen kazanım değişmesin.",
    });
  }

  /*
    Beyan edilen zorluk ile olculen zorluk uyusuyor mu?

    Egitmen "zor soru uret" dedigi halde sanal sinifta herkes dogru
    cevapliyorsa havuzdaki `difficulty` etiketi yanlistir. Bu etiket sinav
    olustururken zorluk dengesi kurmak icin kullaniliyor; yanlis etiket tek bir
    soruyu degil butun sinavin dengesini bozar.
  */
  const beyan: QuestionDifficulty = question.difficulty;
  const olculen: QuestionDifficulty =
    pDegeri >= 0.8 ? "kolay" : pDegeri <= 0.4 ? "zor" : "orta";

  if (beyan !== olculen) {
    findings.push({
      code: "zorluk_uyusmazligi",
      severity: "dusuk",
      title: "Zorluk etiketi tutmuyor",
      detail:
        `Soru "${beyan}" olarak etiketlenmiş ama sanal sınıftaki başarı oranı ` +
        `%${Math.round(pDegeri * 100)} - bu "${olculen}" seviyeye karşılık geliyor.`,
      repairInstruction:
        `Sorunun ölçülen zorluğu "${olculen}" seviyesine denk geliyor ama "${beyan}" isteniyor. ` +
        `Soruyu "${beyan}" seviyesine taşı: ${
          beyan === "zor"
            ? "çeldiricileri doğru cevaba yaklaştır ve çok adımlı düşünme gerektir."
            : beyan === "kolay"
              ? "dili sadeleştir, tek adımda çözülebilir hale getir ve çeldiricileri belirginleştir."
              : "ne doğrudan hatırlamayla ne de uzun işlemle çözülsün; tek adımlı uygulama iste."
        }`,
    });
  }

  return findings;
}

function distractorFindings(context: FindingContext): QualityFinding[] {
  const { question, siklar } = context;
  if (question.type !== "test" || siklar.length === 0) return [];

  const findings: QualityFinding[] = [];
  const oluCeldiriciler = siklar.filter(
    (option) => !option.correct && option.count === 0,
  );

  /*
    Butun celdiricilerin olu olmasi ile birinin olu olmasi ayni sey degil:
    hicbir celdirici secilmediyse soru fiilen dogru/yanlis sorusuna donusmus
    demektir, tek bir olu celdirici ise yalnizca o sikkin zayif oldugunu
    gosterir.
  */
  if (oluCeldiriciler.length > 0) {
    const hepsiOlu = oluCeldiriciler.length === siklar.length - 1;
    const anahtarlar = oluCeldiriciler.map((option) => option.key).join(", ");

    findings.push({
      code: "olu_celdirici",
      severity: hepsiOlu ? "orta" : "dusuk",
      title: hepsiOlu ? "Çeldiricilerin tamamı işlevsiz" : "İşlevsiz çeldirici var",
      detail:
        `${anahtarlar} şıkkını hiçbir öğrenci makul bulmadı; bu şıklar soruyu ` +
        "kolaylaştırmaktan başka iş görmüyor.",
      repairInstruction:
        `${anahtarlar} şıklarını yeniden yaz. Her çeldirici, konuda YAYGIN bir kavram ` +
        "yanılgısının sonucu olmalı ve o yanılgıyı taşıyan öğrenciye doğru görünmeli. " +
        "Doğru cevap değişmesin.",
    });
  }

  const asiriCekici = siklar.find(
    (option) =>
      !option.correct && option.count >= VIRTUAL_CLASS_THRESHOLDS.asiriCekiciSecim,
  );

  if (asiriCekici) {
    findings.push({
      code: "asiri_cekici_celdirici",
      severity: "orta",
      title: "Çeldirici doğru cevaptan güçlü",
      detail:
        `${asiriCekici.key} şıkkını ${asiriCekici.count} öğrenci seçti. Bir çeldiricinin doğru ` +
        "cevaptan daha çok tercih edilmesi, ya o şıkkın da savunulabilir olduğunu ya da soru " +
        "kökünün yanlış yönlendirdiğini gösterir.",
      repairInstruction:
        `${asiriCekici.key} şıkkı doğru cevaptan daha çekici. Soru kökünü, bu şıkkı açıkça ` +
        "eleyecek ayrımı içerecek biçimde netleştir; şık hâlâ savunulabilir kalıyorsa şıkkı değiştir.",
    });
  }

  return findings;
}

function rubricFinding(context: FindingContext): QualityFinding[] {
  const { question, rubricScores } = context;
  if (question.type !== "acik_uclu" || !rubricScores || rubricScores.length === 0) {
    return [];
  }

  const ust = mean(
    rubricScores
      .filter((score) => personaById(score.personaId).group === "ust")
      .map((score) => score.score),
  );
  const alt = mean(
    rubricScores
      .filter((score) => personaById(score.personaId).group === "alt")
      .map((score) => score.score),
  );

  if (ust === null || alt === null) return [];
  if (ust - alt >= VIRTUAL_CLASS_THRESHOLDS.rubrikAyrismaEsigi) return [];

  return [
    {
      code: "rubrik_ayirt_etmiyor",
      severity: "orta",
      title: "Rubrik ayrıştırmıyor",
      detail:
        `Güçlü öğrenciler ortalama ${Math.round(ust)}, zorlanan öğrenciler ${Math.round(alt)} ` +
        "puan aldı. Aradaki fark, rubriğin bilen ile bilmeyeni ayırt edecek kadar keskin " +
        "olmadığını gösteriyor.",
      repairInstruction:
        "Rubriği ayrıştırıcı hale getir: her maddeye gözlenebilir bir ölçüt yaz (ne yazılırsa " +
        "tam, ne yazılırsa yarım puan), yüzeysel cevabın alabileceği puanı düşür ve puanların " +
        "toplamı 100 kalsın.",
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Otomatik onarim                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Bulgulari tek bir revizyon talimatina cevirir.
 *
 * `reviseQuestion()` serbest metin talimat aliyor; sanal sinifin ciktisini
 * dogrudan oraya baglamak "tespit -> duzeltme" dongusunu insan yazmadan
 * kapatiyor. Yalnizca yuksek ve orta oncelikli bulgular giriyor: dusuk
 * oncelikli bir uyari icin soruyu bastan yazdirmak, calisan bir taslagi bozma
 * riski tasir.
 */
export function buildRepairInstruction(report: VirtualClassReport): string | null {
  const onemli = report.bulgular.filter((finding) => finding.severity !== "dusuk");
  const secilen = onemli.length > 0 ? onemli : report.bulgular;
  if (secilen.length === 0) return null;

  return [
    "Bu soru, cevap anahtarını görmeyen simüle öğrencilerle pilot uygulamadan geçirildi.",
    "Aşağıdaki bulguların TAMAMINI gider; ölçülen kazanım ve soru tipi değişmesin.",
    ...secilen.map((finding, index) => `${index + 1}. ${finding.repairInstruction}`),
  ].join("\n");
}
