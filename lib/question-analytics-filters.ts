import type { Question } from "@/lib/types";
import type { QuestionAnalyticsScope } from "@/lib/question-analytics";

export interface QuestionAnalyticsSearchParams {
  ders?: string | string[];
  sinav?: string | string[];
  sinif?: string | string[];
  tur?: string | string[];
  baslangic?: string | string[];
  bitis?: string | string[];
}

export function questionAnalyticsScopeFromSearchParams(
  params: QuestionAnalyticsSearchParams,
): QuestionAnalyticsScope {
  const subject = single(params.ders);
  const examId = single(params.sinav);
  const classroom = single(params.sinif);
  const rawType = single(params.tur);
  const questionType: Question["type"] | undefined =
    rawType === "test" || rawType === "acik_uclu" ? rawType : undefined;
  const dateFrom = validDate(single(params.baslangic));
  const dateTo = validDate(single(params.bitis));
  return {
    ...(subject ? { subject } : {}),
    ...(examId ? { examId } : {}),
    ...(classroom ? { classroom } : {}),
    ...(questionType ? { questionType } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };
}

function single(value: string | string[] | undefined): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.trim() || undefined;
}

function validDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value)
    ? value
    : undefined;
}
