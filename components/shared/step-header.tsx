import type { LucideIcon } from "lucide-react";

export interface StepHeaderProps {
  /** Adim numarasi; akisin kacinci halkasi oldugunu gosterir. */
  step: number;
  title: string;
  description?: string;
  icon?: LucideIcon;
}

/**
 * Bir sayfa bolumunun basligi - numarali.
 *
 * Icerik uzmani ekrani sirali bir AKIS: kazanim tanimla -> soru uret ->
 * havuza onayla. Bolumler once numarasiz kartlar halinde diziliydi ve
 * hangisinin once geldigi belli olmuyordu; kazanim formu bile uretimin
 * ALTINDA duruyordu. Numara, sirayi ekranda gorunur kiliyor.
 */
export function StepHeader({ step, title, description, icon: Icon }: StepHeaderProps) {
  return (
    <div className="flex items-start gap-3 border-b pb-3 pt-2">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {step}
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" /> : null}
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
