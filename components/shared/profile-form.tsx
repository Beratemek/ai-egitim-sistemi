"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Check,
  GraduationCap,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { updateProfile } from "@/app/actions/profile";
import { RoleBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import { hasAllSubjects, subjectLabel } from "@/lib/subjects";
import type { UserProfile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Kullanicinin kendi profili.
 *
 * Yalnizca AD SOYAD duzenlenebilir. E-posta kimlik dogrulamasindan gelir ve
 * degistirilemez; rol ve sinif ise sistem yoneticisinin belirledigi
 * alanlardir - burada okunur, degistirilemez. Kullanici kendi rolunu
 * degistirebilseydi yetki yukseltme kapisi acilirdi.
 */

export interface ProfileFormProps {
  profile: UserProfile;
  /** Kullaniciya verilmis roller (kume). */
  roles: readonly UserRole[];
  /**
   * Su an hangi rolun panelindeyse o.
   *
   * Profil bu role gore degisir: egitmen panelindeyken egitmen profili,
   * ogrenci panelindeyken sinifini iceren ogrenci profili gorunur. Coklu
   * rolu olan kullanicinin tum alanlarini ust uste yigmak yerine icinde
   * bulundugu baglami gostermek dogru olan.
   */
  activeRole: UserRole;
  /** Egitmenin yetkili oldugu dersler; sistem yoneticisi atar. */
  subjects?: readonly string[];
}

export function ProfileForm({
  profile,
  roles,
  activeRole,
  subjects = [],
}: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [pending, setPending] = React.useState(false);

  const dirty = fullName.trim() !== (profile.full_name ?? "").trim();
  // Sinif yalnizca OGRENCI panelinde anlamli - egitmen profilinde degil.
  const isStudentPanel = activeRole === "ogrenci";
  const isInstructorPanel = activeRole === "egitmen";
  const activeDefinition = ROLE_DEFINITIONS[activeRole];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      const result = await updateProfile({ fullName });
      if (!result.ok) throw new Error(result.error);

      toast.success("Profil kaydedildi");
      router.refresh();
    } catch (caught) {
      toast.error("Profil kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{activeDefinition.label} profili</CardTitle>
        <CardDescription>
          Ad soyadınız her panelde ortaktır. Aşağıdaki diğer bilgiler
          {" "}
          <span className="font-medium text-foreground">
            {activeDefinition.label.toLocaleLowerCase("tr")}
          </span>{" "}
          rolünüze aittir; e-posta, rol ve sınıf bilgisi buradan
          değiştirilemez.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Ad Soyad</Label>
            <Input
              id="profile-name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ayşe Yılmaz"
              autoComplete="name"
            />
            <p className="text-xs text-muted-foreground">
              Adınızı ve soyadınızı birlikte yazın.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-email">E-posta</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  value={profile.email ?? "-"}
                  readOnly
                  disabled
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Giriş yaptığınız adres; değiştirilemez.
              </p>
            </div>

            {isStudentPanel ? (
              <div className="space-y-2">
                <Label htmlFor="profile-classroom">Sınıf</Label>
                <div className="relative">
                  <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-classroom"
                    value={profile.classroom ?? "Henüz atanmadı"}
                    readOnly
                    disabled
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sınıfınızı sistem yöneticisi belirler.
                </p>
              </div>
            ) : null}
          </div>

          {isInstructorPanel ? (
            <div className="space-y-2">
              <Label>Ders yetkileriniz</Label>
              {subjects.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                  Henüz ders atanmamış. Yalnızca kendi oluşturduğunuz sınavları
                  görebilirsiniz.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((subject) => (
                    <Badge key={subject} variant="soft" className="gap-1.5">
                      <BookMarked className="h-3 w-3" />
                      {subjectLabel(subject)}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {hasAllSubjects(subjects)
                  ? "Her dersteki sınavı ve öğrenci cevaplarını görürsünüz; sonradan eklenen dersler de kapsanır. Ders yetkisini sistem yöneticisi verir."
                  : "Yalnızca bu derslerdeki sınavları ve öğrenci cevaplarını görürsünüz. Ders yetkisini sistem yöneticisi verir."}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Rolleriniz</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {roles.map((role) => (
                <span
                  key={role}
                  className={cn(
                    "rounded-md",
                    role === activeRole
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "opacity-60",
                  )}
                >
                  <RoleBadge role={role} />
                </span>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {roles.length > 1
                ? "Şu an çerçeveli roldesiniz. Üst çubuktaki rol değiştiriciyle geçiş yapınca bu profil de o role göre değişir."
                : "Rol değişikliği sistem yöneticisi onayıyla yapılır."}
            </p>
          </div>

          <Button type="submit" disabled={!dirty || pending} className="gap-2">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Kaydet
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
