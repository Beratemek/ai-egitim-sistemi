"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Isaretleme kutusu.
 *
 * Native `<input type="checkbox">` + `accent-color` yolu tarayiciya birakiyordu:
 * kose yaricapi, tik bicimi ve odak halkasi her tarayicida farkli, hicbirinde
 * arayuzun geri kalanina benzemiyordu. Burada kutu KENDIMIZ ciziliyor - girdi
 * gorunmez ama yerinde duruyor, boylece klavye, form gonderimi ve ekran
 * okuyucu davranisi native kaliyor.
 */

export interface CheckboxProps
  extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  /**
   * Kismi seçim. Native `indeterminate` bir HTML niteligi değil, DOM
   * ozelligidir; bu yuzden ref üzerinden atanir.
   */
  indeterminate?: boolean;
  /** Kagit gibi acik zeminlerde kullanilan koyu kenarlik varyanti. */
  tone?: "default" | "paper";
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, indeterminate = false, tone = "default", disabled, ...props },
    forwardedRef,
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <span
        className={cn(
          "relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center",
          disabled && "opacity-50",
          className,
        )}
      >
        <input
          ref={innerRef}
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[5px] border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed",
            tone === "paper"
              ? // Beyaz kagit uzerinde: tema renklerinden bagimsiz, her zaman acik zemin.
                "border-slate-400 bg-white hover:border-emerald-600 checked:border-emerald-600 checked:bg-emerald-600 indeterminate:border-emerald-600 indeterminate:bg-emerald-600 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-white"
              : "border-input bg-background hover:border-primary/60 checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:ring-ring/60 focus-visible:ring-offset-background",
          )}
          {...props}
        />

        {/*
          Tik isareti girdinin USTUNDE duruyor ve tiklamayi girdiye
          birakiyor (pointer-events-none). Yalnizca isaretliyken gorunur.
        */}
        <Check
          className={cn(
            "pointer-events-none absolute h-3 w-3 stroke-[3.5] opacity-0 transition-opacity",
            "peer-checked:opacity-100 peer-indeterminate:opacity-0",
            tone === "paper" ? "text-white" : "text-primary-foreground",
          )}
          aria-hidden
        />
        <Minus
          className={cn(
            "pointer-events-none absolute h-3 w-3 stroke-[3.5] opacity-0 transition-opacity",
            "peer-indeterminate:opacity-100",
            tone === "paper" ? "text-white" : "text-primary-foreground",
          )}
          aria-hidden
        />
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
