import { Badge } from "@/components/ui/badge";
import type { ManagerRiskLevel } from "@/lib/manager-analytics";

const RISK_META = {
  risk: { label: "Müdahale gerekli", variant: "danger" },
  watch: { label: "Yakından izle", variant: "warning" },
  good: { label: "İyi ilerliyor", variant: "success" },
  unmeasured: { label: "Henüz ölçülmedi", variant: "soft" },
} as const;

export function ManagerRiskBadge({ level }: { level: ManagerRiskLevel }) {
  const meta = RISK_META[level];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function ManagerScore({ score }: { score: number | null }) {
  return (
    <span className="font-semibold tabular-nums">
      {score === null ? "—" : `${score.toLocaleString("tr-TR")} / 100`}
    </span>
  );
}
