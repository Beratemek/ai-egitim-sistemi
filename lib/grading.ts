/**
 * Cevap on degerlendirme katmani.
 *
 * Coktan secmeli sorular deterministik olarak (dogru sik karsilastirmasi),
 * acik uclu sorular rubrige gore AI ile puanlanir. Her iki yolda da uretilen
 * puan bir ON DEGERLENDIRMEdir; nihai puani her zaman egitmen onaylar.
 *
 * Hem `POST /api/submissions` hem `submitAnswer` server action'i buradan gecer,
 * boylece iki yol ayni puani uretir.
 */

import { gradeAnswer } from "@/lib/ai";
import type { GradingResult, Question, SubmissionStatus } from "@/lib/types";

/** Puanlama icin gereken soru alanlari. */
export type GradableQuestion = Pick<
  Question,
  "text" | "type" | "rubric" | "correct_answer"
>;

export interface AutoGradeResult {
  /** 0-100 arasi on puan. Puanlanamayan soruda null. */
  score: number | null;
  feedback: string | null;
  /** Rubrik maddesi bazinda kirilim; coktan secmeli soruda bos kalir. */
  criteria: GradingResult["criteria"];
  status: SubmissionStatus;
}

/**
 * Sik anahtarini karsilastirmaya hazirlar: "b", "B)", "b) Tilakoit zar" -> "B".
 * Turkce'ye ozel buyuk harf donusumu KULLANILMAZ; sik anahtarlari A-D'dir ve
 * `toLocaleUpperCase("tr")` "i" harfini "I" yerine "İ" yapardi.
 */
function normalizeOptionKey(value: string): string {
  const trimmed = value.trim();
  const leadingLetter = trimmed.match(/^[A-Za-z]/);
  return (leadingLetter ? leadingLetter[0] : trimmed).toUpperCase();
}

/**
 * Ogrenci cevabina on puan uretir.
 *
 * @param question   Puanlanacak soru (rubrik/dogru cevap veritabanindan okunmali).
 * @param answerText Coktan secmelide sik anahtari, acik ucluda serbest metin.
 */
export async function autoGrade(
  question: GradableQuestion,
  answerText: string,
): Promise<AutoGradeResult> {
  if (question.type === "test" && question.correct_answer) {
    const correctKey = normalizeOptionKey(question.correct_answer);
    const isCorrect = normalizeOptionKey(answerText) === correctKey;

    return {
      score: isCorrect ? 100 : 0,
      feedback: isCorrect
        ? "Dogru cevap."
        : `Yanlis cevap. Dogru sik: ${correctKey}.`,
      criteria: [],
      status: "ai_degerlendirildi",
    };
  }

  if (question.type === "acik_uclu" && question.rubric) {
    const grading = await gradeAnswer(answerText, question.rubric, {
      questionText: question.text,
    });

    return {
      score: grading.score,
      feedback: grading.feedback,
      criteria: grading.criteria,
      status: "ai_degerlendirildi",
    };
  }

  // Rubrigi olmayan acik uclu soru: puanlama tamamen egitmene kalir.
  return { score: null, feedback: null, criteria: [], status: "gonderildi" };
}
