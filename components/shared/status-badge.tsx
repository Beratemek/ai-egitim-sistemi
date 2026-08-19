import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { QuestionStatus, SubmissionStatus, UserRole } from "@/lib/types";

const QUESTION_STATUS_META: Record<
  QuestionStatus,
  { label: string; variant: "secondary" | "success" | "destructive" }
> = {
  taslak: { label: "Taslak", variant: "secondary" },
  onayli: { label: "Onayli", variant: "success" },
  reddedildi: { label: "Reddedildi", variant: "destructive" },
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const meta = QUESTION_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; variant: "secondary" | "warning" | "success" }
> = {
  gonderildi: { label: "Gonderildi", variant: "secondary" },
  ai_degerlendirildi: { label: "AI degerlendirdi", variant: "warning" },
  egitmen_onayli: { label: "Egitmen onayladi", variant: "success" },
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const meta = SUBMISSION_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const definition = ROLE_DEFINITIONS[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        definition.badgeClass,
        className,
      )}
    >
      {definition.label}
    </span>
  );
}

export function QuestionTypeBadge({ type }: { type: "test" | "acik_uclu" }) {
  return (
    <Badge variant="outline" className="border-border">
      {type === "test" ? "Coktan secmeli" : "Acik uclu"}
    </Badge>
  );
}
