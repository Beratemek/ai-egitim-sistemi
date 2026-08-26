import Link from "next/link";
import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ALERT_TEXT, type ExamAlert } from "@/lib/exam-alerts";
import { cn } from "@/lib/utils";

export interface ExamStatusAlertsProps {
  alerts: readonly ExamAlert[];
  /** En fazla kac satir gosterilecek; kalani sayi olarak ozetlenir. */
  limit?: number;
}

/**
 * "Sessizce yanlis duran sinavlar" listesi.
 *
 * Genel bakis ekraninda sayilar zaten var ("4 sinav") ama sayi bir sinavin
 * YAYINDA OLUP kimseye atanmadigini soylemiyordu; o sinav kimse fark
 * etmeden orada duruyordu. Bu panel sayiyi degil YAPILACAK ISI gosterir:
 * her satir dogrudan o sinavin duzenleme ekranina baglanir.
 */
export function ExamStatusAlerts({ alerts, limit = 4 }: ExamStatusAlertsProps) {
  const visible = alerts.slice(0, limit);
  const warningCount = alerts.filter((alert) => alert.severity === "warning").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert
                className={cn(
                  "h-4.5 w-4.5",
                  warningCount > 0 ? "text-warning" : "text-muted-foreground",
                )}
              />
              Sınav durumu
            </CardTitle>
            <CardDescription>
              Dikkat isteyen sınavlar. Satıra tıklayınca o sınavın ekranı açılır.
            </CardDescription>
          </div>

          {warningCount > 0 ? (
            <Badge variant="warning">{warningCount} sınav dikkat istiyor</Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10">
              <CircleCheck className="h-5 w-5 text-success" />
            </span>
            <p className="font-medium">Her şey yolunda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Yayına alınmayı bekleyen, boş kalan ya da süresi dolduğu hâlde
              yayında duran sınav yok.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((alert) => {
              const text = ALERT_TEXT[alert.kind];

              return (
                <li key={`${alert.examId}-${alert.kind}`}>
                  <Link
                    href={`/dashboard/egitmen/sinavlar/${alert.examId}`}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border p-3 transition-colors",
                      "hover:border-primary/50 hover:bg-accent/30",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      alert.severity === "warning" &&
                        "border-warning/40 bg-warning/[0.04]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                        alert.severity === "warning" ? "bg-warning" : "bg-muted-foreground/40",
                      )}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {alert.examTitle}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {text.title}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
                      {text.action}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {alerts.length > visible.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {alerts.length - visible.length} sınav daha dikkat istiyor.{" "}
            <Link
              href="/dashboard/egitmen/sinavlar"
              className="font-medium text-primary hover:underline"
            >
              Tümünü görün
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
