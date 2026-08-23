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
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { cn } from "@/lib/utils";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { QuestionStatus, QuestionType, SubmissionStatus, UserRole } from "@/lib/types";

type BadgeVariant = "soft" | "success" | "warning" | "danger" | "outline";

/**
 * Durum rozetleri her zaman IKON + ETIKET taşır.
 * Renk tek basina anlam taşımaz - renk korlugu ve tek renkli ciktilar için gerekli.
 */
const QUESTION_STATUS_META: Record<
  QuestionStatus,
  { label: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  taslak: { label: "Taslak", variant: "warning", icon: CircleDashed },
  onayli: { label: "Onaylı", variant: "success", icon: CheckCircle2 },
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
    label: "AI değerlendirdi",
    variant: "warning",
    icon: Sparkles,
  },
  egitmen_onayli: {
    label: "Eğitmen onayladı",
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
      {type === "test" ? "Çoktan seçmeli" : "Açık uçlu"}
    </Badge>
  );
}

/**
 * Rol rozeti.
 *
 * Rengi `--book-N` jetonundan alir, yani menudeki kitap sirtlariyla ayni
 * paletten. Onceki surum ham Tailwind renkleri (sky/violet/amber) tasiyordu;
 * o renkler temaya bagli olmadigi icin koyu temada donuk bir zemine oturuyor
 * ve panelin geri kalanina yabanci duruyordu.
 *
 * ETIKET rengi bilerek `foreground`: kitap renklerinin bazilari (altin
 * sarisi, hardal) acik temada kucuk yazi icin yeterli kontrasti vermiyor.
 * Renk ikonda ve zeminde yasiyor, okunakliligi metin tasiyor. Ayni sebeple
 * rozet her zaman IKON + ETIKET goruntuler - renk tek basina anlam tasimaz.
 */
export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const definition = ROLE_DEFINITIONS[role];
  const Icon = ROLE_ICONS[role];
  const renk = `var(--book-${definition.book})`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md py-0.5 pl-1.5 pr-2",
        "text-xs font-medium leading-5 text-foreground ring-1 ring-inset",
        className,
      )}
      style={{
        background: `hsl(${renk} / 0.14)`,
        // ring-inset rengi: Tailwind'in ring-<color> jetonu dinamik
        // olamadigi icin CSS degiskeni uzerinden veriliyor.
        ["--tw-ring-color" as string]: `hsl(${renk} / 0.35)`,
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${renk})` }} />
      {definition.label}
    </span>
  );
}

/**
 * "+2" gibi sayac rozeti: kisinin varsayilan rolunun yaninda kalan rol sayisi.
 *
 * Bilerek notr: yanindaki renkli rol rozetiyle yarismasin, goz once
 * varsayilan role gitsin.
 */
export function RoleCountBadge({
  count,
  title,
  className,
}: {
  count: number;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5",
        "text-xs font-medium leading-5 text-muted-foreground ring-1 ring-inset ring-border",
        className,
      )}
    >
      +{count}
    </span>
  );
}
