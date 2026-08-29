/**
 * KALIBRASYON - kestirimin kendi dogrulugunu olcmesi.
 *
 * Sinav kestirimi bir tahmin uretir: "bu sinav bu sinifta ortalama %62
 * getirir". Tahmin hicbir yere yazilmazsa, sinav gercekten yapildiginda kimse
 * tuttugunu ya da tutmadigini bilemez - ve tutmayan bir tahmin, tutandan
 * ayirt edilemedigi surece bir sey ifade etmez.
 *
 * Bu modul kaydedilmis kestirimleri GERCEK sonuclarla karsilastirir ve
 * olculebilir bir guven araligi uretir: "son 7 kestirimde ortalama sapma
 * 6,4 puan; 5'i 10 puanin altinda kaldi".
 *
 * IKI SAYI, IKI AYRI SEY:
 *   - MUTLAK SAPMA (MAE) tahminin ne kadar isabetli oldugunu soyler.
 *   - YANLILIK (bias) hangi YONE sapildigini soyler. Surekli pozitifse
 *     simulasyon fazla iyimser, surekli negatifse fazla karamsar - bu
 *     duzeltilebilir bir kusur, rastgele sapma degildir.
 *
 * GERCEK ORTALAMA, TAHMINLE AYNI FORMULLE hesaplanir: soru puanina gore
 * agirliklandirilmis ogrenci puanlarinin ortalamasi. Baska turlu hesaplamak
 * (or. soru bazinda ham ortalama) iki sayiyi kiyaslanamaz kilardi.
 *
 * SAF: veritabanindan ayri, birim testli.
 */

/* -------------------------------------------------------------------------- */
/*  Gercek ortalama                                                           */
/* -------------------------------------------------------------------------- */

/** Gercek ortalama hesabina giren tek bir cevap. */
export interface CalibrationSubmission {
  examId: string;
  studentId: string;
  questionId: string | null;
  /** Egitmenin onayladigi puan; onaylanmamissa null. */
  approvedScore: number | null;
  status: string;
}

/** Sinav-soru baglantisi; puan agirligi buradan gelir. */
export interface CalibrationExamQuestion {
  examId: string;
  questionId: string;
  points: number;
}

export interface ActualExamResult {
  examId: string;
  /** Soru puanina gore agirliklandirilmis sinif ortalamasi, 0-100. */
  average: number;
  /** Ortalamaya giren ogrenci sayisi. */
  studentCount: number;
}

/**
 * Gerceklesen sinav ortalamalarini hesaplar.
 *
 * ONAYSIZ CEVABI OLAN OGRENCI HESABA GIRMEZ. Yarim degerlendirilmis bir
 * kagitta onay bekleyen cevaplar sifir sayilirdi ve ortalama gercekte
 * olmadigi kadar dusuk cikardi - kalibrasyon da simulasyonu haksiz yere
 * "fazla iyimser" gosterirdi. Bir ogrenci ancak butun cevaplari egitmen
 * onayindan gectiginde ortalamaya katilir.
 *
 * Cevaplamadigi soru ise sifir sayilir; bu dogru, cunku simulasyon da bos
 * birakilan soruyu sifir sayiyor.
 */
export function computeActualResults(
  submissions: readonly CalibrationSubmission[],
  examQuestions: readonly CalibrationExamQuestion[],
): ActualExamResult[] {
  const pointsByExam = new Map<string, Map<string, number>>();
  for (const link of examQuestions) {
    const map = pointsByExam.get(link.examId) ?? new Map<string, number>();
    map.set(link.questionId, link.points);
    pointsByExam.set(link.examId, map);
  }

  /* (sinav, ogrenci) -> kazanilan puan ve onay durumu */
  type Kagit = { earned: number; pending: number };
  const kagitlar = new Map<string, Kagit>();

  for (const submission of submissions) {
    if (!submission.questionId) continue;
    const points = pointsByExam.get(submission.examId)?.get(submission.questionId);
    if (points === undefined) continue;

    const key = `${submission.examId} ${submission.studentId}`;
    const kagit = kagitlar.get(key) ?? { earned: 0, pending: 0 };

    if (submission.status === "egitmen_onayli" && submission.approvedScore !== null) {
      kagit.earned += (submission.approvedScore / 100) * points;
    } else {
      kagit.pending += 1;
    }

    kagitlar.set(key, kagit);
  }

  const byExam = new Map<string, number[]>();
  for (const [key, kagit] of kagitlar) {
    if (kagit.pending > 0) continue;

    const examId = key.slice(0, key.indexOf(" "));
    const points = pointsByExam.get(examId);
    if (!points) continue;

    const totalPoints = [...points.values()].reduce((total, value) => total + value, 0);
    if (totalPoints <= 0) continue;

    const list = byExam.get(examId) ?? [];
    list.push((kagit.earned / totalPoints) * 100);
    byExam.set(examId, list);
  }

  return [...byExam.entries()]
    .map(([examId, scores]) => ({
      examId,
      average: round(scores.reduce((total, value) => total + value, 0) / scores.length),
      studentCount: scores.length,
    }))
    .sort((a, b) => a.examId.localeCompare(b.examId));
}

/* -------------------------------------------------------------------------- */
/*  Ozet                                                                      */
/* -------------------------------------------------------------------------- */

/** Tek bir kestirimin gercekle karsilastirmasi. */
export interface CalibrationEntry {
  simulationId: string;
  examId: string;
  examTitle: string;
  cohortKind: string;
  cohortLabel: string;
  predicted: number;
  /** Sinav henuz sonuclanmadiysa null. */
  actual: number | null;
  /** Gercek ortalamaya giren ogrenci sayisi. */
  studentCount: number;
  createdAt: string;
}

export interface CalibrationSummary {
  /** Gercek sonucu olan kestirim sayisi. */
  count: number;
  /** Ortalama mutlak sapma, puan. */
  meanAbsoluteError: number;
  /**
   * Ortalama isaretli sapma (tahmin - gercek), puan.
   * Pozitif: simulasyon fazla iyimser. Negatif: fazla karamsar.
   */
  bias: number;
  /** Sapmasi 10 puanin altinda kalan kestirimlerin orani, 0-1. */
  within10: number;
  /** En buyuk mutlak sapma, puan. */
  worst: number;
}

/**
 * Kalibrasyon ozeti.
 *
 * Gercek sonucu olmayan kestirimler hesaba girmez; hicbiri yoksa null doner -
 * arayuz "henuz olcum yok" der. Sifir kestirimi "%0 sapma" diye gostermek,
 * hic denenmemis bir seyi kusursuz gibi sunmak olurdu.
 */
export function summarizeCalibration(
  entries: readonly CalibrationEntry[],
): CalibrationSummary | null {
  const olculen = entries.filter(
    (entry): entry is CalibrationEntry & { actual: number } => entry.actual !== null,
  );
  if (olculen.length === 0) return null;

  const sapmalar = olculen.map((entry) => entry.predicted - entry.actual);
  const mutlak = sapmalar.map(Math.abs);

  return {
    count: olculen.length,
    meanAbsoluteError: round(
      mutlak.reduce((total, value) => total + value, 0) / mutlak.length,
    ),
    bias: round(sapmalar.reduce((total, value) => total + value, 0) / sapmalar.length),
    within10: round(
      mutlak.filter((value) => value < 10).length / mutlak.length,
      2,
    ),
    worst: round(Math.max(...mutlak)),
  };
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
