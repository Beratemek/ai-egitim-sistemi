"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { evaluatePasswordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

interface PasswordFieldProps
  extends Omit<React.ComponentProps<typeof Input>, "type"> {
  showStrength?: boolean;
}

const BOOK_HEIGHTS = ["h-3.5", "h-5", "h-6", "h-7"] as const;

/** Göster/gizle denetimi ve isteğe bağlı kitap sırtı güç göstergesi. */
export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      className,
      showStrength = false,
      value,
      "aria-describedby": describedBy,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const password = typeof value === "string" ? value : "";
    const strength = evaluatePasswordStrength(password);
    const strengthId = props.id ? `${props.id}-strength` : undefined;

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? "text" : "password"}
            value={value}
            className={cn("pr-11", className)}
            aria-describedby={
              [describedBy, showStrength ? strengthId : null].filter(Boolean).join(" ") ||
              undefined
            }
            {...props}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={visible ? "Parolayı gizle" : "Parolayı göster"}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        </div>

        {showStrength ? (
          <div
            id={strengthId}
            className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div
                className="relative flex h-8 items-end gap-1 border-b border-foreground/20 px-1 pb-0.5"
                role="progressbar"
                aria-label="Parola gücü"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={strength.score}
              >
                {BOOK_HEIGHTS.map((height, index) => {
                  const active = index < strength.score;
                  return (
                    <span
                      key={height}
                      className={cn(
                        "w-2.5 origin-bottom rounded-[2px_2px_1px_1px] border transition-[transform,background-color,border-color,opacity] duration-500 ease-out motion-reduce:transition-none",
                        height,
                        active
                          ? "scale-y-100 border-primary bg-primary opacity-100"
                          : "scale-y-50 border-border bg-background opacity-55",
                      )}
                      style={{ transitionDelay: `${index * 55}ms` }}
                      aria-hidden
                    />
                  );
                })}
              </div>

              <div className="min-w-0 text-right">
                <p className="text-xs font-semibold text-foreground">{strength.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {strength.hint}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
