"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";

import { requestRole } from "@/app/actions/onboarding";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SELECTABLE_ROLES } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ilk giriste "kim oldugunuzu" soran ekran.
 *
 * Ogrenci secimi dogrudan onaylanir. Diger roller yetki tasidigi icin egitim
 * yoneticisi onayina duser; onaya kadar kullanicinin etkin rolu 'ogrenci'
 * kalir, yani bekleme ekranindayken yetkili alanlara zaten erisemez.
 */

export interface RoleOnboardingProps {
  /** Karsilama metninde kullanilir. */
  fullName: string;
  /** Daha once reddedilmis bir talebin ardindan yeniden seciyorsa. */
  previousRole?: UserRole | null;
  rejected?: boolean;
}

export function RoleOnboarding({
  fullName,
  previousRole = null,
  rejected = false,
}: RoleOnboardingProps) {
  const router = useRouter();

  const [selected, setSelected] = React.useState<UserRole | null>(previousRole);
  const [pending, setPending] = React.useState(false);

  const needsApproval = selected !== null && selected !== "ogrenci";

  async function handleSubmit() {
    if (!selected) return;

    setPending(true);

    try {
      const result = await requestRole(selected);
      if (!result.ok) throw new Error(result.error);

      if (result.data.status === "onayli") {
        toast.success("Hos geldiniz!");
        router.replace("/dashboard");
      } else {
        toast.success("Talebiniz iletildi", {
          description: "Egitim yoneticisi onayladiginda panele girebilirsiniz.",
        });
        router.replace("/onay-bekleniyor");
      }

      router.refresh();
    } catch (caught) {
      toast.error("Talep kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lutfen tekrar deneyin.",
      });
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {rejected ? "Baska bir rol secin" : `Hos geldiniz${firstName(fullName)}`}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rejected
            ? "Onceki talebiniz onaylanmadi. Dilerseniz farkli bir rol icin yeniden basvurabilirsiniz."
            : "Sistemde ne yapacaksiniz? Rolunuze gore farkli bir panel acilir."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SELECTABLE_ROLES.map((definition) => {
          const Icon = ROLE_ICONS[definition.role];
          const isSelected = selected === definition.role;
          const instant = definition.role === "ogrenci";

          return (
            <button
              key={definition.role}
              type="button"
              onClick={() => setSelected(definition.role)}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors",
                "hover:border-primary/50 hover:bg-accent/40",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isSelected && "border-primary bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {isSelected ? (
                    <Check className="h-4.5 w-4.5" />
                  ) : (
                    <Icon className="h-4.5 w-4.5" />
                  )}
                </span>

                <Badge
                  variant={instant ? "success" : "soft"}
                  className="gap-1 font-normal"
                >
                  {instant ? (
                    <>
                      <Zap className="h-3 w-3" />
                      Dogrudan giris
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3 w-3" />
                      Onay gerekir
                    </>
                  )}
                </Badge>
              </div>

              <div>
                <p className="font-medium leading-snug">{definition.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {definition.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {needsApproval ? (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Bu rol yetki tasidigi icin talebiniz egitim yoneticisine iletilir.
            Onaylanana kadar bekleme ekraninda kalirsiniz.
          </span>
        </p>
      ) : null}

      <Button
        size="lg"
        className="w-full"
        disabled={!selected || pending}
        onClick={() => void handleSubmit()}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {needsApproval ? "Onaya gonder" : "Devam et"}
        {pending ? null : <ArrowRight />}
      </Button>
    </div>
  );
}

/** "Hos geldiniz, Berat" - ad yoksa sade selamlama. */
function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `, ${first}` : "";
}
