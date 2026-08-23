"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ROLE_ICONS } from "@/components/shared/role-icons";
import { cn } from "@/lib/utils";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

/** Rol basina sol menu ogeleri. */
const BASE_NAV = {
  icerik_uzmani: [
    {
      href: "/dashboard/icerik-uzmani",
      label: "İçerik & Kazanımlar",
      icon: BookOpen,
      description: "Metin yükle, AI ile soru üret",
    },
    {
      href: "/dashboard/icerik-uzmani/soru-havuzu",
      label: "Soru Havuzu Onayı",
      icon: ListChecks,
      description: "Ders ve konu bazlı oku, onayla",
    },
  ],
  egitmen: [
    {
      href: "/dashboard/egitmen",
      label: "Genel Bakış",
      icon: LayoutDashboard,
      description: "Sınavlar ve puan onayları",
    },
    {
      href: "/dashboard/egitmen/soru-havuzu",
      label: "Soru Havuzu",
      icon: Library,
      description: "Ders bazlı havuz, sınava soru ekle",
    },
    {
      href: "/dashboard/egitmen/kontrol",
      label: "Sınav Kontrolü",
      icon: ClipboardCheck,
      description: "Sınıf bazlı bütün değerlendirme",
    },
    {
      href: "/dashboard/egitmen/sinavlar",
      label: "Sınavlar",
      icon: ClipboardList,
      description: "Sınav oluştur, yayına al, PDF indir",
    },
  ],
  ogrenci: [
    {
      href: "/dashboard/ogrenci",
      label: "Sınavlarım",
      icon: GraduationCap,
      description: "Soruları yanıtla",
    },
    {
      href: "/dashboard/ogrenci/sonuclar",
      label: "Sonuçlarım",
      icon: Trophy,
      description: "Onaylanan puan ve geri bildirimler",
    },
    {
      href: "/dashboard/ogrenci/gelisim",
      label: "Gelişimim",
      icon: TrendingUp,
      description: "Kazanım bazlı ilerlemeni izle",
    },
  ],
  egitim_yoneticisi: [
    {
      href: "/dashboard/yonetici",
      label: "İstatistikler",
      icon: BarChart3,
      description: "Başarı ve katılım raporları",
    },
  ],
} satisfies Record<Exclude<UserRole, "admin">, readonly NavItem[]>;

/**
 * Rol basina sol menu.
 *
 * `admin` SISTEMI yonetir: roller, kullanicilar, siniflar ve panel ayarlari.
 * Soru uretmek, sinav olusturmak, cevap onaylamak gibi ROL ISLERI menusunde
 * YOKTUR - onlar ilgili rollerin isidir. Yonetici bu islere karismasi
 * gerekiyorsa kendisine o rolu de atatir (bkz. coklu rol).
 */
export const ROLE_NAV: Record<UserRole, readonly NavItem[]> = {
  ...BASE_NAV,
  admin: [
    {
      href: "/dashboard/sistem",
      label: "Rol Onayları",
      icon: UserCog,
      description: "Bekleyen rol taleplerini karara bağla",
    },
    {
      href: "/dashboard/sistem/kullanicilar",
      label: "Kullanıcılar",
      icon: Users,
      description: "Rol, sınıf ve ders yetkisi düzenle",
    },
  ],
};

export interface NavLinksProps {
  role: UserRole;
  /** Mobil cekmecede baglantiya tiklandiginda paneli kapatmak için. */
  onNavigate?: () => void;
}

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const items = ROLE_NAV[role];

  /**
   * Secili menu ogesi: EN UZUN eslesen yol.
   *
   * Menu ogeleri ic ice: /dashboard/egitmen hem kendisi hem de
   * /dashboard/egitmen/kontrol icin eslesir. "onek eslesirse secili" kurali
   * ust ve alt ogeyi AYNI ANDA yakardi; en uzun eslesme alt ogeyi kazandirir.
   * Hicbir alt oge eslesmiyorsa (or. /dashboard/ogrenci/sinav/<id>) ust oge
   * secili kalir - istenen davranis budur.
   */
  const activeHref = React.useMemo(() => {
    let best: string | null = null;

    for (const item of items) {
      const matches =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (best === null || item.href.length > best.length)) {
        best = item.href;
      }
    }

    return best;
  }, [items, pathname]);

  return (
    /*
      Menu ogeleri RAFTAKI KITAP gibi kuruldu: her ogenin solunda kendi
      renginde bir sirt duruyor, secilen kitap raftan bir tik disari
      cikiyor. Duz bir baglanti listesi yerine bu secildi cunku urunun
      gorsel dili zaten kitaplik; menu de o dilin parcasi olmali.

      Sirt renkleri sabit sirayla dagitiliyor: menu ogeleri az ve degismez
      oldugu icin her sayfa her zaman AYNI rengi tasiyor - kullanici bir
      sure sonra rengi tanir hale geliyor.
    */
    <nav className="relative space-y-1.5 pl-1">
      {items.map((item, index) => {
        const isActive = item.href === activeHref;
        const Icon = item.icon;
        const book = (index % 8) + 1;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-stretch gap-3 overflow-hidden rounded-md rounded-l-sm py-2.5 pl-4 pr-3 text-sm",
              "transition-[transform,background-color,color] duration-200",
              isActive
                ? "translate-x-1.5 bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:translate-x-1 hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {/* Kitap sirti: renk + iki bant + sirt cizgisi */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-0 w-[7px] transition-opacity",
                isActive ? "opacity-100" : "opacity-60 group-hover:opacity-85",
              )}
              style={{ background: `hsl(var(--book-${book}))` }}
            >
              <span className="absolute inset-x-0 top-[7px] h-[2px] bg-background/60" />
              <span className="absolute inset-x-0 bottom-[7px] h-[2px] bg-background/60" />
            </span>

            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            />

            <span className="flex flex-col">
              <span className="font-medium leading-tight">{item.label}</span>
              <span className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}

      {/* Kitaplarin uzerinde durdugu raf */}
      <span
        aria-hidden
        className="mt-2 block h-[3px] rounded-full bg-foreground/15"
      />
    </nav>
  );
}

export function RoleCard({ role }: { role: UserRole }) {
  const definition = ROLE_DEFINITIONS[role];
  const Icon = ROLE_ICONS[role];

  /*
    Once rolun ham Tailwind rozet rengi (violet/sky/amber...) kartin
    TAMAMINA veriliyordu. O renkler tema jetonlarina bagli olmadigi icin yeni
    paletle catisiyor, kart menunun geri kalanina yabanci duruyordu.

    Simdi renk yalnizca INCE bir aksan: ustte bir serit ve ikon kabi. Rol
    yine ilk bakista ayirt ediliyor ama kart kendi zeminine oturuyor.
  */
  const book = definition.book;

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `hsl(var(--book-${book}))` }}
      />

      <div className="p-3 pt-3.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ background: `hsl(var(--book-${book}) / 0.16)` }}
          >
            <Icon
              className="h-3.5 w-3.5"
              style={{ color: `hsl(var(--book-${book}))` }}
            />
          </span>
          <p className="text-sm font-semibold">{definition.label}</p>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {definition.description}
        </p>
      </div>
    </div>
  );
}
