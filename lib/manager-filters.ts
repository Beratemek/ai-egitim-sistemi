import type { ManagerAnalyticsScope } from "@/lib/manager-analytics";

export interface ManagerAnalyticsSearchParams {
  ders?: string | string[];
  sinav?: string | string[];
  baslangic?: string | string[];
  bitis?: string | string[];
  esik?: string | string[];
}

export function managerScopeFromSearchParams(
  params: ManagerAnalyticsSearchParams,
): ManagerAnalyticsScope {
  const subject = single(params.ders);
  const examId = single(params.sinav);
  const dateFrom = validDate(single(params.baslangic));
  const dateTo = validDate(single(params.bitis));
  const parsedThreshold = Number(single(params.esik));
  const masteryThreshold = [50, 60, 70, 80].includes(parsedThreshold)
    ? parsedThreshold
    : undefined;

  return {
    ...(subject ? { subject } : {}),
    ...(examId ? { examId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(masteryThreshold ? { masteryThreshold } : {}),
  };
}

export function managerScopeQuery(scope: ManagerAnalyticsScope): string {
  const params = new URLSearchParams();
  if (scope.subject) params.set("ders", scope.subject);
  if (scope.examId) params.set("sinav", scope.examId);
  if (scope.dateFrom) params.set("baslangic", scope.dateFrom);
  if (scope.dateTo) params.set("bitis", scope.dateTo);
  if (scope.masteryThreshold) params.set("esik", String(scope.masteryThreshold));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function single(value: string | string[] | undefined): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  const normalized = item?.trim();
  return normalized || undefined;
}

function validDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value)
    ? value
    : undefined;
}
