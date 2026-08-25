import type { CourseFeedbackSummary } from "@/lib/queries";

export const COURSE_FEEDBACK_PRIVACY_THRESHOLD = 3;

export const COURSE_FEEDBACK_METRICS = [
  { key: "clarityAverage", label: "Anlatım" },
  { key: "paceAverage", label: "Dersin hızı" },
  { key: "materialsAverage", label: "Materyaller" },
  { key: "assessmentFairnessAverage", label: "Ölçme adaleti" },
] as const;

export type CourseFeedbackMetricKey =
  (typeof COURSE_FEEDBACK_METRICS)[number]["key"];

export interface CourseFeedbackMetricResult {
  key: CourseFeedbackMetricKey;
  label: string;
  average: number | null;
}

export interface CourseFeedbackComparison {
  key: string;
  label: string;
  responseCount: number;
  ratedResponseCount: number;
  groupCount: number;
  reportableGroupCount: number;
  average: number | null;
}

export interface CourseFeedbackPeriodPoint {
  period: string;
  responseCount: number;
  average: number | null;
  clarity: number | null;
  pace: number | null;
  materials: number | null;
  fairness: number | null;
}

export interface CourseFeedbackAnalytics {
  totalResponses: number;
  ratedResponseCount: number;
  groupCount: number;
  reportableGroupCount: number;
  protectedGroupCount: number;
  overallAverage: number | null;
  metrics: CourseFeedbackMetricResult[];
  strongestMetric: CourseFeedbackMetricResult | null;
  weakestMetric: CourseFeedbackMetricResult | null;
  strongestGroup: CourseFeedbackSummary | null;
  weakestGroup: CourseFeedbackSummary | null;
  subjects: CourseFeedbackComparison[];
  instructors: CourseFeedbackComparison[];
  periods: CourseFeedbackPeriodPoint[];
  helpfulCommentCount: number;
  improvementCommentCount: number;
}

export function analyzeCourseFeedback(
  summaries: readonly CourseFeedbackSummary[],
): CourseFeedbackAnalytics {
  const reportable = summaries.filter(
    (summary) => summary.overallAverage !== null,
  );
  const metrics: CourseFeedbackMetricResult[] = COURSE_FEEDBACK_METRICS.map((metric) => ({
    ...metric,
    average: weightedAverage(reportable, metric.key),
  }));
  const measuredMetrics = metrics.filter(
    (metric): metric is CourseFeedbackMetricResult & { average: number } =>
      metric.average !== null,
  );
  const rankedGroups = [...reportable].sort(
    (a, b) =>
      (a.overallAverage ?? 0) - (b.overallAverage ?? 0) ||
      b.responseCount - a.responseCount,
  );

  return {
    totalResponses: sum(summaries, (summary) => summary.responseCount),
    ratedResponseCount: sum(reportable, (summary) => summary.responseCount),
    groupCount: summaries.length,
    reportableGroupCount: reportable.length,
    protectedGroupCount: summaries.length - reportable.length,
    overallAverage: weightedAverage(reportable, "overallAverage"),
    metrics,
    strongestMetric:
      [...measuredMetrics].sort((a, b) => b.average - a.average)[0] ?? null,
    weakestMetric:
      [...measuredMetrics].sort((a, b) => a.average - b.average)[0] ?? null,
    strongestGroup: rankedGroups.at(-1) ?? null,
    weakestGroup: rankedGroups[0] ?? null,
    subjects: buildComparisons(summaries, (summary) => ({
      key: summary.subject,
      label: summary.subject,
    })),
    instructors: buildComparisons(summaries, (summary) => ({
      key: summary.instructorId,
      label: summary.instructorName,
    })),
    periods: buildPeriods(summaries),
    helpfulCommentCount: sum(
      reportable,
      (summary) => summary.helpfulComments.length,
    ),
    improvementCommentCount: sum(
      reportable,
      (summary) => summary.improvementComments.length,
    ),
  };
}

function buildComparisons(
  summaries: readonly CourseFeedbackSummary[],
  keyOf: (summary: CourseFeedbackSummary) => { key: string; label: string },
): CourseFeedbackComparison[] {
  const buckets = new Map<
    string,
    { label: string; rows: CourseFeedbackSummary[] }
  >();

  for (const summary of summaries) {
    const identity = keyOf(summary);
    const bucket = buckets.get(identity.key) ?? {
      label: identity.label,
      rows: [],
    };
    bucket.rows.push(summary);
    buckets.set(identity.key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const reportable = bucket.rows.filter(
        (summary) => summary.overallAverage !== null,
      );
      return {
        key,
        label: bucket.label,
        responseCount: sum(bucket.rows, (summary) => summary.responseCount),
        ratedResponseCount: sum(
          reportable,
          (summary) => summary.responseCount,
        ),
        groupCount: bucket.rows.length,
        reportableGroupCount: reportable.length,
        average: weightedAverage(reportable, "overallAverage"),
      };
    })
    .sort(
      (a, b) =>
        (a.average === null ? 1 : 0) - (b.average === null ? 1 : 0) ||
        (a.average ?? 0) - (b.average ?? 0) ||
        b.responseCount - a.responseCount,
    );
}

function buildPeriods(
  summaries: readonly CourseFeedbackSummary[],
): CourseFeedbackPeriodPoint[] {
  const periods = new Map<string, CourseFeedbackSummary[]>();
  for (const summary of summaries) {
    const rows = periods.get(summary.academicPeriod) ?? [];
    rows.push(summary);
    periods.set(summary.academicPeriod, rows);
  }

  return [...periods.entries()]
    .sort(([a], [b]) => comparePeriods(a, b))
    .map(([period, rows]) => {
      const reportable = rows.filter((summary) => summary.overallAverage !== null);
      return {
        period,
        responseCount: sum(rows, (summary) => summary.responseCount),
        average: weightedAverage(reportable, "overallAverage"),
        clarity: weightedAverage(reportable, "clarityAverage"),
        pace: weightedAverage(reportable, "paceAverage"),
        materials: weightedAverage(reportable, "materialsAverage"),
        fairness: weightedAverage(
          reportable,
          "assessmentFairnessAverage",
        ),
      };
    });
}

function weightedAverage(
  summaries: readonly CourseFeedbackSummary[],
  key:
    | CourseFeedbackMetricKey
    | "overallAverage",
): number | null {
  let weightedTotal = 0;
  let weight = 0;

  for (const summary of summaries) {
    const value = summary[key];
    if (value === null || summary.responseCount <= 0) continue;
    weightedTotal += value * summary.responseCount;
    weight += summary.responseCount;
  }

  return weight > 0 ? round(weightedTotal / weight) : null;
}

function sum<T>(rows: readonly T[], valueOf: (row: T) => number): number {
  return rows.reduce((total, row) => total + valueOf(row), 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function comparePeriods(a: string, b: string): number {
  const aMatch = /^(\d{4})-([12])$/.exec(a);
  const bMatch = /^(\d{4})-([12])$/.exec(b);
  if (!aMatch && !bMatch) return a.localeCompare(b, "tr");
  if (!aMatch) return 1;
  if (!bMatch) return -1;
  return Number(aMatch[1]) - Number(bMatch[1]) || Number(aMatch[2]) - Number(bMatch[2]);
}
