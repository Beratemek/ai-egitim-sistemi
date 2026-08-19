"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";

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
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LIST, dashboardPathFor } from "@/lib/roles";
import { createClient } from "@/lib/supabase";
import { isUserRole, type UserRole } from "@/lib/types";

type Mode = "giris" | "kayit";

export function LoginForm() {
  const router = useRouter();

  const [mode, setMode] = React.useState<Mode>("giris");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("ogrenci");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

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
          },
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setInfo(
            "Kayit alindi. E-posta dogrulamasi acikssa gelen kutunuzu kontrol edin, ardindan giris yapin.",
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
      setError(
        caught instanceof Error
          ? caught.message
          : "Beklenmeyen bir hata olustu. Lutfen tekrar deneyin.",
      );
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
          <TabsTrigger value="giris">Giris yap</TabsTrigger>
          <TabsTrigger value="kayit">Kayit ol</TabsTrigger>
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
              placeholder="Ayse Yilmaz"
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
                {ROLE_LIST.map((definition) => {
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
              Demo amaclidir. Gercek kurulumda rol atamasi yonetici tarafindan yapilmalidir.
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
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
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
            {mode === "giris" ? "Giris yap" : "Kayit ol"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

/** Supabase yapilandirilmadiginda gosterilen demo giris ekrani. */
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
          Rol secerek devam edin
        </p>

        {ROLE_LIST.map((definition) => {
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
