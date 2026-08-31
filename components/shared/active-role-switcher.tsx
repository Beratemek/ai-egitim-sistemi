"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

import { setActiveRole } from "@/app/actions/admin";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isAdminPinned, ROLE_DEFINITIONS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

/**
 * Aktif rol degistirici.
 *
 * Bir hesaba birden fazla rol atanabilir (or. hem egitmen hem icerik uzmani).
 * Yetki her iki rolde de gecerlidir; bu dugme yalnizca HANGI PANELDE
 * calisildigini secer. Gelistirici rol taklidiyle karistirilmamali: burada
 * gercek roller arasinda gecis yapilir, taklit yoktur.
 *
 * Tek rolu olan kullanicida ve sistem yoneticisinde hic render edilmez.
 */

export interface ActiveRoleSwitcherProps {
  /** Su an aktif olan rol. */
  activeRole: UserRole;
  /** Kullaniciya verilmis roller. */
  roles: readonly UserRole[];
}

export function ActiveRoleSwitcher({ activeRole, roles }: ActiveRoleSwitcherProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (roles.length < 2) return null;

  /*
    Sistem yoneticisi kendi panelinde sabit: hesaba baska roller de atanmis
    olsa bile burada gecis sunulmaz (bkz. lib/roles.ts isAdminPinned).
  */
  if (isAdminPinned(roles)) return null;

  async function change(role: UserRole) {
    if (role === activeRole) return;

    setPending(true);
    try {
      const result = await setActiveRole(role);
      if (!result.ok) throw new Error(result.error);

      toast.success(`${ROLE_DEFINITIONS[role].label} paneline geçildi`);
      router.push(ROLE_DEFINITIONS[role].path);
    } catch (caught) {
      toast.error("Rol değiştirilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  const ActiveIcon = ROLE_ICONS[activeRole];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={pending}
          aria-label="Aktif rolü değiştir"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ActiveIcon className="h-3.5 w-3.5" />
          )}
          <span className="hidden max-w-[130px] truncate sm:inline">
            {ROLE_DEFINITIONS[activeRole].label}
          </span>
          <Repeat className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">Rol değiştir</p>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            Hesabınıza {roles.length} rol atanmış. Yetkileriniz hepsinde
            geçerlidir; buradan yalnızca hangi panelde çalışacağınızı seçersiniz.
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {roles.map((role) => {
          const Icon = ROLE_ICONS[role];

          return (
            <DropdownMenuItem
              key={role}
              disabled={pending}
              className="gap-2"
              onSelect={(event) => {
                event.preventDefault();
                void change(role);
              }}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{ROLE_DEFINITIONS[role].label}</span>
              {role === activeRole ? (
                <Check className="h-4 w-4 text-primary" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
