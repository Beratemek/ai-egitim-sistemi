/**
 * Kazanim bazli basari analizi.
 *
 * NEDEN KONU DEGIL KAZANIM: konu bazli rapor "Trigonometri %61" der ve hoca
 * ne yapacagini bilemez - konunun tamami mi zayif, bir parcasi mi? Kazanim
 * bazli rapor "birim cemberde oran hesaplar %89, toplam formulunu uygular
 * %38" der; hoca tam olarak neyi tekrar edecegini gorur. Sartnamenin 4. rolu
 * de "ogrenme ciktilarini takip eder" diyor.
 *
 * PUAN KAYNAGI: yalnizca EGITMEN ONAYLI cevaplar. AI on puani bilincli olarak
 * disarida: nihai karar egitmenin ve onaylanmamis bir puanla rapor uretmek
 * hocanin vermedigi bir karari ona atfetmek olurdu. Onay bekleyen cevaplar
 * ayrica sayiliyor - "%38" ile "%38 ama 40 cevap daha onay bekliyor" cok
 * farkli iki bilgi.
 *
 * Gruplama saf tutuluyor: veritabanindan ayri, sinanabilir.
 */

/** Analize giren cevap. Yalnizca gereken alanlar. */
export interface AnalysisSubmission {
  question_id: string | null;
  student_id: string;
  status: string;
  instructor_approved_score: number | null;
}

/** Analize giren soru. */
export interface AnalysisQuestion {
  id: string;
  outcome_id: string | null;
}

/** Analize giren kazanim. */
export interface AnalysisOutcome {
  id: string;
  outcome_text: string;
  subject: string | null;
  topic: string;
}

export interface OutcomeAnalysisRow {
  outcomeId: string;
  outcomeText: string;
  subject: string | null;
  topic: string;
  /**
   * Onayli cevaplarin ortalamasi (0-100). Hic onayli cevap yoksa null -
   * "henuz olculmedi" ile "%0 basari" ayri seylerdir ve karistirilmamali.
   */
  averageScore: number | null;
  /** Ortalamaya giren onayli cevap sayisi. */
  answerCount: number;
  /** Bu kazanimi olcen sorulari cevaplayan farkli ogrenci sayisi. */
  studentCount: number;
  /** Cevaplanmis ama egitmen onayi bekleyen cevap sayisi. */
  pendingCount: number;
  /** Havuzda bu kazanima bagli soru sayisi. */
  questionCount: number;
}

/** Zayif sayilma esigi; bu ve altindaki kazanimlar dikkat cekmeli. */
export const ZAYIF_ESIGI = 50;

/** Orta sayilma esigi. */
export const ORTA_ESIGI = 70;

export type OutcomeLevel = "zayif" | "orta" | "iyi" | "olculmedi";

/** Ortalamayi seviyeye cevirir; arayuz rengini bu belirler. */
export function outcomeLevel(averageScore: number | null): OutcomeLevel {
  if (averageScore === null) return "olculmedi";
  if (averageScore < ZAYIF_ESIGI) return "zayif";
  if (averageScore < ORTA_ESIGI) return "orta";
  return "iyi";
}

/**
 * Cevaplari kazanim bazinda toplar.
 *
 * SIRALAMA: en zayif kazanim EN USTTE. Rapor bir eylem listesidir; hoca
 * ekrani actiginda ilk gordugu sey once ilgilenmesi gereken sey olmali.
 * Henuz olculmemis kazanimlar en sona konuyor - bilgi verirler ama acil
 * bir is isaret etmezler.
 */
export function analyzeOutcomes(
  outcomes: readonly AnalysisOutcome[],
  questions: readonly AnalysisQuestion[],
  submissions: readonly AnalysisSubmission[],
): OutcomeAnalysisRow[] {
  // Soru -> kazanim eslemesi ve kazanim basina soru sayisi.
  const outcomeByQuestion = new Map<string, string>();
  const questionCounts = new Map<string, number>();

  for (const question of questions) {
    if (!question.outcome_id) continue;
    outcomeByQuestion.set(question.id, question.outcome_id);
    questionCounts.set(
      question.outcome_id,
      (questionCounts.get(question.outcome_id) ?? 0) + 1,
    );
  }

  const buckets = new Map<
    string,
    { scores: number[]; students: Set<string>; pending: number }
  >();

  const bucketOf = (outcomeId: string) => {
    const existing = buckets.get(outcomeId);
    if (existing) return existing;
    const fresh = { scores: [], students: new Set<string>(), pending: 0 };
    buckets.set(outcomeId, fresh);
    return fresh;
  };

  for (const submission of submissions) {
    if (!submission.question_id) continue;
    const outcomeId = outcomeByQuestion.get(submission.question_id);
    if (!outcomeId) continue;

    const bucket = bucketOf(outcomeId);
    bucket.students.add(submission.student_id);

    // Onaylanmamis cevap ortalamaya GIRMEZ, ayrica sayilir.
    if (
      submission.status === "egitmen_onayli" &&
      submission.instructor_approved_score !== null
    ) {
      bucket.scores.push(submission.instructor_approved_score);
    } else {
      bucket.pending += 1;
    }
  }

  const rows = outcomes.map((outcome): OutcomeAnalysisRow => {
    const bucket = buckets.get(outcome.id);
    const scores = bucket?.scores ?? [];

    return {
      outcomeId: outcome.id,
      outcomeText: outcome.outcome_text,
      subject: outcome.subject,
      topic: outcome.topic,
      averageScore:
        scores.length === 0
          ? null
          : Math.round(
              (scores.reduce((total, score) => total + score, 0) / scores.length) * 10,
            ) / 10,
      answerCount: scores.length,
      studentCount: bucket?.students.size ?? 0,
      pendingCount: bucket?.pending ?? 0,
      questionCount: questionCounts.get(outcome.id) ?? 0,
    };
  });

  return rows.sort((a, b) => {
    // Olculmemisler en sona.
    if (a.averageScore === null && b.averageScore === null) {
      return a.outcomeText.localeCompare(b.outcomeText, "tr");
    }
    if (a.averageScore === null) return 1;
    if (b.averageScore === null) return -1;

    // Zayiftan guclüye.
    if (a.averageScore !== b.averageScore) return a.averageScore - b.averageScore;

    // Esitlikte daha cok cevap toplayan once: guvenilirligi yuksek.
    return b.answerCount - a.answerCount;
  });
}
