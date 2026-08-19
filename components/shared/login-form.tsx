"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["giris", "kayit"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
              setInfo(null);
            }}
            className={
              mode === value
                ? "rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {value === "giris" ? "Giris yap" : "Kayit ol"}
          </button>
        ))}
      </div>

      {mode === "kayit" ? (
        <>
          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
            <Label htmlFor="role">Rol</Label>
            <Select
              id="role"
              name="role"
              value={role}
              onChange={(event) => {
                const next = event.target.value;
                if (isUserRole(next)) setRole(next);
              }}
            >
              {ROLE_LIST.map((definition) => (
                <option key={definition.role} value={definition.role}>
                  {definition.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Demo amaclidir. Gercek kurulumda rol atamasi yonetici tarafindan yapilmalidir.
            </p>
          </div>
        </>
      ) : null}

      <div className="space-y-1.5">
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

      <div className="space-y-1.5">
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
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {info}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Lutfen bekleyin..." : mode === "giris" ? "Giris yap" : "Kayit ol"}
      </Button>
    </form>
  );
}

/** Supabase yapilandirilmadiginda gosterilen demo giris ekrani. */
function DemoModeNotice() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Supabase yapilandirilmamis.{" "}
        <code className="font-mono text-xs">.env.example</code> dosyasini{" "}
        <code className="font-mono text-xs">.env.local</code> olarak kopyalayip
        anahtarlari doldurun. O zamana kadar panelleri demo verisiyle gezebilirsiniz.
      </div>

      <div className="grid gap-2">
        {ROLE_LIST.map((definition) => (
          <Link
            key={definition.role}
            href={definition.path}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <span>
              <span className="font-medium">{definition.label}</span>
              <span className="block text-xs text-muted-foreground">
                {definition.description}
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
