import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  /**
   * Kartin rengi. Iki ayri is icin iki ayri set var:
   *
   * DURUM renkleri - kart gercekten bir HAL anlatiyorsa:
   *   warning  ->  DIKKAT isteyen durum (bekleyen is, eksik kayit)
   *   success  ->  gercekten IYI olan bir durum (hedef tutmus oran)
   *   Bunlar AYRILMISTIR: yalnizca bir sayaci renklendirmek icin
   *   kullanilmamali - kullanildiginda rengin anlami bosalir ve gercek
   *   uyarilar goze carpmaz olur.
   *
   * KATEGORIK slotlar - kart bir METRIGI temsil ediyorsa (KPI satiri):
   *   cat1..cat4  ->  kimlik tasir, "iyi/kotu" anlatmaz. Dordu ayni
   *   doygunluk/aciklikta, yalnizca hue'de ayrisir. Slot sirasi SABIT
   *   tutulmali - bir kart eklenip cikarilinca kalan kartlarin rengi
   *   degismemeli.
   *
   * Bir satirda IKI seti KARISTIRMA: ya hepsi kategorik ya notr sayaclar +
   * tek durum vurgusu. Ikisi bir arada oldugunda hangi rengin sinyal
   * hangisinin kimlik oldugu okunamaz hale gelir.
   */
  accent?:
    | "default"
    | "primary"
    | "warning"
    | "success"
    | "cat1"
    | "cat2"
    | "cat3"
    | "cat4";
  className?: string;
}

/**
 * Her renk icin IKI sinif: kartin kendi seffaf zemini + ikon cipi.
 *
 * Once yalnizca ikon cipi renkliydi; 40x40 pikselik bir kare, yanindaki
 * buyuk beyaz kartin icinde kayboluyordu ve satir "sonuk" gorunuyordu.
 * Rengi KARTIN TAMAMINA yaymak kimligi okunur kiliyor.
 *
 * Zemin cok DUSUK opaklikta (%6): kart hala "kagit" hissi veriyor ve
 * uzerindeki metin kontrastini kaybetmiyor. Daha yuksek bir deger metni
 * okunmaz yapar ve satiri afis gibi gosterir. Kenarlik biraz daha belirgin
 * (%25) - karti zeminden ayiran sey o.
 */
const ACCENT_STYLES: Record<
  NonNullable<StatCardProps["accent"]>,
  { card: string; chip: string }
> = {
  default: { card: "", chip: "bg-muted text-muted-foreground" },
  primary: {
    card: "border-primary/25 bg-primary/[0.06]",
    chip: "bg-primary/10 text-primary",
  },
  warning: {
    card: "border-warning/25 bg-warning/[0.06]",
    chip: "bg-warning/10 text-warning",
  },
  success: {
    card: "border-success/25 bg-success/[0.06]",
    chip: "bg-success/10 text-success",
  },
  cat1: {
    card: "border-stat-1/25 bg-stat-1/[0.06]",
    chip: "bg-stat-1/15 text-stat-1",
  },
  cat2: {
    card: "border-stat-2/25 bg-stat-2/[0.06]",
    chip: "bg-stat-2/15 text-stat-2",
  },
  cat3: {
    card: "border-stat-3/25 bg-stat-3/[0.06]",
    chip: "bg-stat-3/15 text-stat-3",
  },
  cat4: {
    card: "border-stat-4/25 bg-stat-4/[0.06]",
    chip: "bg-stat-4/15 text-stat-4",
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "default",
  className,
}: StatCardProps) {
  const stil = ACCENT_STYLES[accent];

  return (
    <Card className={cn("overflow-hidden", stil.card, className)}>
      <CardContent className="flex items-start justify-between gap-3 p-3.5 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-1 font-display text-2xl sm:mt-2 sm:text-3xl">{value}</p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>

        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10",
              stil.chip,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
