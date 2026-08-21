"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, MailCheck, TriangleAlert } from "lucide-react";

import { GoogleSignInButton } from "@/components/shared/google-sign-in-button";
import { ResendConfirmation } from "@/components/shared/resend-confirmation";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { SELECTABLE_ROLES, dashboardPathFor } from "@/lib/roles";
import { createClient } from "@/lib/supabase";
import { isUserRole, type UserRole } from "@/lib/types";

type Mode = "giris" | "kayit";

export interface LoginFormProps {
  /** /auth/callback tarafından ?error= ile tasinan hata mesaji. */
  callbackError?: string | null;
}

export function LoginForm({ callbackError = null }: LoginFormProps) {
  const router = useRouter();

  const [mode, setMode] = React.useState<Mode>("giris");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("ogrenci");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(callbackError);
  const [info, setInfo] = React.useState<string | null>(null);
  /** Supabase "email not confirmed" dediyse yeniden gonderme secenegi sunulur. */
  const [unconfirmed, setUnconfirmed] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    try {
      const supabase = createClient();

      if (mode === "kayit") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // `handle_new_user` trigger'i bu meta veriden rolu okuyup
            // public.users profilini olusturur.
            data: { full_name: fullName, role },
            // Dogrulama e-postasindaki baglanti buraya doner. Belirtilmezse
            // Supabase "Site URL" koküne doner, oradaki ?code=... hicbir yerde
            // islenmez ve kullanıcı dogrulamaya ragmen oturum acmamis olur.
            emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setInfo(
            "Kayıt alındı. E-posta doğrulaması açıksa gelen kutunuzu kontrol edin, ardından giriş yapın.",
          );
          setMode("giris");
          return;
        }

        router.replace(dashboardPathFor(role));
        router.refresh();
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const resolvedRole: UserRole = isUserRole(profile?.role) ? profile.role : "ogrenci";

      router.replace(dashboardPathFor(resolvedRole));
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Beklenmeyen bir hata oluştu. Lutfen tekrar deneyin.";

      // Supabase bu durumda "Email not confirmed" döndürür.
      setUnconfirmed(/not confirmed/i.test(message));
      setError(message);
    } finally {
      setPending(false);
    }
  }

  if (!isSupabaseConfigured) {
    return <DemoModeNotice />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value as Mode);
          setError(null);
          setInfo(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="giris">Giriş yap</TabsTrigger>
          <TabsTrigger value="kayit">Kayıt ol</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "kayit" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ayse Yılmaz"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                if (isUserRole(value)) setRole(value);
              }}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_ROLES.map((definition) => {
                  const Icon = ROLE_ICONS[definition.role];
                  return (
                    <SelectItem key={definition.role} value={definition.role}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {definition.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Seçtiğiniz rol sistem yöneticisinin onayına düşer. Onaylandığında
              e-posta adresinize doğrulama bağlantısı gönderilir.
            </p>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ornek@okul.edu.tr"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Parola</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "kayit" ? "new-password" : "current-password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>

          {unconfirmed ? (
            <ResendConfirmation email={email} />
          ) : null}
        </div>
      ) : null}

      {info ? (
        <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {info}
        </p>
      ) : null}

      <Button type="submit" className="w-full gap-2" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Lutfen bekleyin...
          </>
        ) : (
          <>
            {mode === "giris" ? "Giriş yap" : "Kayıt ol"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">veya</span>
        </div>
      </div>

      <GoogleSignInButton disabled={pending} />
    </form>
  );
}

/** Supabase yapilandirilmadiginda gosterilen demo giriş ekrani. */
function DemoModeNotice() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Supabase yapilandirilmamis. <code className="font-mono text-xs">.env.example</code>{" "}
          dosyasini <code className="font-mono text-xs">.env.local</code> olarak kopyalayip
          anahtarlari doldurun. O zamana kadar panelleri demo verisiyle gezebilirsiniz.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rol seçerek devam edin
        </p>

        {SELECTABLE_ROLES.map((definition) => {
          const Icon = ROLE_ICONS[definition.role];

          return (
            <Link
              key={definition.role}
              href={definition.path}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{definition.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {definition.description}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
