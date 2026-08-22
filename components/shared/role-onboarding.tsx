"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { requestRole } from "@/app/actions/onboarding";
import { updateProfile } from "@/app/actions/profile";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECTABLE_ROLES } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ilk giriste profil + rol soran ekran.
 *
 * Iki adim tek sayfada: once AD SOYAD, sonra ROL. Ad zorunlu cunku sinav
 * kagidinda ve egitmenin cevap listesinde kullanicinin gorunen kimligi budur;
 * e-posta ise kimlik hesabindan gelir ve degistirilemez.
 *
 * DORT ROL de sistem yoneticisi onayindan gecer - ogrenci dahil. Onaya kadar
 * kullanicinin etkin rolu "ogrenci" kalir, yani bekleme ekranindayken
 * yetkili alanlara zaten erisemez.
 */

export interface RoleOnboardingProps {
  /** Profildeki ad; ilk giriste bos olabilir. */
  fullName: string;
  /** Kimlik hesabindaki adres; salt okunur gosterilir. */
  email: string;
  /** Daha once reddedilmis bir talebin ardindan yeniden seciyorsa. */
  previousRole?: UserRole | null;
  rejected?: boolean;
}

export function RoleOnboarding({
  fullName: initialFullName,
  email,
  previousRole = null,
  rejected = false,
}: RoleOnboardingProps) {
  const router = useRouter();

  const [fullName, setFullName] = React.useState(initialFullName);
  const [selected, setSelected] = React.useState<UserRole | null>(previousRole);
  const [pending, setPending] = React.useState(false);

  const trimmedName = fullName.trim();
  const nameValid = trimmedName.length >= 3;
  const canSubmit = nameValid && selected !== null && !pending;

  async function handleSubmit() {
    if (!selected || !nameValid) return;

    setPending(true);

    try {
      // Once profil: rol talebi onaya dustugunde yonetici kimi onayladigini
      // isimden gorebilmeli.
      const saved = await updateProfile({ fullName: trimmedName });
      if (!saved.ok) throw new Error(saved.error);

      const result = await requestRole(selected);
      if (!result.ok) throw new Error(result.error);

      if (result.data.status === "onayli") {
        toast.success("Hoş geldiniz!");
        router.replace("/dashboard");
      } else {
        toast.success("Talebiniz iletildi", {
          description:
            "Sistem yöneticisi onayladığında e-postanıza doğrulama bağlantısı gelir.",
        });
        router.replace("/onay-bekleniyor");
      }

      router.refresh();
    } catch (caught) {
      toast.error("Talep kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">
          {rejected ? "Başka bir rol seçin" : `Hoş geldiniz${firstName(trimmedName)}`}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rejected
            ? "Önceki talebiniz onaylanmadı. Dilerseniz farklı bir rol için yeniden başvurabilirsiniz."
            : "Başlamadan önce profilinizi tamamlayın ve sistemde ne yapacağınızı seçin."}
        </p>
      </div>

      {/* ---------- 1. Profil ---------- */}
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            1
          </span>
          <h2 className="text-sm font-medium">Profil bilgileriniz</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onboarding-name">Ad Soyad</Label>
            <Input
              id="onboarding-name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ayşe Yılmaz"
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-email">E-posta</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="onboarding-email"
                value={email || "-"}
                readOnly
                disabled
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2. Rol ---------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            2
          </span>
          <h2 className="text-sm font-medium">Rolünüz</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SELECTABLE_ROLES.map((definition) => {
            const Icon = ROLE_ICONS[definition.role];
            const isSelected = selected === definition.role;

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

                  <Badge variant="soft" className="gap-1 font-normal">
                    <ShieldCheck className="h-3 w-3" />
                    Onay gerekir
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
      </section>

      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Hangi rolü seçerseniz seçin talebiniz sistem yöneticisine iletilir.
          Onaylandığında e-posta adresinize doğrulama bağlantısı gönderilir.
        </span>
      </p>

      <Button
        size="lg"
        className="w-full"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        Onaya gönder
        {pending ? null : <ArrowRight />}
      </Button>

      {!nameValid && selected ? (
        <p className="text-center text-xs text-muted-foreground">
          Devam etmek için ad ve soyadınızı yazın.
        </p>
      ) : null}
    </div>
  );
}

/** "Hoş geldiniz, Berat" - ad yoksa sade selamlama. */
function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `, ${first}` : "";
}
