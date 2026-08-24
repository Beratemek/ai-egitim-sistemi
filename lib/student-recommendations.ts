export interface RecommendationSource {
  topic: string;
  subject: string;
  outcomeId: string | null;
  outcomeText: string | null;
  averageScore: number;
  approvedAnswerCount: number;
  latestExamId?: string | null;
}

export type StudyPriority = "yuksek" | "orta" | "pekistir";

export interface StudyRecommendation {
  id: string;
  title: string;
  context: string;
  priority: StudyPriority;
  priorityLabel: string;
  action: string;
  evidence: string;
  outcomeId: string | null;
  latestExamId: string | null;
}

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

/** En dusuk kazanımlardan baslayarak uygulanabilir, veri destekli calisma adimi uretir. */
export function buildStudyRecommendations(
  sources: readonly RecommendationSource[],
  limit = 3,
): StudyRecommendation[] {
  if (limit <= 0) return [];

  return [...sources]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, limit)
    .map((source) => {
      const base = {
        id: source.outcomeId ?? `${source.subject}:${source.topic}`,
        title: source.outcomeText ?? source.topic,
        context: `${source.subject} · ${source.topic}`,
        evidence: `${source.approvedAnswerCount} onaylı cevap üzerinden ${scoreFormatter.format(source.averageScore)}/100 ortalama`,
        outcomeId: source.outcomeId,
        latestExamId: source.latestExamId ?? null,
      };

      if (source.averageScore < 50) {
        return {
          ...base,
          priority: "yuksek" as const,
          priorityLabel: "Öncelikli tekrar",
          action:
            "Temel kavramları kısa bir konu anlatımıyla tekrar et; ardından 5 temel düzey soru çöz.",
        };
      }

      if (source.averageScore < 75) {
        return {
          ...base,
          priority: "orta" as const,
          priorityLabel: "Pratik gerekli",
          action:
            "Yanlış yaptığın adımları geri bildirimlerden incele ve aynı kazanımdan 3 uygulama sorusu çöz.",
        };
      }

      return {
        ...base,
        priority: "pekistir" as const,
        priorityLabel: "Pekiştir",
        action:
          "Başarını korumak için daha zor bir uygulama sorusu çöz ve çözümünü kendi cümlelerinle açıkla.",
      };
    });
}
