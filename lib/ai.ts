/**
 * Yapay zeka servisi.
 *
 * Iki temel yetenek sunar:
 *   - generateQuestions(context, kazanim, options) -> soru taslaklari (JSON)
 *   - gradeAnswer(studentAnswer, rubric, options)  -> puan + gerekce (JSON)
 *
 * Cikti sekli Zod semalari ile zorunlu kilinir (`generateObject`), boylece
 * "JSON parse edilemedi" hatalari yerine dogrulanmis nesneler doner.
 *
 * Saglayici, anahtar ve model CALISMA ANINDA cozulur (`resolveAiConfig`):
 * once sistem yoneticisinin panelden girdigi ayar, o yoksa `.env`. Anahtar
 * hicbir yerde yoksa -ya da panelde simulasyon isaretliyse- gercek bir API
 * cagrisi yapilmadan deterministik sahte veri dondurulur.
 *
 * Bu modul yalnizca sunucu tarafinda calistirilmalidir (API route / server action).
 */

import { generateObject, type LanguageModelV1 } from "ai";
import { z } from "zod";

import { createAiModel } from "@/lib/ai-model";
import type { AiProvider } from "@/lib/ai-providers";
import { resolveAiConfig, resolveAiConfigFor } from "@/lib/ai-settings";
import { normalizeOptionKey } from "@/lib/answer-normalization";
import {
  buildVirtualClassReport,
  type CueLeakProbe,
  type ProfileRubricScore,
  type StudentAgentAnswer,
  type VirtualClassReport,
} from "@/lib/student-agents";
import {
  buildExamSimulationReport,
  type ExamSimulationReport,
  type SimulatedAnswer,
  type SimulationQuestion,
} from "@/lib/exam-simulation";
import {
  findProfile,
  PRESET_PROFILES,
  type CohortMember,
  type StudentProfile,
} from "@/lib/student-profiles";
import { parseVisual, type QuestionVisual } from "@/lib/visual";
import { searchWikimediaImages } from "@/lib/visual-search";
import type {
  DifficultyChoice,
  GeneratedQuestion,
  GradingResult,
  QuestionType,
  StyleGuide,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Saglayici hatalarini okunabilir hale getirme                              */
/* -------------------------------------------------------------------------- */

/** Kota hatasinin govdesinde gecen "retryDelay": "36s" degerini yakalar. */
const RETRY_DELAY = /retryDelay["\s:]+(\d+(?:\.\d+)?)s/i;

/**
 * Model saglayicisinin ham hatasini kullanicinin anlayacagi bir mesaja cevirir.
 *
 * Ozellikle kota hatasi onemli: Gemini'nin ucretsiz katmani gunluk sabit bir
 * istek hakki verir ve doldugunda uzun ingilizce bir govde doner. Kullanici
 * "ne yapmali" bilgisini goremeden kaliyordu.
 */
export function describeAiError(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : String(caught);

  const isQuota =
    /quota|RESOURCE_EXHAUSTED|rate.?limit|429/i.test(raw) &&
    !/invalid|not found/i.test(raw);

  if (isQuota) {
    const match = RETRY_DELAY.exec(raw);
    const seconds = match ? Math.ceil(Number(match[1])) : null;
    const when = seconds
      ? `Yaklasik ${seconds} saniye sonra tekrar deneyebilirsiniz.`
      : "Bir sure sonra tekrar deneyebilirsiniz.";

    return (
      `Yapay zeka saglayicisinin kota siniri doldu. ${when} ` +
      "Ucretsiz katmanda gunluk istek hakki sinirlidir; faturalandirmayi " +
      "acarak, baska bir saglayiciya gecerek ya da Sistem > API Anahtarlari " +
      "ekranindan simulasyon modunu acarak calismaya devam edebilirsiniz."
    );
  }

  if (/API key|API_KEY_INVALID|unauthenticated|401|403/i.test(raw)) {
    return (
      "Yapay zeka anahtari gecersiz ya da yetkisiz. Sistem yoneticisi " +
      "Sistem > API Anahtarlari ekranindan anahtari kontrol edip yeniden " +
      "kaydetmeli."
    );
  }

  if (/model|not found|404/i.test(raw)) {
    return (
      "Secilen model bulunamadi. Sistem > API Anahtarlari ekranindaki model " +
      "adlarini kontrol edin; saglayici o modeli kapatmis olabilir."
    );
  }

  return raw;
}

/* -------------------------------------------------------------------------- */
/*  Semalar                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Gorsel semasi.
 *
 * Ayrik birlesim (discriminated union) yerine TEK BIR nesne kullaniliyor ve
 * alanlar kosullu doldurulmasi istenerek tarif ediliyor. Sebep: Gemini'nin
 * yapilandirilmis cikti kipi `anyOf` semalarini guvenilir sekilde
 * karsilamiyor; birlesim verildiginde cagri sema hatasiyla dusuyor. Tek
 * nesne + `nullable` alanlar ayni bilgiyi tasiyor ve `parseVisual()` zaten
 * bicimi dogruluyor.
 *
 * DORT TUR VE ARALARINDAKI KRITIK AYRIM - SORUNUN CEVABINI BELIRLEYIP
 * BELIRLEMEDIGI:
 *
 *   - "chart" / "svg": gorseldeki SAYI ya da OLCU dogru cevabi belirliyor
 *     (bir grafikteki yuzdeler, bir ucgenin kenar uzunluklari). Bu ikisini
 *     MODEL URETIR - resim cizmez, yalnizca veri (chart) ya da vektor komut
 *     (svg) yazar; cizimi kod yapar. Boylece "3-4-5 ucgeni" deyip 3-4-6
 *     cizme hatasi imkansiz.
 *
 *   - "referans": gorsel sadece GERCEK BIR VARLIGI/ESERI gosterir ve
 *     cevaba etki ETMEZ (or. "Mona Lisa tablosu", bir tarihi figurun
 *     fotografi, bir bitki turu). Bu turde model resim URETMEZ; yalnizca
 *     Wikimedia'da aranacak terimi yazar (`referenceQuery`), sunucu o
 *     terimle GERCEK bir fotograf bulup lisansiyla ekler. AKSI YONE
 *     KARISTIRMAK ONEMLI: cevabi belirleyen bir gorsel icin "referans"
 *     kullanilirsa Wikimedia'dan gelen fotografin sayilari/olculeri
 *     sorunun beklentisiyle hicbir zaman GARANTI uyusmaz.
 *
 *   - "yok": gorsel gerekmiyor.
 */
const questionVisualSchema = z.object({
  kind: z
    .enum(["chart", "svg", "referans", "yok"])
    .describe(
      'Gorsel gerekmiyorsa "yok". Cevabi SAYI/OLCU belirliyorsa "chart" ya da ' +
        '"svg" kullan (herhangi ders - jeoloji, spor bilimi, muzik de dahil, ' +
        'ornek listesine tam uymasa bile). Gorsel GERCEK DUNYADA VAR OLAN ' +
        'somut bir seyi (eser, harita, mineral, tur, alet - SINIRLI DEGIL) ' +
        'TANITIYORSA ve cevaba etki ETMIYORSA "referans" kullan - bu durumda ' +
        "sayi/olcu UYDURMA, gercek bir fotograf aranacak.",
    ),
  title: z.string().nullable().describe("Gorselin kisa basligi; yoksa null."),
  chartType: z
    .enum(["bar", "line", "pie"])
    .nullable()
    .describe('kind="chart" ise grafik tipi; degilse null.'),
  xKey: z
    .string()
    .nullable()
    .describe('kind="chart" ise yatay eksendeki alan adi (or. "yil"); degilse null.'),
  series: z
    .array(
      z.object({
        key: z.string().describe("data satirlarindaki alan adi."),
        label: z.string().describe("Efsanede gorunecek ad."),
      }),
    )
    .nullable()
    .describe('kind="chart" ise cizilecek seriler; degilse null.'),
  dataJson: z
    .string()
    .nullable()
    .describe(
      'kind="chart" ise veri satirlari JSON dizisi olarak (or. \'[{"yil":"2020","uretim":12}]\'); degilse null.',
    ),
  svg: z
    .string()
    .nullable()
    .describe(
      'kind="svg" ise gecerli bir <svg viewBox="..."> icerigi. Script, olay ozelligi ve dis kaynak KULLANMA; yalnizca sekil, cizgi ve metin. Degilse null.',
    ),
  referenceQuery: z
    .string()
    .nullable()
    .describe(
      'kind="referans" ise Wikimedia Commons\'ta aranacak terim - varligin ' +
        'ozgun/Ingilizce adi tercih edilir (or. "Mona Lisa painting Louvre", ' +
        '"DNA double helix structure"). Degilse null.',
    ),
});

const questionOptionSchema = z.object({
  key: z.string().describe('Sik anahtari: "A", "B", "C" veya "D".'),
  text: z.string().describe("Sikkin metni."),
});

const generatedQuestionSchema = z.object({
  topic: z.string().describe("Sorunun konusu."),
  text: z.string().describe("Soru koku. Tek bir soru cumlesi."),
  type: z
    .enum(["test", "acik_uclu"])
    .describe('Soru tipi: coktan secmeli icin "test", yazili icin "acik_uclu".'),
  options: z
    .array(questionOptionSchema)
    .nullable()
    .describe('type="test" ise 4 şık; type="acik_uclu" ise null.'),
  correct_answer: z
    .string()
    .nullable()
    .describe('type="test" ise dogru sikkin key degeri; degilse null.'),
  rubric: z
    .string()
    .nullable()
    .describe(
      'type="acik_uclu" ise puanlama rubrigi (madde madde, toplam 100 puan); degilse null.',
    ),
  difficulty: z.enum(["kolay", "orta", "zor"]).describe("Tahmini zorluk seviyesi."),
  visual: questionVisualSchema
    .nullable()
    .describe("Soruya eklenecek gorsel. Gerekmiyorsa null ya da kind=\"yok\"."),
});

const generateQuestionsSchema = z.object({
  questions: z.array(generatedQuestionSchema).describe("Uretilen soru taslaklari."),
});

const gradingResultSchema = z.object({
  score: z.number().min(0).max(100).describe("0-100 arasi toplam puan."),
  feedback: z
    .string()
    .describe("Ogrenciye yonelik, yapici ve kisa gerekce (2-4 cumle)."),
  criteria: z
    .array(
      z.object({
        criterion: z.string().describe("Rubrik maddesinin adi."),
        earned: z.number().describe("Bu maddeden alinan puan."),
        max: z.number().describe("Bu maddenin tam puani."),
        comment: z.string().describe("Puanin kisa gerekcesi."),
      }),
    )
    .describe("Rubrik maddesi bazinda kirilim."),
});

const mistakeCoachSchema = z.object({
  conceptSummary: z
    .string()
    .describe("Kazanımı yeniden kuran, öğrenciye doğrudan hitap eden 2-4 cümle."),
  likelyMisconception: z
    .string()
    .describe("Kesin tanı iddiası taşımayan kısa olası yanılgı açıklaması."),
  studySteps: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe("Öğrencinin hemen uygulayabileceği iki veya üç kısa çalışma adımı."),
  practiceQuestion: z
    .string()
    .describe("Orijinal soruyu kopyalamayan, aynı kazanımı çalıştıran tek yeni soru."),
  hint: z
    .string()
    .describe("Alıştırmanın cevabını vermeyen, düşünme yönü sunan tek ipucu."),
});

export interface MistakeCoachInput {
  subject: string;
  topic: string;
  outcomeText?: string | null;
  questionText: string;
  questionType: QuestionType;
  studentAnswer: string;
  approvedScore: number;
  instructorNote?: string | null;
}

export type MistakeCoachResult = z.infer<typeof mistakeCoachSchema>;

const examAiReviewSchema = z.object({
  summary: z
    .string()
    .describe("Sınavın ölçme kalitesini özetleyen, 3-5 cümlelik dengeli değerlendirme."),
  strengths: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe("Sınavda korunması gereken güçlü yönler."),
  risks: z
    .array(
      z.object({
        severity: z.enum(["yuksek", "orta", "dusuk"]),
        title: z.string(),
        explanation: z.string(),
        recommendation: z.string(),
        questionNumbers: z.array(z.number().int().positive()).max(12),
      }),
    )
    .max(8)
    .describe("Belirsizlik, bilişsel seviye, kapsam ve ifade kalitesi riskleri."),
  revisionPriorities: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Eğitmenin yayından önce uygulayacağı öncelikli revizyon sırası."),
});

export interface ExamAiReviewQuestion {
  position: number;
  points: number;
  text: string;
  type: QuestionType;
  options: Array<{ key: string; text: string }> | null;
  correctAnswer: string | null;
  rubric: string | null;
  difficulty: string | null;
  outcomeText: string | null;
  subject: string;
  topic: string;
}

export interface ExamAiReviewInput {
  title: string;
  description: string;
  subject: string;
  durationMinutes: number | null;
  questions: readonly ExamAiReviewQuestion[];
}

export type ExamAiReviewResult = z.infer<typeof examAiReviewSchema>;

/* -------------------------------------------------------------------------- */
/*  generateQuestions                                                         */
/* -------------------------------------------------------------------------- */

export interface GenerateQuestionsOptions {
  /** Uretilecek soru adedi. Varsayilan: 5 */
  count?: number;
  /** Istenen soru tipi. "karisik" ise model her ikisini de uretir. */
  type?: QuestionType | "karisik";
  /** Konu basligi. Verilmezse model kazanimdan cikarir. */
  topic?: string;
  /**
   * Talep edilen zorluk seviyesi.
   *
   * Brief'in 2. maddesi seviyeyi EGITMENIN tanimlamasini istiyor. Onceden
   * yalnizca modelin kendi tahmini (`difficulty` alani) vardi; istenen bir
   * seviye yoktu, dolayisiyla "zor soru uret" denemiyordu.
   */
  difficulty?: DifficultyChoice;
  /**
   * Icerik uzmaninin gecmis begeni/red kayitlari. Modele few-shot ornek olarak
   * verilir: begenilenler taklit edilecek tarz, reddedilenler kacinilacak tarz.
   */
  styleGuide?: StyleGuide;
  /**
   * Bu uretim icin kullanilacak model.
   *
   * Verilmezse sistem yoneticisinin panelde sectigi varsayilan model
   * kullanilir. Icerik uzmani uretim formundan bunu ezebilir: kisa bir kazanim
   * icin ucuz, zor bir konu icin guclu model secmek maliyeti ciddi degistirir.
   * Yalnizca ANAHTARIN ERISEBILDIGI modeller sunulur (bkz. ai-model-catalog).
   */
  modelId?: string;
  /**
   * Modelin ait oldugu saglayici.
   *
   * Verilirse O saglayicinin anahtariyla cagrilir; anahtari yoksa istek
   * reddedilir. Sessizce varsayilan saglayiciya dusmek, kullanicinin sectigi
   * modelden baska bir modelle (ve baska bir faturayla) uretim yapmak olurdu.
   */
  providerId?: AiProvider;
}

/** Istenen zorluk seviyesinin modele verilecek talimati. */
const DIFFICULTY_INSTRUCTIONS: Record<DifficultyChoice, string> = {
  kolay:
    "ZORLUK: Tum sorular KOLAY olsun - dogrudan hatirlama ve tanima olcsun, " +
    "celdiriciler acikca ayrilabilsin.",
  orta:
    "ZORLUK: Tum sorular ORTA olsun - kavrama ve tek adimli uygulama olcsun, " +
    "celdiriciler makul ama ayirt edilebilir olsun.",
  zor:
    "ZORLUK: Tum sorular ZOR olsun - analiz, cok adimli uygulama ya da " +
    "karsilastirma olcsun, celdiriciler yaygin kavram yanilgilarindan uretilsin.",
  karisik:
    "ZORLUK: Kolay, orta ve zor sorulari dengeli dagit; her sorunun " +
    "`difficulty` alanini gercek seviyesine gore doldur.",
};

/**
 * Gorsel talimati.
 *
 * TEK BIR talimat var, secim YOK: model her soruda gorsele ihtiyac olup
 * olmadigina VE turune KENDISI karar verir.
 *
 * ILK SURUM (tek ornekli: "yuzde grafigi") HER SEFERINDE AYNI bar grafigine
 * dusuyordu. IKINCI SURUM (subject-by-subject ornek listesi: sanat, enerji,
 * matematik, cografya...) BIRAZ DAHA IYI oldu ama ayni hatanin baska bir
 * bicimiydi: model, karsilastigi konu (or. jeoloji/mineraloji) LISTEDEKI
 * ORNEKLERIN HICBIRINE tam benzemeyince gorseli tumden atlayip "yok" diyordu.
 * Sorun ornek sayisi degil, YAPI: sonlu bir ornek listesi HERHANGI bir
 * derste (jeoloji, spor bilimi, ekonomi, muzik...) er ya da gec tukenir.
 *
 * BU SURUM once ILKEYI (cevaba etki eden sey SAYI mi, SEKIL mi, yoksa
 * GERCEK DUNYADAKI somut bir sey mi) ders adindan BAGIMSIZ tarif ediyor;
 * ornekler yalnizca ILKEYI SOMUTLASTIRMAK icin var ve acikca "bunlarla
 * SINIRLI DEGIL" diye isaretleniyor. Amac: model yeni bir derste "bu tam
 * ornek listesindeki gibi degil" diye TEREDDUT ETMESIN, ayni MANTIGI kendi
 * basina uygulasin.
 */
const VISUAL_INSTRUCTION =
  "GORSEL: Sen bir soru bankasi editorusun. Hangi ders olursa olsun AYNI " +
  "ILKEYI uygula: gorsel SORUNUN CEVABINA hizmet ediyorsa ekle, suslemek " +
  'icin EKLEME. Gerekmiyorsa visual.kind = "yok" bırak. Asagidaki uc arac ' +
  "ORNEKLERLE anlatiliyor ama ORNEKLER SINIRLAYICI DEGIL - karsina hic " +
  "gormedigin bir ders/konu gelse bile (jeoloji, spor bilimi, muzik, " +
  "ekonomi, ne olursa olsun) AYNI MANTIGI SEN UYGULA, ornek listesine tam " +
  "uymadigi icin gorseli ATLAMA:\n" +
  "\n" +
  '1) "chart" - CEVABI SAYISAL BIR VERI belirliyor: yuzde/istatistik, ' +
  "nufus artisi, reaksiyon hizi, mesafe-zaman, sicaklik-yukseklik - HANGI " +
  "DERSTE olursa olsun herhangi bir (x,y) iliskisi buraya girer. MATEMATIK " +
  "FONKSIYONU DA BURAYA GIRER: y=f(x) turunden bir fonksiyonu birkac x " +
  "degeri icin SEN HESAPLA (or. y=x^2 icin x=-3,-2,-1,0,1,2,3), sonuc " +
  '(x,y) ciftlerini "line" grafigine ver - parabol, dogrusal fonksiyon, ' +
  "trigonometrik egri boyle gorsellestirilir.\n" +
  "\n" +
  '2) "svg" - CEVABI BIR SEKIL, YAPI ya da DUZEN belirliyor: geometri ' +
  "(ucgen/aci/cember, olculer ETIKETLI), devre semasi, sayi dogrusu, " +
  "koordinat duzleminde isaretli nokta/sekil, basit kesit ya da diyagram " +
  "(hucre, kayac dongusu, besin zinciri oku), zaman cizelgesi (yatay cizgi " +
  "uzerinde tarihli isaretler), akis semasi, Venn semasi - BUNLARLA SINIRLI " +
  "DEGIL, herhangi bir uzamsal/yapisal iliskiyi SEN CIZ. SADE ciz: viewBox " +
  'tanimla, renk yerine stroke="currentColor" kullan ki tema degisince ' +
  "okunur kalsin.\n" +
  "\n" +
  '3) "referans" - GERCEK DUNYADA VAR OLAN somut bir sey GORULMESI/' +
  "TANINMASI gerekiyor ve gorsel CEVABA ETKI ETMIYOR: bir sanat eseri, " +
  "tarihi figur/olay fotografi, GERCEK BIR HARITA (cografyada fiziki/" +
  'siyasi/iklim haritasi - or. "Turkey physical map"), GERCEK BIR MINERAL/' +
  "KAYAC FOTOGRAFI, gercek bir hayvan/bitki turu, gercek bir alet/nesne, " +
  "mikroskop goruntusu - BUNLARLA SINIRLI DEGIL, somut ve GERCEKTEN VAR " +
  "OLAN her sey buraya girer. `referenceQuery` alanina Wikimedia'da " +
  "aranacak ozgun/Ingilizce adi yaz. GERCEK BIR NESNEYI/HARITAYI ASLA SVG " +
  "ILE CIZMEYE CALISMA: elle cizip yanlis yapma riski cok yuksektir; " +
  "gercek gorsel GERCEK arama ile bulunur, uydurulmaz.\n" +
  "\n" +
  "Ayni ders/konu ust uste gelse bile HEP AYNI TURU secme - soru farkli " +
  "bir seyi olcuyorsa gorsel de farkli olmali.";

/**
 * Tercih kayitlarini modele verilecek metne cevirir.
 *
 * Ornekler kisaltilir (soru koku + varsa uzmanin notu) - tam rubrik/secenek listesi
 * baglami sisirir ve tarz bilgisi zaten soru kokunde ve notta.
 */
function buildStyleGuidePrompt(styleGuide: StyleGuide | undefined): string {
  if (!styleGuide) return "";

  const format = (preference: StyleGuide["liked"][number]): string => {
    const parts = [
      `- [${preference.question_type === "test" ? "test" : "acik uclu"} / ${preference.difficulty}] ${preference.question_text}`,
    ];
    if (preference.note) parts.push(`  (uzman notu: ${preference.note})`);
    return parts.join("\n");
  };

  const sections: string[] = [];

  if (styleGuide.liked.length > 0) {
    sections.push(
      [
        "ICERIK UZMANININ BEGENDIGI SORULAR - bu tarzi ornek al:",
        styleGuide.liked.map(format).join("\n"),
      ].join("\n"),
    );
  }

  if (styleGuide.disliked.length > 0) {
    sections.push(
      [
        "ICERIK UZMANININ REDDETTIGI SORULAR - bu tarzdan kacin:",
        styleGuide.disliked.map(format).join("\n"),
      ].join("\n"),
    );
  }

  if (sections.length === 0) return "";

  /*
    Kapsam modele acikca yaziliyor. Ayni konudan gelen ornek, uzmanin TAM O
    konudaki tercihini gosterir; "genel" ornek yalnizca genel bir dil tonu
    isaretidir. Kapsami soylemek modelin ornege ne kadar yaklasacagini
    ayarlamasini sagliyor - aksi halde uzak bir dersin ornegini de birebir
    tarz emri sanabiliyor.
  */
  const scopeNote: Record<StyleGuide["scope"], string> = {
    konu: "Bu ornekler AYNI KONUDAN alindi - tarzi yakindan takip et.",
    ders: "Bu ornekler AYNI DERSTEN alindi - genel kurguyu takip et.",
    genel:
      "Bu ornekler BASKA derslerden alindi - yalnizca dil tonu ve bicim icin " +
      "referans al, konu kurgusunu bu derse uydur.",
  };

  return [
    "",
    "== TARZ REHBERI ==",
    scopeNote[styleGuide.scope],
    ...sections,
    "Bu ornekleri KOPYALAMA; yalnizca soru kurgusu, zorluk dengesi, celdirici",
    "mantigi ve dil tonu bakimindan ornek al. Yeni sorular ozgun olmali.",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Kaynaga atif yapan sorulari eleme                                         */
/* -------------------------------------------------------------------------- */

/**
 * Turkce metni ASCII'ye indirger.
 *
 * Desenleri tek bicimde yazabilmek icin: "Kitabın" -> "kitabin",
 * "MÜFREDAT" -> "mufredat". JS'in `i` bayragi Turkce'ye ozgu i/I ayrimini
 * dogru cevirmedigi icin donusum elle yapiliyor.
 */
function toAscii(value: string): string {
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
 * Soru, olculmesi gereken bilgiyi degil KAYNAGIN KENDISINI soruyorsa gecersizdir.
 *
 * Model, prompt'ta yasaklanan "kaynak metne gore" kalibini bulamayinca
 * "kitabin haftalik mufredatina gore ... kacinci haftada" gibi baska bir
 * atif kalibi uretebiliyor. Ogrenci sinavda ne metni ne mufredati gorecegi
 * icin bu tur sorular kullanilamaz; sadece rica etmek yetmiyor, cikti
 * dogrulanip eleniyor.
 */
const META_QUESTION_PATTERNS: readonly RegExp[] = [
  // Metne / parcaya / dokumana atif
  /(kaynak|verilen|yukaridaki|asagidaki)\s+metn/,
  /metinde\s+(belirtil|gecen|verilen|anlatil)/,
  /metne\s+gore/,
  /parca(ya|da)\s+gore/,
  /(kitabin|kitapta|kitapciktaki|mufredat|dokumanda|tabloya\s+gore|listeye\s+gore)/,
  // Sira / takvim sorulari: "kacinci haftada", "hangi unitede"
  /(kacinci|hangi)\s+(hafta|unite|modul|bolum|asama)/,
  /kac\s+(hafta|ay|saat|gun|ders)\s+(surer|surmekte|ayrilmis)/,
  // Idari / tanitim bilgisi
  /(ucretsiz\s+mi|kontenjan|basvuru\s+tarih|kac\s+ilde|hangi\s+illerde)/,
];

/** Soru kaynaga atif yapiyor mu? */
function looksLikeMetaQuestion(text: string): boolean {
  const ascii = toAscii(text);
  return META_QUESTION_PATTERNS.some((pattern) => pattern.test(ascii));
}

/**
 * Kaynak metin ve kazanimdan soru taslaklari uretir.
 *
 * Uretilen sorular iki asamadan gecer:
 *   1. `normalizeGeneratedQuestion` - veritabani kisitlarina uyum
 *   2. `looksLikeMetaQuestion` - kaynaga atif yapan sorular elenir
 * Eleme sonucu istenen adet tutmazsa BIR kez daha, daha kati bir uyariyla
 * eksik kadar soru istenir.
 *
 * @param context  Icerik uzmaninin yukledigi kaynak metin.
 * @param kazanim  Hedeflenen ogrenme kazanimi.
 */
export async function generateQuestions(
  context: string,
  kazanim: string,
  options: GenerateQuestionsOptions = {},
): Promise<GeneratedQuestion[]> {
  const {
    count = 5,
    type = "karisik",
    topic,
    styleGuide,
    difficulty = "karisik",
    modelId,
    providerId,
  } = options;

  if (!context.trim() || !kazanim.trim()) {
    throw new Error("[ai] generateQuestions: context ve kazanim bos olamaz.");
  }

  const ai = providerId
    ? await resolveAiConfigFor(providerId)
    : await resolveAiConfig();

  if (!ai) {
    throw new Error(
      `[ai] "${providerId}" saglayicisinin kayitli anahtari yok. Sistem > API Anahtarlari ekranindan tanimlayin.`,
    );
  }

  if (ai.mockMode) {
    return mockGenerateQuestions(kazanim, { count, type, topic, styleGuide });
  }

  const typeInstruction =
    type === "karisik"
      ? "Sorularin yaklasik yarisi coktan secmeli (test), yarisi acik uclu olsun."
      : type === "test"
        ? "Tüm sorular çoktan seçmeli (test) olsun; her birinde 4 şık bulunsun."
        : "Tum sorular acik uclu olsun; her biri icin ayrintili rubrik yaz.";

  /*
    Sistem talimati iki hatayi acikca yasakliyor:

      1. "Kaynak metne gore..." kalibi. Model "yalnizca kaynak metinden uret"
         talimatini metne ATIFTA BULUN diye anliyordu; oysa ogrenci sinavda o
         metni gormuyor ve soru havada kaliyor.
      2. Idari/tanitim bilgisi sormak. Yuklenen dosya cogu zaman brosur veya
         program kitapcigi oluyor; model "kurs kac ay surer", "ucretsiz mi"
         gibi konu disi bilgileri olcmeye kalkiyordu. Sinav KAZANIMI olcer.
  */
  const { object } = await generateObject({
    maxRetries: 0,
    model: createAiModel(ai, modelId || ai.modelGeneration),
    schema: generateQuestionsSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin ve Turkce sinav sorulari yazarsin.",
      "SORULAR KAZANIMI OLCER. Kaynak metin yalnizca bilgiyi dogrulamak icindir, sorunun konusu degildir.",
      "ASLA metne atifta bulunma: 'kaynak metne gore', 'metinde belirtildigi gibi', 'yukaridaki metne gore', 'parcaya gore' gibi ifadeleri KULLANMA.",
      "Ogrenci sinavda kaynak metni GORMEYECEK; soru kendi basina anlasilir ve cevaplanabilir olmalidir.",
      "Kurum tanitimi, program suresi, ucret, basvuru tarihi, sehir, kontenjan gibi IDARI bilgileri sorma; konunun kendisini sor (kavram, tanim, sebep-sonuc, islem, uygulama).",
      "Ezber yerine kavrama ve uygulama olc: neden olur, ne ise yarar, hangi durumda kullanilir gibi kurgular tercih et.",
      "Metinde kazanimla ilgili bilgi yoksa bilgi UYDURMA; metnin kazanima en yakin kismindan soru kur.",
      "Çoktan seçmeli sorularda 4 şık olur, çeldiriciler makul ve yakın olur, tek bir doğru cevap bulunur.",
      "Acik uclu sorularda rubrik madde madde yazilir ve maddelerin puan toplami 100 olur.",
      "Istekte TARZ REHBERI varsa, uzmanin begendigi kurguya yaklas ve reddettigi kaliplardan uzak dur.",
    ].join(" "),
    prompt: [
      `OLCULECEK KAZANIM:\n${kazanim}`,
      topic ? `KONU:\n${topic}` : "",
      `BILGI KAYNAGI (yalnizca dogrulama icin, soruda ona atif YAPMA):\n${context}`,
      `GOREV: Yukaridaki kazanimi olcen ${count} adet soru uret. ${typeInstruction}`,
      DIFFICULTY_INSTRUCTIONS[difficulty],
      VISUAL_INSTRUCTION,
      "HATIRLATMA: Her soru, kaynak metni hic gormemis bir ogrenci tarafindan okunup cevaplanabilmeli.",
      'HATIRLATMA: Gorseli olan soruda metin gorsele atifta bulunabilir ("grafige gore", "sekildeki"), cunku gorsel soruyla birlikte gosterilir. Gorseli OLMAYAN soruda hicbir seye atif yapma.',
      buildStyleGuidePrompt(styleGuide),
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const first = await collectUsable(object.questions, topic ?? kazanim);

  // Eleme sonucu adet tutuyorsa is bitti.
  if (first.length >= count) return first.slice(0, count);

  /*
    Elenen soru varsa BIR kez daha deniyoruz. Ikinci istekte hangi kalibin
    reddedildigi acikca yaziliyor; boylece model ayni hataya donmuyor.
    Tek tekrar ile sinirli: her deneme 20-40 saniye suruyor.
  */
  const missing = count - first.length;

  /*
    Eksik kalanlari tamamlamak icin IKINCI bir cagri yapilir. Bu cagri kota
    hatasi alirsa elimizdekini atmiyoruz: ilk turda uretilmis sorular gecerli,
    kullanicinin emegi bosa gitmemeli.
  */
  type GenerationResult = z.infer<typeof generateQuestionsSchema>;
  let retry: GenerationResult = { questions: [] };

  try {
    const result = await generateObject({
    maxRetries: 0,
    model: createAiModel(ai, modelId || ai.modelGeneration),
    schema: generateQuestionsSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin ve Turkce sinav sorulari yazarsin.",
      "Onceki denemede sorulari REDDEDILDI cunku kaynagin kendisini soruyordu.",
      "Sinav sorusu; kitap, mufredat, tablo, hafta sirasi, program suresi, ucret gibi",
      "seylere ATIFTA BULUNAMAZ. Ogrenci yalnizca soruyu gorur.",
      "Konunun kendisini sor: kavram, tanim, sebep-sonuc, islem adimi, uygulama.",
      "Çoktan seçmeli sorularda 4 şık olur, tek doğru cevap bulunur.",
      "Acik uclu sorularda rubrik madde madde yazilir, puan toplami 100 olur.",
    ].join(" "),
    prompt: [
      `OLCULECEK KAZANIM:\n${kazanim}`,
      topic ? `KONU:\n${topic}` : "",
      `BILGI KAYNAGI (yalnizca dogrulama icin, soruda ona atif YAPMA):\n${context}`,
      `GOREV: Kazanimi olcen ${missing} adet soru uret. ${typeInstruction}`,
      DIFFICULTY_INSTRUCTIONS[difficulty],
      VISUAL_INSTRUCTION,
      "YASAK KALIPLAR: 'kaynak metne gore', 'kitabin mufredatina gore', 'kacinci haftada', 'kac hafta surer', 'ucretsiz mi'.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

    retry = result.object;
  } catch (caught) {
    if (first.length === 0) throw caught;
    console.warn("[ai] Tamamlama cagrisi basarisiz:", describeAiError(caught));
  }

  const combined = [...first, ...(await collectUsable(retry.questions, topic ?? kazanim))];

  if (combined.length === 0) {
    throw new Error(
      "[ai] Uretilen sorularin tamami kaynaga atif yaptigi icin elendi. " +
        "Kaynak metin bir mufredat/tanitim dokumani olabilir; kazanimla ilgili " +
        "anlatim iceren bir bolum yukleyip tekrar deneyin.",
    );
  }

  return combined.slice(0, count);
}

/**
 * Duz sema ciktisini gercek gorsel nesnesine cevirir.
 *
 * Model sema geregi TEK bir nesne dolduruyor (bkz. questionVisualSchema);
 * burada tipine gore ayristiriliyor ve `parseVisual()` ile dogrulaniyor.
 * Gecersiz gorsel SORUYU DUSURMEZ - yalnizca gorsel atilir. Sebep: soru
 * metni cogu zaman kendi basina gecerlidir ve iyi bir taslagi bozuk bir
 * grafik yuzunden atmak kullanicinin emegini bosa harcar.
 *
 * ASENKRON: "referans" turu Wikimedia'ya bir ag istegi gerektiriyor (bkz.
 * lib/visual-search.ts). Arama sonuc bulamazsa ya da servis yanit vermezse
 * `searchWikimediaImages` bos dizi doner - bu fonksiyon da gorseli null
 * yapar, soruyu ETKILEMEZ.
 */
async function toQuestionVisual(
  raw: z.infer<typeof questionVisualSchema> | null | undefined,
): Promise<QuestionVisual | null> {
  if (!raw || raw.kind === "yok") return null;

  if (raw.kind === "referans") {
    if (!raw.referenceQuery) return null;
    const results = await searchWikimediaImages(raw.referenceQuery, 1);
    return results[0] ?? null;
  }

  if (raw.kind === "svg") {
    return parseVisual({
      kind: "svg",
      ...(raw.title ? { title: raw.title } : {}),
      svg: raw.svg,
    });
  }

  // Grafik verisi metin olarak isteniyor: ic ice serbest sekilli nesne
  // dizisini sema ile tarif etmek Gemini'de guvenilir degil. Cozulemeyen
  // JSON gorseli dusurur, soruyu dusurmez.
  let data: unknown;
  try {
    data = JSON.parse(raw.dataJson ?? "");
  } catch {
    return null;
  }

  return parseVisual({
    kind: "chart",
    chartType: raw.chartType,
    ...(raw.title ? { title: raw.title } : {}),
    xKey: raw.xKey,
    series: raw.series,
    data,
  });
}

/**
 * Model ciktisini normalize eder ve kaynaga atif yapanlari eler.
 *
 * Sorular PARALEL isleniyor (Promise.all): "referans" gorseli olan her soru
 * bir Wikimedia cagrisi gerektiriyor, sirali isleseydi N soru N kat gecikme
 * demek olurdu. Her sorunun normalizasyonu KENDI try/catch'inde - biri
 * basarisiz olursa digerlerini dusurmez.
 */
async function collectUsable(
  questions: z.infer<typeof generateQuestionsSchema>["questions"],
  fallbackTopic: string,
): Promise<GeneratedQuestion[]> {
  const normalized = await Promise.all(
    questions
      .filter((question) => !looksLikeMetaQuestion(question.text))
      .map(async (question) => {
        try {
          return await normalizeGeneratedQuestion(question, fallbackTopic);
        } catch {
          // Eksik uretilmis soru (secenek veya rubrik yok) sessizce atlanir;
          // cagiran katman eksik adedi tekrar isteyerek telafi eder.
          return null;
        }
      }),
  );

  return normalized.filter((item): item is GeneratedQuestion => item !== null);
}

/* -------------------------------------------------------------------------- */
/*  reviseQuestion                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Hazir revizyon istekleri.
 *
 * Icerik uzmani cogu zaman ayni dort seyi istiyor; her seferinde yazmasin
 * diye tek tikla gonderilen kalip talimatlar. Anahtarlar arayuzdeki
 * dugmelerle, degerler modele giden metinle eslesir.
 */
export const REVISION_PRESETS = {
  zorlastir:
    "Soruyu ZORLASTIR: daha ust bilissel seviyeye tasi (uygulama, analiz), " +
    "celdiricileri birbirine yaklastir ama tek dogru cevabi koru. Konu ayni kalsin.",
  kolaylastir:
    "Soruyu KOLAYLASTIR: dili sadelestir, tek adimda cevaplanabilir hale getir, " +
    "celdiricileri belirgin sekilde yanlis yap. Konu ayni kalsin.",
  kisalt:
    "Soru kokunu KISALT: gereksiz betimlemeleri at, tek cumleye indir. " +
    "Olculen bilgi ve secenekler ayni kalsin.",
  celdirici:
    "CELDIRICILERI GUCLENDIR: yanlis siklarin her biri yaygin bir kavram " +
    "yanilgisina karsilik gelsin ve makul gorunsun. Dogru cevap degismesin.",
} as const;

export type RevisionPreset = keyof typeof REVISION_PRESETS;

export function isRevisionPreset(value: unknown): value is RevisionPreset {
  return typeof value === "string" && value in REVISION_PRESETS;
}

export interface ReviseQuestionOptions {
  /** Sorunun olctugu kazanim; revizyonun hedefi degismesin diye gonderilir. */
  kazanim?: string;
  /** Kaynak metin. Verilirse model bilgi uydurmadan revize eder. */
  context?: string;
}

/**
 * Var olan bir soru taslagini icerik uzmaninin talimatina gore yeniden yazar.
 *
 * Uretimden farki: sifirdan soru uretmez, ELDEKI soruyu degistirir. Soru tipi
 * (test / acik uclu) ve olculen kazanim korunur; degisen sey zorluk, uzunluk
 * veya celdirici kalitesidir.
 *
 * Cikti uretimdeki ayni iki asamadan gecer: sema zorlamasi + kaynaga atif
 * yapan sorulari eleme.
 */
export async function reviseQuestion(
  question: GeneratedQuestion,
  instruction: string,
  options: ReviseQuestionOptions = {},
): Promise<GeneratedQuestion> {
  const trimmed = instruction.trim();
  if (!trimmed) {
    throw new Error("[ai] reviseQuestion: talimat bos olamaz.");
  }

  const ai = await resolveAiConfig();

  if (ai.mockMode) {
    return mockReviseQuestion(question, trimmed);
  }

  const { kazanim, context } = options;

  const shapeRule =
    question.type === "test"
      ? "Soru COKTAN SECMELI kalmali: 4 sik ve tek dogru cevap bulunmali, rubric null olmali."
      : "Soru ACIK UCLU kalmali: options ve correct_answer null, rubric madde madde ve toplami 100 puan olmali.";

  const { object } = await generateObject({
    maxRetries: 0,
    model: createAiModel(ai, ai.modelGeneration),
    schema: generatedQuestionSchema,
    system: [
      "Sen deneyimli bir olcme-degerlendirme uzmanisin.",
      "Sana VAR OLAN bir sinav sorusu ve uzmanin revizyon talimati verilir.",
      "Soruyu talimata gore yeniden yazarsin; sifirdan yeni bir soru URETMEZSIN.",
      "Sorunun tipi ve olctugu kazanim DEGISMEZ; yalnizca talimatta istenen ozellik degisir.",
      shapeRule,
      "ASLA kaynaga atifta bulunma: 'kaynak metne gore', 'kitaba gore', 'kacinci haftada' gibi ifadeler yasak.",
      "Ogrenci soruyu tek basina okuyup cevaplayabilmeli.",
      "Bilgi uydurma; verilen konunun disina cikma.",
    ].join(" "),
    prompt: [
      kazanim ? `OLCULEN KAZANIM:\n${kazanim}` : "",
      context ? `BILGI KAYNAGI (atif YAPMA):\n${context}` : "",
      `MEVCUT SORU:\n${JSON.stringify(
        {
          topic: question.topic,
          text: question.text,
          type: question.type,
          options: question.options,
          correct_answer: question.correct_answer,
          rubric: question.rubric,
          difficulty: question.difficulty,
        },
        null,
        2,
      )}`,
      `UZMANIN TALIMATI:\n${trimmed}`,
      "GOREV: Talimati uygulayarak sorunun revize edilmis halini dondur.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  if (looksLikeMetaQuestion(object.text)) {
    throw new Error(
      "[ai] Revize edilen soru kaynaga atif yaptigi icin reddedildi. Talimati biraz daha acik yazip tekrar deneyin.",
    );
  }

  return await normalizeGeneratedQuestion(object, question.topic);
}

/* -------------------------------------------------------------------------- */
/*  gradeAnswer                                                               */
/* -------------------------------------------------------------------------- */

export interface GradeAnswerOptions {
  /** Puanlanan sorunun metni - modele baglam saglar. */
  questionText?: string;
  /** Tam puan. Varsayilan: 100 */
  maxScore?: number;
}

/**
 * Ogrenci cevabini verilen rubrige gore puanlar.
 *
 * @param studentAnswer Ogrencinin acik uclu cevabi.
 * @param rubric        Sorunun puanlama rubrigi.
 */
export async function gradeAnswer(
  studentAnswer: string,
  rubric: string,
  options: GradeAnswerOptions = {},
): Promise<GradingResult> {
  const { questionText, maxScore = 100 } = options;

  if (!rubric.trim()) {
    throw new Error("[ai] gradeAnswer: rubric bos olamaz.");
  }

  // Bos cevap icin modele gitmeye gerek yok.
  if (!studentAnswer.trim()) {
    return {
      score: 0,
      feedback: "Cevap bos birakildigi icin puan verilemedi.",
      criteria: [],
    };
  }

  const ai = await resolveAiConfig();

  if (ai.mockMode) {
    return mockGradeAnswer(studentAnswer, rubric, maxScore);
  }

  const { object } = await generateObject({
    maxRetries: 0,
    model: createAiModel(ai, ai.modelGrading),
    schema: gradingResultSchema,
    system: [
      "Sen tarafsiz bir sinav degerlendiricisisin.",
      "Ogrenci cevabini YALNIZCA verilen rubrige gore puanlarsin.",
      "Yazim hatalari, uslup veya cevabin uzunlugu tek basina puan kirma sebebi degildir.",
      "Rubrikte olmayan bir kriter uydurma. Puanlarin toplami tam puani asmamalidir.",
      "Geri bildirim ogrenciye dogrudan hitap etsin, yapici ve kisa olsun.",
    ].join(" "),
    prompt: [
      questionText ? `SORU:\n${questionText}` : "",
      `RUBRIK (tam puan ${maxScore}):\n${rubric}`,
      `OGRENCI CEVABI:\n${studentAnswer}`,
      "GOREV: Cevabi rubrik maddeleri bazinda degerlendir, her madde icin alinan puani ve kisa gerekcesini yaz, sonra toplam puani belirle.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return normalizeGradingResult(object, maxScore);
}

/* -------------------------------------------------------------------------- */
/*  coachMistake                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Nihai sonucu açıklanmış düşük puanlı bir cevap için kısa çalışma üretir.
 *
 * Bu fonksiyon doğru cevap ya da rubrik almaz. Böylece çağıran katmanın gizli
 * değerlendirme anahtarını istemciye veya modele taşıması gerekmeksizin,
 * öğrencinin kendi cevabı ve ölçülen kazanım üzerinden öğretici destek verir.
 */
export async function coachMistake(
  input: MistakeCoachInput,
): Promise<MistakeCoachResult> {
  const normalized: MistakeCoachInput = {
    ...input,
    subject: input.subject.trim().slice(0, 120),
    topic: input.topic.trim().slice(0, 160),
    outcomeText: input.outcomeText?.trim().slice(0, 500) || null,
    questionText: input.questionText.trim().slice(0, 2_000),
    studentAnswer: input.studentAnswer.trim().slice(0, 2_000) || "Cevap verilmedi.",
    approvedScore: Math.min(100, Math.max(0, input.approvedScore)),
    instructorNote: input.instructorNote?.trim().slice(0, 1_000) || null,
  };

  if (!normalized.questionText) {
    throw new Error("[ai] coachMistake: soru metni bos olamaz.");
  }

  const ai = await resolveAiConfig();
  if (ai.mockMode) return mockCoachMistake(normalized);

  const { object } = await generateObject({
    maxRetries: 0,
    model: createAiModel(ai, ai.modelGeneration),
    schema: mistakeCoachSchema,
    system: [
      "Sen sabırlı ve ölçme-değerlendirme konusunda deneyimli bir öğrenme koçusun.",
      "Öğrencinin tamamladığı sınavdaki düşük puanlı cevabı, soruyu ve ölçülen kazanımı incelersin.",
      "Amaç resmi sorunun cevabını açıklamak değil, eksik kavramı kısa biçimde yeniden kurmak ve yeni bir alıştırmayla çalıştırmaktır.",
      "Yanılgıyı kesin tanı olarak sunma; 'olabilir', 'görünüyor' gibi ihtiyatlı dil kullan.",
      "Orijinal soruyu, seçeneklerini veya olası cevap anahtarını tekrar etme.",
      "Yeni alıştırmanın cevabını ve çözümünü verme; yalnızca ayrı bir ipucu üret.",
      "Türkçe, yaşa uygun, yargılamayan ve somut bir dil kullan.",
    ].join(" "),
    prompt: [
      `DERS: ${normalized.subject || "Belirtilmedi"}`,
      `KONU: ${normalized.topic || "Belirtilmedi"}`,
      normalized.outcomeText ? `KAZANIM: ${normalized.outcomeText}` : "",
      `SORU TÜRÜ: ${normalized.questionType === "test" ? "Çoktan seçmeli" : "Açık uçlu"}`,
      `SORU: ${normalized.questionText}`,
      `ÖĞRENCİNİN CEVABI: ${normalized.studentAnswer}`,
      `NİHAİ PUAN: ${normalized.approvedScore}/100`,
      normalized.instructorNote ? `EĞİTMEN NOTU: ${normalized.instructorNote}` : "",
      "GÖREV: Kısa kavram anlatımı, olası yanılgı, uygulanabilir çalışma adımları, yeni benzer alıştırma ve tek ipucu üret.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return {
    conceptSummary: object.conceptSummary.trim(),
    likelyMisconception: object.likelyMisconception.trim(),
    studySteps: object.studySteps.map((step) => step.trim()).filter(Boolean).slice(0, 3),
    practiceQuestion: object.practiceQuestion.trim(),
    hint: object.hint.trim(),
  };
}

/**
 * Öğrenci verisi içermeyen sınav taslağını pedagojik açıdan inceler.
 * Deterministik yayın engellerinin yerine geçmez; yalnızca insan kararını
 * destekleyen nitel öneriler üretir.
 */
export async function reviewExamQuality(
  input: ExamAiReviewInput,
): Promise<ExamAiReviewResult> {
  const normalized: ExamAiReviewInput = {
    title: input.title.trim().slice(0, 200),
    description: input.description.trim().slice(0, 1_000),
    subject: input.subject.trim().slice(0, 120),
    durationMinutes: input.durationMinutes,
    questions: input.questions.slice(0, 100).map((question) => ({
      ...question,
      text: question.text.trim().slice(0, 2_000),
      rubric: question.rubric?.trim().slice(0, 2_000) || null,
      outcomeText: question.outcomeText?.trim().slice(0, 600) || null,
      options: question.options?.slice(0, 8).map((option) => ({
        key: option.key.slice(0, 20),
        text: option.text.trim().slice(0, 500),
      })) ?? null,
    })),
  };

  const ai = await resolveAiConfig();
  if (ai.mockMode) return mockReviewExamQuality(normalized);

  const { object } = await generateObject({
    maxRetries: 0,
    model: createAiModel(ai, ai.modelGeneration),
    schema: examAiReviewSchema,
    system: [
      "Sen deneyimli bir ölçme-değerlendirme ve eğitim programları uzmanısın.",
      "Yayımlanmamış bir sınav taslağını öğrenci görmeden önce incelersin.",
      "Deterministik biçim kontrolleri başka bir katmanda yapılır; sen kapsam geçerliği, bilişsel çeşitlilik, ifade açıklığı, çeldirici niteliği, olası ipucu/yanlılık ve süre uyumuna odaklan.",
      "Sorunun doğru cevabını değiştirme veya yeni cevap anahtarı uydurma.",
      "Bir risk belirli sorularla ilgiliyse soru numaralarını ver; tüm sınava aitse boş liste kullan.",
      "Her öneriyi uygulanabilir ve kısa yaz. Kesin olmayan çıkarımları olasılık diliyle belirt.",
      "Türkçe yanıt ver.",
    ].join(" "),
    prompt: [
      `SINAV: ${normalized.title || "Başlıksız"}`,
      `DERS: ${normalized.subject || "Belirtilmedi"}`,
      normalized.description ? `AMAÇ/AÇIKLAMA: ${normalized.description}` : "",
      `SÜRE: ${normalized.durationMinutes ?? "Belirtilmedi"} dakika`,
      `SORULAR:\n${JSON.stringify(normalized.questions, null, 2)}`,
      "GÖREV: Güçlü yönleri koruyarak riskleri ve yayından önceki öncelikli revizyonları belirle.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return {
    summary: object.summary.trim(),
    strengths: object.strengths.map((item) => item.trim()).filter(Boolean).slice(0, 4),
    risks: object.risks.slice(0, 8).map((risk) => ({
      ...risk,
      title: risk.title.trim(),
      explanation: risk.explanation.trim(),
      recommendation: risk.recommendation.trim(),
      questionNumbers: [...new Set(risk.questionNumbers)].sort((a, b) => a - b),
    })),
    revisionPriorities: object.revisionPriorities
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5),
  };
}
/* -------------------------------------------------------------------------- */
/*  runVirtualClass - sanal sinif pilot uygulamasi                            */
/* -------------------------------------------------------------------------- */

/** 0-max araligina cekilmis, yuvarlanmis puan. */
function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

/*
  Profil kimligi sema tarafinda SERBEST METIN.

  Onceden sabit bes personanin kimligi `z.enum` ile zorlaniyordu. Kadro artik
  degisken - sinav kestiriminde profiller gercek siniftan turetiliyor ve
  kimlikleri onceden bilinmiyor. Dogrulama kod tarafinda yapiliyor: kadroda
  olmayan bir kimlik iceren cevap sessizce atiliyor (bkz.
  `normalizeCohortAnswers`).
*/
const studentCohortSchema = z.object({
  answers: z
    .array(
      z.object({
        profileId: z
          .string()
          .describe("Cevabi veren ogrenci profilinin kimligi; listede verilen deger."),
        answer: z
          .string()
          .describe(
            'Test sorusunda YALNIZCA sik anahtari ("A", "B", "C" ya da "D"); acik uclu ' +
              "soruda o ogrencinin gercekten yazacagi kisa cevap.",
          ),
        confidence: z
          .number()
          .min(0)
          .max(100)
          .describe("Ogrencinin bu cevaba duydugu guven, 0-100."),
        reasoning: z
          .string()
          .describe("Ogrencinin bu cevaba nasil vardigi; 1-2 cumle, ogrencinin agzindan."),
        ambiguous: z
          .boolean()
          .describe(
            "Ogrenci soruyu belirsiz, eksik ya da birden fazla dogru cevaba acik buldu mu?",
          ),
        ambiguityNote: z
          .string()
          .nullable()
          .describe("Belirsizligin nesi oldugu; ambiguous false ise null."),
      }),
    )
    .describe("Her ogrenci profili icin BIR cevap; profillerin tamami doldurulmali."),
});

const cueLeakSchema = z.object({
  guess: z.string().describe("Yalnizca bicimsel ipuclarina dayanan tahmin: sik anahtari."),
  confidence: z.number().min(0).max(100).describe("Bu tahmine duyulan guven, 0-100."),
  cue: z
    .string()
    .nullable()
    .describe(
      "Tahminin dayandigi BICIMSEL ipucu (or. 'dogru sik digerlerinden belirgin sekilde " +
        "uzun'). Boyle bir ipucu yoksa null - o durumda tahmin saf sanstir.",
    ),
});

const cohortRubricSchema = z.object({
  scores: z
    .array(
      z.object({
        profileId: z.string(),
        score: z.number().min(0).max(100).describe("Rubrige gore 0-100 arasi puan."),
        comment: z.string().describe("Puanin tek cumlelik gerekcesi."),
      }),
    )
    .describe("Her ogrenci cevabi icin bir puan."),
});

export interface VirtualClassOptions {
  /** Sorunun olctugu kazanim - ogrencilerin derste ogrendigi sey. */
  kazanim?: string;
  /** Ders adi; simulasyonun ton ve seviye ayarini yapmasina yarar. */
  subject?: string;
  /**
   * Olcumu yapacak kadro. Verilmezse sabit zit takim kullanilir.
   *
   * Soru kalitesi olcumunde bu takim BILEREK sabittir: sorular arasi
   * karsilastirma ancak ayni olcu aletiyle anlamli olur.
   */
  profiles?: readonly StudentProfile[];
  /** Bu pilot icin kullanilacak model. Verilmezse varsayilan model. */
  modelId?: string;
  /** Modelin saglayicisi; anahtari yoksa istek reddedilir. */
  providerId?: AiProvider;
}

/**
 * Soruyu sanal sinifta pilot uygulamaya sokar.
 *
 * UC CAGRI, IKISI PARALEL:
 *
 *   1. SINIF - kadrodaki profiller soruyu cozer. Tek cagri, cunku profillerin
 *      ayni soruyu ayni kosullarda gormesi gerekiyor ve bes ayri cagri hem
 *      bes bedelli hem bes kat yavas olurdu.
 *
 *   2. IPUCU SONDASI - konuyu bilmeyen bir ogrenci soruyu yalnizca siklarin
 *      bicimine bakarak cozmeye calisir. AYRI CAGRI OLMAK ZORUNDA: ayni
 *      cagrida sorulsaydi model soruyu zaten (1)'de cozmus olurdu ve buradaki
 *      "bilmeden tahmin" onun kopyasi cikardi. Ayri cagrida ders, konu ve
 *      kazanim hic verilmiyor.
 *
 *      (1) ve (2) birbirine bagimli degil, `Promise.all` ile paralel gider.
 *
 *   3. RUBRIK PUANLAMASI - yalnizca acik uclu soruda. Ogrencilerin yazdigi
 *      cevaplar rubrige gore puanlanir; (1)'in ciktisina bagimli oldugu icin
 *      sirali calisir. Test sorusunda bu cagri hic yapilmaz.
 *
 * Cevap anahtari ve rubrik (1) ve (2)'ye ASLA verilmez - bkz. lib/student-agents.ts.
 */
export async function runVirtualClass(
  question: GeneratedQuestion,
  options: VirtualClassOptions = {},
): Promise<VirtualClassReport> {
  const { kazanim, subject, modelId, providerId } = options;
  const profiles = options.profiles ?? PRESET_PROFILES;

  if (!question.text.trim()) {
    throw new Error("[ai] runVirtualClass: soru metni bos olamaz.");
  }

  const ai = providerId
    ? await resolveAiConfigFor(providerId)
    : await resolveAiConfig();

  if (!ai) {
    throw new Error(
      `[ai] "${providerId}" saglayicisinin kayitli anahtari yok. Sistem > API Anahtarlari ekranindan tanimlayin.`,
    );
  }

  if (ai.mockMode) return mockVirtualClass(question, profiles);

  const model = createAiModel(ai, modelId || ai.modelGeneration);
  const gorunenSoru = studentFacingQuestion(question);

  const cohortCall = generateObject({
    maxRetries: 0,
    model,
    schema: studentCohortSchema,
    system: [
      "Sen bir SINIF SIMULATORUSUN: bir sinav sorusunu farkli ogrenci profillerinin gozunden cozersin.",
      "SANA DOGRU CEVAP VERILMEDI. Soruyu gercekten cozmen gerekiyor.",
      "Her profil icin AYRI ve BAGIMSIZ bir cevap uret; profiller birbirinin cevabini gormez.",
      "Rol yapmiyorsun, taklit ediyorsun: profilin bilgi duzeyi hangi cevaba goturuyorsa onu yaz.",
      "Bilerek yanlis yapma; ama profil konuyu bilmiyorsa dogru cevabi da uydurma.",
      "Test sorusunda `answer` alanina YALNIZCA sik anahtarini yaz (A, B, C ya da D).",
      "Acik uclu soruda `answer` alanina o ogrencinin gercekten yazacagi cevabi yaz: guclu ogrenci ayrintili ve gerekceli, zorlanan ogrenci eksik ve yuzeysel yazar.",
      "Soru belirsizse, birden fazla secenek savunulabiliyorsa ya da veri eksikse `ambiguous` alanini true yap ve nedenini yaz - bu tespit sorunun duzeltilmesini saglar, cekinme.",
      "Turkce yanit ver.",
    ].join(" "),
    prompt: [
      subject ? `DERS: ${subject}` : "",
      kazanim
        ? `OGRENCILERIN DERSTE OGRENDIGI KAZANIM (soruda yazmaz, yalnizca seviye baglami): ${kazanim}`
        : "",
      `SORU TIPI: ${question.type === "test" ? "Coktan secmeli" : "Acik uclu"}`,
      `SORU (ogrencinin gordugu haliyle):\n${gorunenSoru}`,
      `OGRENCI PROFILLERI:\n${describeRoster(profiles)}`,
      `GOREV: Her profil icin bir cevap uret; toplam ${profiles.length} cevap olmali.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  /*
    Sonda yalnizca TEST sorusunda anlamli: acik uclu soruda secilecek sik yok,
    dolayisiyla bicimsel ipucu da yok. Gereksiz cagri yapmiyoruz.
  */
  const probeCall =
    question.type === "test"
      ? generateObject({
          maxRetries: 0,
          model,
          schema: cueLeakSchema,
          system: [
            "Sen bir sinav sorusunu KONUYU HIC BILMEDEN cozmeye calisan bir ogrencisin.",
            "Konu bilgin YOK; ders, konu ve kazanim da sana verilmedi.",
            "Yalnizca SIKLARIN BICIMINE bakarak tahmin yurutursun: en uzun ya da en ayrintili sik, digerlerinden farkli dilbilgisi yapisi, soru kokuyle kelime tekrari, 'hepsi'/'hicbiri' kaliplari, 'asla'/'her zaman' gibi asiri kesin ifadeler, tek basina digerlerinden ayrisan bir sik.",
            "Boyle bir bicimsel ipucu VARSA `cue` alanina adini yaz ve tahminini ona dayandir.",
            "Boyle bir ipucu YOKSA `cue` alanini null birak, rastgele bir sik sec ve guveni dusuk ver.",
            "IPUCU YOKKEN IPUCU UYDURMA: uydurulmus bir ipucu bu olcumun tamamini gecersiz kilar.",
            "Turkce yanit ver.",
          ].join(" "),
          prompt: [
            `SORU:\n${gorunenSoru}`,
            "GOREV: Yalnizca bicimsel ipuclarina bakarak bir sik sec.",
          ].join("\n\n"),
        })
      : null;

  const [cohort, probe] = await Promise.all([cohortCall, probeCall]);

  const answers = normalizeCohortAnswers(cohort.object.answers, question, profiles);

  const cueProbe: CueLeakProbe | null = probe
    ? {
        guess: probe.object.guess,
        confidence: clampScore(probe.object.confidence, 100),
        cue: probe.object.cue?.trim() || null,
      }
    : null;

  const rubricScores =
    question.type === "acik_uclu" && question.rubric
      ? await gradeCohortAnswers(model, question.rubric, question.text, answers)
      : null;

  return buildVirtualClassReport({
    question,
    profiles,
    answers,
    cueProbe,
    rubricScores,
  });
}

/** Kadroyu modele verilecek listeye cevirir. */
export function describeRoster(profiles: readonly StudentProfile[]): string {
  return profiles
    .map((profile) => `- ${profile.id} (${profile.label}): ${profile.brief}`)
    .join("\n");
}

/**
 * Soruyu ogrencinin gordugu bicime cevirir.
 *
 * Dogru cevap ve rubrik BU METNE GIRMEZ. Gorsel ise metne cevrilir: simule
 * ogrenci grafigi ya da cizimi goremez, ama verisini okuyabilir. Gorsel
 * atlanirsa grafige dayanan sorularda butun profiller "veri eksik" der ve
 * olcum anlamini yitirir.
 */
export function studentFacingQuestion(question: GeneratedQuestion): string {
  const parts = [question.text];

  const visual = describeVisualForStudent(question.visual);
  if (visual) parts.push(visual);

  if (question.type === "test") {
    parts.push(
      (question.options ?? [])
        .map((option) => `${option.key}) ${option.text}`)
        .join("\n"),
    );
  }

  return parts.join("\n\n");
}

/** Gorseli, simule ogrencinin okuyabilecegi metne cevirir. */
function describeVisualForStudent(visual: QuestionVisual | null): string | null {
  if (!visual) return null;

  if (visual.kind === "chart") {
    return [
      `[SORUDAKI GORSEL - ${visual.chartType} grafigi${visual.title ? `: ${visual.title}` : ""}]`,
      `Yatay eksen: ${visual.xKey}.`,
      `Seriler: ${visual.series.map((series) => series.label).join(", ")}.`,
      `Veri: ${JSON.stringify(visual.data)}`,
    ].join(" ");
  }

  if (visual.kind === "svg") {
    // Cizimin kaynagi veriliyor: etiketler ve olculer metin olarak okunabilsin.
    return `[SORUDAKI GORSEL - cizim${visual.title ? `: ${visual.title}` : ""}]\n${visual.svg.slice(0, 1_500)}`;
  }

  return `[SORUDAKI GORSEL - fotograf] ${visual.alt}`;
}

/**
 * Model ciktisini rapor katmaninin bekledigi bicime getirir.
 *
 * Uc sey garanti ediliyor: cevabin KADRODAKI bir profile ait olmasi, her
 * profilden EN COK bir cevap (model bazen ayni profil icin iki satir uretiyor)
 * ve test sorusunda `answer` alaninin sik anahtarina indirgenmesi
 * ("B) Sifir" -> "B").
 */
function normalizeCohortAnswers(
  raw: z.infer<typeof studentCohortSchema>["answers"],
  question: GeneratedQuestion,
  profiles: readonly StudentProfile[],
): StudentAgentAnswer[] {
  const seen = new Set<string>();
  const answers: StudentAgentAnswer[] = [];

  for (const item of raw) {
    const profileId = item.profileId.trim();
    if (seen.has(profileId)) continue;
    if (!findProfile(profiles, profileId)) continue;
    seen.add(profileId);

    answers.push({
      profileId,
      answer:
        question.type === "test"
          ? normalizeOptionKey(item.answer)
          : item.answer.trim(),
      confidence: clampScore(item.confidence, 100),
      reasoning: item.reasoning.trim(),
      ambiguous: item.ambiguous,
      ambiguityNote: item.ambiguous ? item.ambiguityNote?.trim() || null : null,
    });
  }

  return answers;
}

/**
 * Acik uclu cevaplari rubrige gore TEK cagride puanlar.
 *
 * `gradeAnswer()` her cevap icin ayri cagri yapardi; bes ogrenci icin bes
 * cagri hem pahali hem yavas. Burada onemli olan mutlak puan degil ust ve alt
 * grubun AYRISIP ayrismadigi, bu da tek cagrida guvenilir sekilde olculuyor.
 */
export async function gradeCohortAnswers(
  model: LanguageModelV1,
  rubric: string,
  questionText: string,
  /*
    En dar sekil: yalnizca "kim, ne yazdi". `StudentAgentAnswer` bu sekli zaten
    karsiliyor, sinav kestirimi de ayni fonksiyonu kendi cevap tipiyle
    cagirabiliyor - iki ayri puanlama yolu tutmaya gerek kalmiyor.
  */
  answers: readonly { profileId: string; answer: string }[],
): Promise<ProfileRubricScore[]> {
  if (answers.length === 0) return [];

  const { object } = await generateObject({
    maxRetries: 0,
    model,
    schema: cohortRubricSchema,
    system: [
      "Sen tarafsiz bir sinav degerlendiricisisin.",
      "Sana bir soru, rubrigi ve ayni soruya verilmis birden fazla ogrenci cevabi verilir.",
      "Her cevabi YALNIZCA rubrige gore, digerlerinden bagimsiz puanlarsin.",
      "Cevaplarin kime ait oldugu puani etkilemez; yalnizca yazilana bak.",
      "Rubrikte olmayan kriter uydurma; puan 0-100 arasinda kalsin.",
    ].join(" "),
    prompt: [
      `SORU:\n${questionText}`,
      `RUBRIK (tam puan 100):\n${rubric}`,
      `OGRENCI CEVAPLARI:\n${answers
        .map((answer) => `[${answer.profileId}] ${answer.answer}`)
        .join("\n\n")}`,
      "GOREV: Her cevabi rubrige gore puanla ve tek cumlelik gerekce yaz.",
    ].join("\n\n"),
  });

  const seen = new Set<string>();
  const scores: ProfileRubricScore[] = [];

  for (const item of object.scores) {
    const profileId = item.profileId.trim();
    if (seen.has(profileId)) continue;
    seen.add(profileId);
    scores.push({
      profileId,
      score: clampScore(item.score, 100),
      comment: item.comment.trim(),
    });
  }

  return scores;
}

/**
 * Mock modda sanal sinif.
 *
 * Deterministik ve GERCEKCI: kadronun yetkinlik siralamasina gore ust yaridaki
 * profiller dogru, alt yaridakiler farkli celdiricilere gider. Boylece anahtar
 * olmadan acilan demoda p degeri, ayirt edicilik ve celdirici dagilimi anlamli
 * gorunur - hepsi dogru ya da hepsi yanlis olsaydi panel bos bir kabuk olurdu.
 */
function mockVirtualClass(
  question: GeneratedQuestion,
  profiles: readonly StudentProfile[],
): VirtualClassReport {
  const options = question.options ?? [];
  const correctKey = question.correct_answer
    ? normalizeOptionKey(question.correct_answer)
    : "A";
  const yanlisSiklar = options
    .map((option) => normalizeOptionKey(option.key))
    .filter((key) => key !== correctKey);

  const answers: StudentAgentAnswer[] = profiles.map((profile, index) => {
    // Yetkinlik esigi: 0,6 ustu profiller dogru bilir. Sabit bir esik yeterli,
    // cunku burada amac gercekci bir DAGILIM gostermek.
    const dogru = profile.ability >= 0.6;
    const yanlisSik = yanlisSiklar[index % Math.max(1, yanlisSiklar.length)] ?? correctKey;

    return {
      profileId: profile.id,
      answer:
        question.type === "test"
          ? dogru
            ? correctKey
            : yanlisSik
          : `[MOCK] ${profile.label} profilinin cevabi.`,
      confidence: Math.round(40 + profile.ability * 55),
      reasoning: dogru
        ? "[MOCK] Kazanimi hatirlayip secenekleri eledim."
        : "[MOCK] Konuyu tam bilmedigim icin en makul gorduguma gittim.",
      ambiguous: profile.diligence < 0.4,
      ambiguityNote:
        profile.diligence < 0.4
          ? "[MOCK] Soru kokunde neyin istendigi bana net gelmedi."
          : null,
    };
  });

  const rubricScores: ProfileRubricScore[] | null =
    question.type === "acik_uclu"
      ? profiles.map((profile) => ({
          profileId: profile.id,
          score: Math.round(25 + profile.ability * 65),
          comment: "[MOCK] Rubrik maddelerine kismi deginme.",
        }))
      : null;

  return buildVirtualClassReport({
    question,
    profiles,
    answers,
    cueProbe:
      question.type === "test"
        ? { guess: yanlisSiklar[0] ?? correctKey, confidence: 25, cue: null }
        : null,
    rubricScores,
  });
}


/* -------------------------------------------------------------------------- */
/*  simulateExam - sinav kestirimi                                            */
/* -------------------------------------------------------------------------- */

/**
 * Bir cagrida sorulacak soru sayisi.
 *
 * Butun sinavi tek istekte sormak cazip ama uzun ciktida model kayiyor: son
 * sorularda gerekce kisaliyor, bazen sorular atlaniyor. Ona parcalar halinde
 * sinav vermek hem ciktiyi saglam tutuyor hem de bir parca basarisiz olursa
 * digerlerini dusurmuyor.
 */
const EXAM_CHUNK_SIZE = 10;

/**
 * Ayni anda kac model cagrisi acilacak.
 *
 * Cagrilar (profil x parca) carpimindan cikiyor ve hepsi bagimsiz. Sinirsiz
 * paralel calistirmak saglayicinin dakikalik istek sinirina takiliyor;
 * sirayla calistirmak ise 20 soruluk bir sinavda dakikalar suruyor.
 */
const EXAM_CONCURRENCY = 4;

/** Kestirimin ust sinirlari - tek istekte kotanin tukenmemesi icin. */
export const SIMULATION_LIMITS = {
  maxQuestions: 30,
  maxProfiles: 8,
} as const;

const examAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionNumber: z
          .number()
          .int()
          .describe("Cevaplanan sorunun sinavdaki numarasi."),
        answer: z
          .string()
          .describe(
            'Coktan secmeli soruda YALNIZCA sik anahtari ("A", "B", "C", "D"); ' +
              "acik uclu soruda ogrencinin yazacagi cevap.",
          ),
        confidence: z
          .number()
          .min(0)
          .max(100)
          .describe("Ogrencinin bu cevaba duydugu guven, 0-100."),
      }),
    )
    .describe("Verilen her soru icin bir cevap."),
});

export interface SimulateExamOptions {
  cohort: readonly CohortMember[];
  questions: readonly SimulationQuestion[];
  /** Sinav suresi (dakika); yoksa sure uyumu hesaplanmaz. */
  durationMinutes: number | null;
  /** Kadronun adi - rapora ve kayda yazilir. */
  cohortLabel: string;
  modelId?: string;
  providerId?: AiProvider;
}

/**
 * Kadroya sinavi cozdurur ve kestirim raporu uretir.
 *
 * CAGRI DUZENI - profil basina sinav, soru basina degil:
 *
 *   Soru basina cagri yapsaydik (her soru icin butun kadro) 20 soruluk sinav
 *   20 cagri ederdi ve her cagrida profil tanimlari bastan gonderilirdi. Profil
 *   basina cagri hem daha ucuz hem daha gercekci: ogrenci sinavi bastan sona
 *   tek oturusta cozer, onceki sorulari hatirlar.
 *
 *   Sorular parcalara bolunuyor (EXAM_CHUNK_SIZE) cunku uzun ciktida model
 *   kayiyor; parcalar ve profiller birlikte tek bir gorev listesine cikip
 *   sinirli paralellikle calistiriliyor.
 *
 * ACIK UCLU PUANLAMA: her acik uclu soru icin TEK bir puanlama cagrisi - o
 * sorunun butun profil cevaplari birlikte rubrige vurulur.
 *
 * CEVAP ANAHTARI VE RUBRIK cozum cagrilarina verilmez; yalnizca puanlama
 * cagrisinda ve saf hesap katmaninda kullanilir.
 */
export async function simulateExam(
  options: SimulateExamOptions,
): Promise<ExamSimulationReport> {
  const { durationMinutes, cohortLabel, modelId, providerId } = options;

  const cohort = options.cohort.slice(0, SIMULATION_LIMITS.maxProfiles);
  const questions = options.questions.slice(0, SIMULATION_LIMITS.maxQuestions);

  if (cohort.length === 0) throw new Error("[ai] simulateExam: kadro bos olamaz.");
  if (questions.length === 0) {
    throw new Error("[ai] simulateExam: sinavda soru yok.");
  }

  const ai = providerId
    ? await resolveAiConfigFor(providerId)
    : await resolveAiConfig();

  if (!ai) {
    throw new Error(
      `[ai] "${providerId}" saglayicisinin kayitli anahtari yok. Sistem > API Anahtarlari ekranindan tanimlayin.`,
    );
  }

  if (ai.mockMode) {
    return buildExamSimulationReport({
      cohort,
      questions,
      answers: mockExamAnswers(cohort, questions),
      durationMinutes,
      cohortLabel,
    });
  }

  const model = createAiModel(ai, modelId || ai.modelGeneration);
  const chunks = chunk(questions, EXAM_CHUNK_SIZE);
  const byPosition = new Map(questions.map((question) => [question.position, question]));

  /* Gorev listesi: her profil her parcayi bir kez cozer. */
  const tasks = cohort.flatMap((member) =>
    chunks.map((parca) => async (): Promise<SimulatedAnswer[]> => {
      const { object } = await generateObject({
        maxRetries: 0,
        model,
        schema: examAttemptSchema,
        system: [
          "Sen bir SINAV SIMULATORUSUN: verilen ogrenci profilinin gozunden bir sinavi cozersin.",
          "SANA DOGRU CEVAPLAR VERILMEDI. Sorulari gercekten cozmen gerekiyor.",
          "Rol yapmiyorsun, taklit ediyorsun: profilin bilgi duzeyi hangi cevaba goturuyorsa onu yaz.",
          "Bilerek yanlis yapma; ama profil konuyu bilmiyorsa dogru cevabi da uydurma.",
          "Her sorunun DERSI yaziyor; profilin o dersteki duzeyi neyse onu uygula.",
          "Coktan secmeli soruda `answer` alanina YALNIZCA sik anahtarini yaz.",
          "Acik uclu soruda o ogrencinin gercekten yazacagi cevabi yaz: yetkin ogrenci gerekceli ve eksiksiz, zorlanan ogrenci kisa ve yuzeysel yazar.",
          "Bos birakmayi secebilirsin: bilmiyorsa ve tahmin de yurutemiyorsa `answer` alanini bos birak.",
          "Verilen butun sorulari cevapla; hicbirini atlama.",
          "Turkce yanit ver.",
        ].join(" "),
        prompt: [
          `OGRENCI PROFILI (${member.profile.label}):\n${member.profile.brief}`,
          `SINAV SORULARI:\n${parca.map(examQuestionForStudent).join("\n\n")}`,
          `GOREV: ${parca.length} sorunun her biri icin bu ogrencinin verecegi cevabi uret.`,
        ].join("\n\n"),
      });

      const seen = new Set<number>();
      const answers: SimulatedAnswer[] = [];

      for (const item of object.answers) {
        if (seen.has(item.questionNumber)) continue;
        const question = byPosition.get(item.questionNumber);
        if (!question) continue;
        // Bos birakilan soru cevap sayilmaz: rapor "cevaplanan soru" sayisini
        // ayri gosteriyor ve bos birakma sure/dikkat sinyali.
        const answer = item.answer.trim();
        if (!answer) continue;
        seen.add(item.questionNumber);

        answers.push({
          profileId: member.profile.id,
          questionId: question.questionId,
          answer:
            question.type === "test" ? normalizeOptionKey(answer) : answer,
          confidence: clampScore(item.confidence, 100),
          rubricScore: null,
        });
      }

      return answers;
    }),
  );

  const answers = (await mapWithConcurrency(tasks, EXAM_CONCURRENCY)).flat();

  /*
    Acik uclu sorularin rubrik puanlari.

    Soru basina TEK cagri: o sorunun butun profil cevaplari birlikte
    puanlaniyor. Ayri ayri puanlamak hem N kat pahali olurdu hem de
    degerlendirici her seferinde sifirdan baslayacagi icin cevaplar arasi
    tutarlilik zayiflardi - oysa burada onemli olan mutlak puan degil ust ve
    alt grubun AYRISMASI.
  */
  const openEnded = questions.filter(
    (question) => question.type === "acik_uclu" && question.rubric,
  );

  const gradingTasks = openEnded.map((question) => async () => {
    const soruCevaplari = answers.filter(
      (answer) => answer.questionId === question.questionId,
    );
    if (soruCevaplari.length === 0) return;

    const scores = await gradeCohortAnswers(
      model,
      question.rubric ?? "",
      question.text,
      soruCevaplari.map((answer) => ({
        profileId: answer.profileId,
        answer: answer.answer,
      })),
    );

    const scoreByProfile = new Map(scores.map((score) => [score.profileId, score.score]));
    for (const answer of soruCevaplari) {
      answer.rubricScore = scoreByProfile.get(answer.profileId) ?? 0;
    }
  });

  await mapWithConcurrency(gradingTasks, EXAM_CONCURRENCY);

  return buildExamSimulationReport({
    cohort,
    questions,
    answers,
    durationMinutes,
    cohortLabel,
  });
}

/** Sinav sorusunu ogrencinin gordugu bicime cevirir; anahtar ve rubrik girmez. */
function examQuestionForStudent(question: SimulationQuestion): string {
  const parts = [
    `${question.position}) [${question.subject}] ${question.text}`,
    question.type === "test"
      ? (question.options ?? [])
          .map((option) => `   ${option.key}) ${option.text}`)
          .join("\n")
      : "   (Acik uclu - yaziyla cevaplayin)",
  ];

  return parts.filter(Boolean).join("\n");
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/**
 * Gorevleri sinirli paralellikle calistirir ve SIRAYI KORUR.
 *
 * `Promise.all` hepsini ayni anda acardi; saglayicinin dakikalik istek siniri
 * bunu 429 ile karsilar ve simulasyonun tamami duser. Havuz mantigi ile en
 * fazla `limit` istek acik kaliyor.
 */
async function mapWithConcurrency<T>(
  tasks: readonly (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      if (!task) return;
      results[index] = await task();
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Mock modda sinav kestirimi.
 *
 * Yetkinlik ile soru zorlugunu karsilastiran deterministik bir kural: yuksek
 * yetkinlikli profil zor soruyu da cozer, dusuk yetkinlikli yalnizca kolayi.
 * Amac anahtarsiz demoda dagilimin, ayrismanin ve kazanim kiriliminin GERCEKCI
 * gorunmesi - hepsi ayni puani alsaydi panel hicbir sey anlatmazdi.
 */
function mockExamAnswers(
  cohort: readonly CohortMember[],
  questions: readonly SimulationQuestion[],
): SimulatedAnswer[] {
  const zorlukEsigi: Record<string, number> = { kolay: 0.3, orta: 0.55, zor: 0.8 };

  return cohort.flatMap((member) =>
    questions.map((question): SimulatedAnswer => {
      const esik = zorlukEsigi[question.difficulty ?? "orta"] ?? 0.55;
      const dersYetkinligi =
        member.profile.subjectAbility?.[question.subject] ?? member.profile.ability;
      const dogru = dersYetkinligi >= esik;

      const dogruKey = question.correctAnswer
        ? normalizeOptionKey(question.correctAnswer)
        : "A";
      const yanlisSiklar = (question.options ?? [])
        .map((option) => normalizeOptionKey(option.key))
        .filter((key) => key !== dogruKey);

      return {
        profileId: member.profile.id,
        questionId: question.questionId,
        answer:
          question.type === "test"
            ? dogru
              ? dogruKey
              : yanlisSiklar[question.position % Math.max(1, yanlisSiklar.length)] ??
                dogruKey
            : `[MOCK] ${member.profile.label} cevabi.`,
        confidence: Math.round(35 + dersYetkinligi * 60),
        rubricScore:
          question.type === "acik_uclu"
            ? Math.round(Math.max(0, Math.min(100, dersYetkinligi * 110 - 10)))
            : null,
      };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Normalizasyon                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Model ciktisini veritabani kisitlariyla uyumlu hale getirir:
 * test sorusunda secenek/dogru cevap, acik ucluda rubrik garanti edilir.
 */
async function normalizeGeneratedQuestion(
  question: z.infer<typeof generatedQuestionSchema>,
  fallbackTopic: string,
): Promise<GeneratedQuestion> {
  const topic = question.topic.trim() || fallbackTopic;
  const visual = await toQuestionVisual(question.visual);

  if (question.type === "test") {
    const options =
      question.options && question.options.length > 0 ? question.options : null;

    // Sik listesi gelmediyse soruyu acik ucluye dusurmek yerine hata verilir;
    // cagiran katman bu taslagi eleyebilir.
    if (!options || !question.correct_answer) {
      throw new Error(
        `[ai] Test sorusu eksik uretildi (secenek veya dogru cevap yok): "${question.text}"`,
      );
    }

    return {
      topic,
      text: question.text,
      type: "test",
      options,
      correct_answer: question.correct_answer,
      rubric: null,
      difficulty: question.difficulty,
      visual,
    };
  }

  if (!question.rubric) {
    throw new Error(
      `[ai] Acik uclu soru rubriksiz uretildi: "${question.text}"`,
    );
  }

  return {
    topic,
    text: question.text,
    type: "acik_uclu",
    options: null,
    correct_answer: null,
    rubric: question.rubric,
    difficulty: question.difficulty,
    visual,
  };
}

/** Puani 0-maxScore araligina sikistirir ve kriter toplamiyla tutarli kilar. */
function normalizeGradingResult(
  result: z.infer<typeof gradingResultSchema>,
  maxScore: number,
): GradingResult {
  const clamp = (value: number, max: number): number =>
    Math.max(0, Math.min(max, Math.round(value * 100) / 100));

  const criteria = result.criteria.map((criterion) => ({
    ...criterion,
    max: clamp(criterion.max, maxScore),
    earned: clamp(criterion.earned, Math.max(0, criterion.max)),
  }));

  return {
    score: clamp(result.score, maxScore),
    feedback: result.feedback,
    criteria,
  };
}

/* -------------------------------------------------------------------------- */
/*  Mock mod (AI_MOCK_MODE=true)                                              */
/* -------------------------------------------------------------------------- */

function mockGenerateQuestions(
  kazanim: string,
  options: Required<Pick<GenerateQuestionsOptions, "count" | "type">> &
    Pick<GenerateQuestionsOptions, "topic" | "styleGuide">,
): GeneratedQuestion[] {
  const { count, type, topic, styleGuide } = options;
  const resolvedTopic = topic ?? kazanim.split(" ").slice(0, 3).join(" ");
  const likedCount = styleGuide?.liked.length ?? 0;
  const dislikedCount = styleGuide?.disliked.length ?? 0;

  /**
   * Mock modda tarz rehberinin gercekten uygulandigini gorunur kilar:
   * begenilen ornek varsa zorluk dagilimi onlara gore kayar, etiket de bunu yazar.
   */
  const learned = likedCount > 0 || dislikedCount > 0;
  const difficulties = learned
    ? (likedMockDifficulties(styleGuide) ?? (["kolay", "orta", "zor"] as const))
    : (["kolay", "orta", "zor"] as const);

  return Array.from({ length: count }, (_, index): GeneratedQuestion => {
    const isTest = type === "test" || (type === "karisik" && index % 2 === 0);
    const difficulty = difficulties[index % difficulties.length] ?? "orta";

    if (isTest) {
      return {
        topic: resolvedTopic,
        text: `[MOCK${learned ? " · ogrenilmis tarz" : ""}] "${kazanim}" kazanimini olcen ${index + 1}. coktan secmeli soru.`,
        type: "test",
        options: [
          { key: "A", text: "Birinci secenek" },
          { key: "B", text: "Ikinci secenek (dogru)" },
          { key: "C", text: "Ucuncu secenek" },
          { key: "D", text: "Dorduncu secenek" },
        ],
        correct_answer: "B",
        rubric: null,
        difficulty,
        // Mock modda gorsel uretilmiyor: sahte grafik gercek bir veri
        // gostermedigi icin yaniltici olur.
        visual: null,
      };
    }

    return {
      topic: resolvedTopic,
      text: `[MOCK${learned ? " · ogrenilmis tarz" : ""}] "${kazanim}" kazanimini olcen ${index + 1}. acik uclu soru.`,
      type: "acik_uclu",
      options: null,
      correct_answer: null,
      rubric: [
        "1. Temel kavrami dogru tanimlar (40 puan)",
        "2. Sureci adim adim aciklar (40 puan)",
        "3. Ornek vererek destekler (20 puan)",
      ].join("\n"),
      difficulty,
      visual: null,
    };
  });
}

/**
 * Mock modda revizyon: gercek model cagrilmaz, degisiklik gorunur kilinir.
 * Zorluk talimata gore kaydirilir ve soru kokune etiket eklenir.
 */
function mockReviseQuestion(
  question: GeneratedQuestion,
  instruction: string,
): GeneratedQuestion {
  const lower = instruction.toLocaleLowerCase("tr");

  const difficulty: GeneratedQuestion["difficulty"] = lower.includes("zorlastir")
    ? "zor"
    : lower.includes("kolaylastir")
      ? "kolay"
      : question.difficulty;

  const text = lower.includes("kisalt")
    ? `[MOCK revize] ${question.text.split(" ").slice(0, 8).join(" ")}?`
    : `[MOCK revize] ${question.text}`;

  return { ...question, text, difficulty };
}

function mockGradeAnswer(
  studentAnswer: string,
  rubric: string,
  maxScore: number,
): GradingResult {
  // Deterministik "puan": cevap uzunlugundan tureyen basit bir yaklasim.
  const words = studentAnswer.trim().split(/\s+/).length;
  const score = Math.min(maxScore, Math.round((words / 60) * maxScore));
  const lines = rubric
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  const perCriterion = lines.length > 0 ? maxScore / lines.length : maxScore;

  return {
    score,
    feedback: `[MOCK] Cevabiniz ${words} kelime. Rubrik maddelerinin buyuk bolumune deginmissiniz; ornek vererek aciklamalarinizi guclendirebilirsiniz.`,
    criteria: lines.map((line) => ({
      criterion: line,
      earned: Math.round((score / maxScore) * perCriterion),
      max: Math.round(perCriterion),
      comment: "[MOCK] Ornek gerekce.",
    })),
  };
}

function mockCoachMistake(input: MistakeCoachInput): MistakeCoachResult {
  const outcome = input.outcomeText || input.topic || input.subject;
  return {
    conceptSummary: `[MOCK] ${outcome} kazanımında temel kavramları kendi cümlelerinle ilişkilendirerek yeniden kur. Tanımı ezberlemek yerine kavramın nedenini ve bir örneğini birlikte düşün.`,
    likelyMisconception:
      "[MOCK] Sorudaki iki yakın kavramı birbirinden ayıran ölçüt gözden kaçmış olabilir.",
    studySteps: [
      "Kavramı bir cümleyle tanımla ve anahtar iki özelliğini yaz.",
      "Bir doğru örnek ile bir karşı örneği yan yana karşılaştır.",
      "Benzer bir soruyu çözerken seçimini bu ölçütle gerekçelendir.",
    ],
    practiceQuestion: `[MOCK] ${input.topic || input.subject} konusunda aynı kazanımı farklı bir örnek üzerinde nasıl açıklarsın?`,
    hint: "Tanımdaki ayırt edici özelliği önce bul, ardından örneğe uygula.",
  };
}

function mockReviewExamQuality(input: ExamAiReviewInput): ExamAiReviewResult {
  const outcomeCount = new Set(
    input.questions.map((question) => question.outcomeText).filter(Boolean),
  ).size;
  return {
    summary: `[MOCK] ${input.questions.length} soruluk taslak ${outcomeCount} farklı kazanımı ölçüyor. Soru kökleri ve ölçülen hedefler yayından önce birlikte gözden geçirilmelidir.`,
    strengths: [
      "Soru ve puan yapısı birlikte incelenebilecek biçimde hazırlanmış.",
      "Kazanım bağlantıları ölçme kapsamını görünür kılıyor.",
    ],
    risks:
      input.questions.length > 0
        ? [
            {
              severity: "orta",
              title: "Bilişsel çeşitliliği doğrulayın",
              explanation:
                "[MOCK] Soruların yalnız hatırlama değil, uygulama ve gerekçelendirme düzeylerini de kapsadığı kontrol edilmeli.",
              recommendation:
                "En az bir soruyu farklı bağlamda uygulama veya analiz gerektirecek biçimde gözden geçirin.",
              questionNumbers: [],
            },
          ]
        : [],
    revisionPriorities: [
      "Deterministik engelleri kapatın.",
      "Kazanım ve zorluk dağılımını birlikte doğrulayın.",
      "Soru köklerini öğrenci açısından son kez okuyun.",
    ],
  };
}

/**
 * Mock modda "ogrenme" etkisini gorunur kilar: uzmanin begendigi orneklerdeki
 * zorluk dagilimini one cikarir. Gercek modda bu isi modelin kendisi yapar.
 */
function likedMockDifficulties(
  styleGuide: StyleGuide | undefined,
): readonly GeneratedQuestion["difficulty"][] | null {
  const liked = styleGuide?.liked ?? [];
  if (liked.length === 0) return null;

  const valid: GeneratedQuestion["difficulty"][] = liked
    .map((preference) => preference.difficulty)
    .filter(
      (value): value is GeneratedQuestion["difficulty"] =>
        value === "kolay" || value === "orta" || value === "zor",
    );

  return valid.length > 0 ? valid : null;
}
