/** Gelisim ekraninda kullanilan puanlari 0-100 araliginda guvenle tutar. */
export function asPercentageScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export interface PointWeightedResult {
  earned_points: number | null;
  total_points: number | null;
  final_score: number | null;
}

/**
 * Farkli toplam puana sahip sinavlari soru sayisina gore degil, kazanilan
 * puan / mumkun puan oranina gore birlestirir. Puan kirilimi olmayan eski
 * kayitlarda nihai puanlarin ortalamasina geri doner.
 */
export function calculatePointWeightedAverage(
  results: readonly PointWeightedResult[],
): number | null {
  const pointBased = results.filter(
    (result) =>
      result.earned_points !== null &&
      result.total_points !== null &&
      result.total_points > 0,
  );

  const totalPoints = pointBased.reduce(
    (total, result) => total + (result.total_points ?? 0),
    0,
  );

  if (totalPoints > 0) {
    const earnedPoints = pointBased.reduce(
      (total, result) => total + (result.earned_points ?? 0),
      0,
    );
    return Math.round((earnedPoints / totalPoints) * 1000) / 10;
  }

  const finalScores = results
    .map((result) => asPercentageScore(result.final_score))
    .filter((score): score is number => score !== null);

  if (finalScores.length === 0) return null;
  return (
    Math.round(
      (finalScores.reduce((total, score) => total + score, 0) /
        finalScores.length) *
        10,
    ) / 10
  );
}

export function scoreDifference(
  latest: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  const latestScore = asPercentageScore(latest);
  const previousScore = asPercentageScore(previous);
  if (latestScore === null || previousScore === null) return null;
  return Math.round((latestScore - previousScore) * 10) / 10;
}
