"use client";

import * as React from "react";
import { FlaskConical, Check } from "lucide-react";

import { switchDevRole, clearDevRole } from "@/app/actions/dev-auth";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LIST } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export interface DevRoleSwitcherProps {
  /** Su an arayuzde gecerli olan rol. */
  currentRole: UserRole;
  /** Veritabanindaki gercek rol. */
  actualRole: UserRole;
  /** Taklit aktif mi? */
  impersonating: boolean;
}

/**
 * Yerel gelistirmede tek hesapla dort rolu de gezebilmek icin rol degistirici.
 * Yalnizca `isDevRoleSwitchEnabled` true iken render edilir (bkz. dashboard-shell).
 */
export function DevRoleSwitcher({
  currentRole,
  actualRole,
  impersonating,
}: DevRoleSwitcherProps) {
  const [pending, startTransition] = React.useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={impersonating ? "default" : "outline"}
          size="sm"
          className="gap-2"
          disabled={pending}
          aria-label="Gelistirici rol degistirici"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Rol</span>
          {impersonating ? (
            <Badge
              variant="soft"
              className="hidden bg-white/20 text-inherit sm:inline-flex"
            >
              taklit
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">Gelistirici rol degistirici</p>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            Yalnizca arayuzu degistirir; veritabani yetkileri gercek hesabiniza
            gore calismaya devam eder.
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {ROLE_LIST.map((definition) => {
          const Icon = ROLE_ICONS[definition.role];
          const isCurrent = definition.role === currentRole;

          return (
            <DropdownMenuItem
              key={definition.role}
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  await switchDevRole(definition.role);
                });
              }}
              className="gap-2"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{definition.label}</span>
              {definition.role === actualRole ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  gercek
                </span>
              ) : null}
              {isCurrent ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}

        {impersonating ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  await clearDevRole();
                });
              }}
              className="text-muted-foreground"
            >
              Taklidi kaldir
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
