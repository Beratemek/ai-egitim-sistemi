import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Panelin giris noktalari.
 *
 * Genel bakis ekrani ozet gostermekte iyiydi ama BIR SEY YAPMAK icin once
 * sol menuye gitmek gerekiyordu; sayfanin kendisi hicbir ise baslamiyordu.
 * Bu serit en sik uc isi one alir ve uzerlerinde bekleyen is sayisini
 * tasir - "Sinav Kontrolu" yazan bir baglanti ile "Sinav Kontrolu · 12
 * bekliyor" yazan bir baglanti ayni sey degil.
 */

export interface QuickAction {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Uzerinde bekleyen is sayisi; 0 ise rozet cizilmez. */
  count?: number;
  /** Dikkat cekmesi gereken kutu (ornegin bekleyen onaylar). */
  emphasis?: boolean;
}

export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        const hasCount = (action.count ?? 0) > 0;

        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group flex items-start gap-3 rounded-xl border bg-card p-3.5 transition-colors sm:p-4",
              "hover:border-primary/50 hover:bg-accent/30",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              action.emphasis && hasCount && "border-warning/45 bg-warning/[0.04]",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                action.emphasis && hasCount
                  ? "bg-warning/15 text-warning"
                  : "bg-primary/10 text-primary",
              )}
              aria-hidden
            >
              <Icon className="h-4.5 w-4.5" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{action.label}</span>
                {hasCount ? (
                  <Badge variant={action.emphasis ? "warning" : "soft"}>
                    {action.count}
                  </Badge>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {action.description}
              </span>
            </span>

            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        );
      })}
    </div>
  );
}
