"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, GraduationCap, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { updateProfile } from "@/app/actions/profile";
import { RoleBadge } from "@/components/shared/status-badge";
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
import type { UserProfile, UserRole } from "@/lib/types";

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
}

export function ProfileForm({ profile, roles }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [pending, setPending] = React.useState(false);

  const dirty = fullName.trim() !== (profile.full_name ?? "").trim();
  const isStudent = roles.includes("ogrenci");

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
        <CardTitle>Profil bilgileri</CardTitle>
        <CardDescription>
          Adınız sınav kâğıtlarında ve eğitmenin cevap listesinde görünür.
          E-posta, rol ve sınıf bilgisi buradan değiştirilemez.
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

          <div className="grid gap-4 sm:grid-cols-2">
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

            {isStudent ? (
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

          <div className="space-y-2">
            <Label>Rolleriniz</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Rol değişikliği sistem yöneticisi onayıyla yapılır.
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
