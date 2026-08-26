import { DatabaseZap } from "lucide-react";

import type { ManagerOverview } from "@/lib/manager-analytics";

export function ManagerDataQualityNotice({
  overview,
}: {
  overview: Pick<
    ManagerOverview,
    "excludedOutcomeEvidenceCount" | "draftAnswerCount"
  >;
}) {
  if (overview.excludedOutcomeEvidenceCount === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/35 bg-warning/10 p-3.5 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
        <DatabaseZap className="h-4 w-4" />
      </span>
      <div>
        <p className="font-semibold text-foreground">Veri tutarlılığı notu</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {overview.excludedOutcomeEvidenceCount} onaylı kayıt; sınav henüz
          sonuçlanmadığı veya soru-puan bağı bulunmadığı için kazanım puanına
          katılmadı. {overview.draftAnswerCount > 0 ? `${overview.draftAnswerCount} taslak yanıt ayrıca puan dışında.` : ""}
        </p>
      </div>
    </div>
  );
}
