export interface RecommendationSource {
  topic: string;
  subject: string;
  outcomeId: string | null;
  outcomeText: string | null;
  averageScore: number;
  approvedAnswerCount: number;
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
}

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
        evidence: `${source.approvedAnswerCount} onayli cevapta ${source.averageScore}/100 ortalama`,
      };

      if (source.averageScore < 50) {
        return {
          ...base,
          priority: "yuksek" as const,
          priorityLabel: "Oncelikli tekrar",
          action:
            "Temel kavramlari kisa bir konu anlatimiyla tekrar et; ardindan 5 temel duzey soru coz.",
        };
      }

      if (source.averageScore < 75) {
        return {
          ...base,
          priority: "orta" as const,
          priorityLabel: "Pratik gerekli",
          action:
            "Yanlis yaptigin adimlari geri bildirimlerden incele ve ayni kazanimdan 3 uygulama sorusu coz.",
        };
      }

      return {
        ...base,
        priority: "pekistir" as const,
        priorityLabel: "Pekistir",
        action:
          "Basarini korumak icin daha zor bir uygulama sorusu coz ve cozumunu kendi cumlelerinle acikla.",
      };
    });
}
