/**
 * Sinav durum uyarilari - saf yardimcilar (React'ten bagimsiz, test edilebilir).
 *
 * Egitmenin genel bakis ekrani "kac sinav var" demekten fazlasini yapmali:
 * SESSIZCE YANLIS DURAN sinavi soylemeli. Pratikte kaybolan is hep ayni
 * birkac yerden cikiyor:
 *
 *   - sinav yayinda ama hicbir sinifa atanmamis  -> kimse goremiyor,
 *   - sinavin bitis tarihi gecmis ama hala yayinda -> liste kirleniyor,
 *   - taslak hazir ama yayina alinmamis          -> ogrenci bekliyor,
 *   - sinav bos                                   -> yayina alinamaz.
 *
 * Bunlarin hicbiri bir hata mesaji uretmiyor; kimse bakmazsa oylece duruyor.
 */

/** Uyari turu; siralamasi ayni zamanda ONCELIK sirasidir. */
export type ExamAlertKind =
  | "suresi-doldu"
  | "atanmamis"
  | "yayina-hazir"
  | "sorusuz";

export interface ExamAlert {
  examId: string;
  examTitle: string;
  kind: ExamAlertKind;
  /** Dikkat isteyen mi, yoksa yalnizca hatirlatma mi? */
  severity: "warning" | "info";
}

/** Uyari uretmek icin bir sinav hakkinda bilinmesi gerekenler. */
export interface ExamAlertInput {
  id: string;
  title: string;
  is_published: boolean;
  ends_at: string | null;
  /** Sinava bagli soru sayisi. */
  questionCount: number;
  /** Sinava atanmis ogrenci sayisi. */
  assignedCount: number;
}

const SEVERITY: Record<ExamAlertKind, ExamAlert["severity"]> = {
  "suresi-doldu": "warning",
  atanmamis: "warning",
  "yayina-hazir": "info",
  sorusuz: "info",
};

const PRIORITY: readonly ExamAlertKind[] = [
  "suresi-doldu",
  "atanmamis",
  "yayina-hazir",
  "sorusuz",
];

/**
 * Bir sinavin TEK uyarisini bulur; yoksa null.
 *
 * Sinav basina tek uyari bilincli bir sinir: ayni sinav icin uc satir
 * gostermek listeyi bir yapilacaklar listesi olmaktan cikarip gurultuye
 * cevirirdi. Once en agir olan soylenir, o cozulunce bir sonraki gorunur.
 */
function alertFor(exam: ExamAlertInput, now: number): ExamAlertKind | null {
  if (exam.is_published) {
    // Bitis ani GECMIS mi? Tam o ana esitlik de "gecti" sayilir.
    if (exam.ends_at) {
      const bitis = new Date(exam.ends_at).getTime();
      if (Number.isFinite(bitis) && bitis <= now) return "suresi-doldu";
    }
    if (exam.assignedCount === 0) return "atanmamis";
    return null;
  }

  return exam.questionCount > 0 ? "yayina-hazir" : "sorusuz";
}

/**
 * Sinav listesinden uyarilari cikarir; en acil olan basa gelir.
 *
 * `now` disaridan veriliyor ki test edilebilsin ve sunucuda tek bir an
 * kullanilsin - satir satir `Date.now()` cagirmak ayni listede farkli
 * anlara gore karar vermek demek olurdu.
 */
export function buildExamAlerts(
  exams: readonly ExamAlertInput[],
  now: number,
): ExamAlert[] {
  const alerts: ExamAlert[] = [];

  for (const exam of exams) {
    const kind = alertFor(exam, now);
    if (!kind) continue;

    alerts.push({
      examId: exam.id,
      examTitle: exam.title,
      kind,
      severity: SEVERITY[kind],
    });
  }

  return alerts.sort(
    (a, b) =>
      PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) ||
      a.examTitle.localeCompare(b.examTitle, "tr"),
  );
}

/** Uyarinin egitmene ne soyledigi ve ne yapmasi gerektigi. */
export const ALERT_TEXT: Record<
  ExamAlertKind,
  { title: string; action: string }
> = {
  "suresi-doldu": {
    title: "Süresi doldu ama hâlâ yayında",
    action: "Yayından çıkarın",
  },
  atanmamis: {
    title: "Yayında ama hiçbir sınıfa atanmadı — öğrenciler göremiyor",
    action: "Sınıf atayın",
  },
  "yayina-hazir": {
    title: "Soruları hazır, yayına alınmayı bekliyor",
    action: "Yayına alın",
  },
  sorusuz: {
    title: "Henüz soru eklenmedi",
    action: "Soru ekleyin",
  },
};
