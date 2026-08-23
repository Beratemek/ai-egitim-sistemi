"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Menu, UserRound } from "lucide-react";

import { NavLinks, RoleCard } from "@/components/shared/app-nav";
import { ActiveRoleSwitcher } from "@/components/shared/active-role-switcher";
import { BrandMark } from "@/components/shared/brand-mark";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export interface DashboardShellProps {
  /** Basliklarda ve rol kartinda gosterilen rol. */
  role: UserRole;
  /** Kullaniciya verilmis roller; birden fazlaysa rol degistirici cikar. */
  grantedRoles?: readonly UserRole[];
  fullName: string;
  /** Supabase yapilandirilmadiginda demo rozeti gösterilir. */
  demoMode?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  grantedRoles = [],
  fullName,
  demoMode = false,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const definition = ROLE_DEFINITIONS[role];
  const RoleIcon = ROLE_ICONS[role];

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");

  return (
    <div className="bg-study min-h-screen bg-background">
      {/*
        Kenar kitapliklari (SideBooks) KALDIRILDI.

        Genis ekranlarda icerik sutununun iki yanindaki bos seritleri
        dolduruyorlardi, ama calisma ekraninda dikkat dagitiyordu: sagdaki raf
        icerigin hemen yaninda durdugu icin goz surekli oraya kayiyordu.
        Soldaki zaten opak sol menunun (z-30) arkasinda kaliyor, hic
        gorunmuyordu - yani tek etkisi bosuna render'di.

        Bilesen duruyor (components/shared/side-books.tsx); geri istenirse
        buraya iki satir eklemek yetiyor. Giris ve karsilama sayfalarindaki
        BookshelfBackdrop'a dokunulmadi - orasi calisma ekrani degil.
      */}

      {/* ---------- Masaustu sol menu ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r bg-card lg:flex">
        {/* Menunun dibinde ince bir kitap rafi: bos kalan alani urunun
            kimligiyle dolduruyor, hicbir bilgi tasimiyor. */}
        <div
          className="bg-shelf pointer-events-none absolute inset-x-0 bottom-0 h-28 opacity-[0.5]"
          aria-hidden
        />
        <div className="flex h-16 items-center border-b px-5">
          <BrandMark />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Menü
          </p>
          <NavLinks role={role} />
        </div>

        <div className="border-t p-3">
          <RoleCard role={role} />
        </div>
      </aside>

      {/* ---------- İçerik sutunu ---------- */}
      <div className="relative z-10 lg:pl-[264px]">
        {/* ---------- Üst cubuk ---------- */}
        <header className="safe-top sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          {/* Mobil cekmece */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Menüyü ac"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="h-16 justify-center border-b px-5 text-left">
                <SheetTitle asChild>
                  <div>
                    <BrandMark />
                  </div>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Panel gezinti menüsü
                </SheetDescription>
              </SheetHeader>

              <div className="px-3 py-4">
                <NavLinks role={role} onNavigate={() => setMobileOpen(false)} />
              </div>

              <div className="px-3">
                <RoleCard role={role} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobilde marka, masaustunde rol başlığı */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="lg:hidden">
              <BrandMark />
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <RoleIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-display text-[15px] font-semibold">
                {definition.label} Paneli
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {demoMode ? (
              <Badge variant="warning" className="hidden sm:inline-flex">
                Tanıtım modu
              </Badge>
            ) : null}

            <ActiveRoleSwitcher activeRole={role} roles={grantedRoles} />

            <ThemeToggle />

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 gap-2 px-2"
                  aria-label="Hesap menüsü"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                    {fullName}
                  </span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{fullName}</p>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    {definition.label}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profil" className="flex items-center gap-2">
                    <UserRound className="h-4 w-4" />
                    Profilim
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action="/auth/signout" method="post" className="w-full">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Çıkış yap
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="animate-kitap-yukselir mx-auto w-full max-w-[1400px] space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
