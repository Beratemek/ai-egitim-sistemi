import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  FileText,
  ListChecks,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { QuestionStatus, QuestionType, SubmissionStatus, UserRole } from "@/lib/types";

type BadgeVariant = "soft" | "success" | "warning" | "danger" | "outline";

/**
 * Durum rozetleri her zaman IKON + ETIKET tasir.
 * Renk tek basina anlam taşımaz - renk korlugu ve tek renkli ciktilar icin gerekli.
 */
const QUESTION_STATUS_META: Record<
  QuestionStatus,
  { label: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  taslak: { label: "Taslak", variant: "warning", icon: CircleDashed },
  onayli: { label: "Onayli", variant: "success", icon: CheckCircle2 },
  reddedildi: { label: "Reddedildi", variant: "danger", icon: XCircle },
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const meta = QUESTION_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge variant={meta.variant} className="gap-1.5 font-medium">
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  gonderildi: { label: "Kaydedildi", variant: "soft", icon: FileText },
  ai_degerlendirildi: {
    label: "AI degerlendirdi",
    variant: "warning",
    icon: Sparkles,
  },
  egitmen_onayli: {
    label: "Egitmen onayladi",
    variant: "success",
    icon: ClipboardCheck,
  },
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const meta = SUBMISSION_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge variant={meta.variant} className="gap-1.5 font-medium">
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const Icon = type === "test" ? ListChecks : FileText;

  return (
    <Badge variant="outline" className="gap-1.5 font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {type === "test" ? "Coktan secmeli" : "Acik uclu"}
    </Badge>
  );
}

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const definition = ROLE_DEFINITIONS[role];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold",
        definition.badgeClass,
        className,
      )}
    >
      {definition.label}
    </span>
  );
}
