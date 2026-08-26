/**
 * Rol ikonlari.
 *
 * ONEMLI: Bu dosya bilerek "use client" TASIMAZ. Sunucu bilesenleri de
 * (ornegin ana sayfa) bu haritayi indeksliyor; bir istemci modulunden
 * export edilseydi RSC sinirinda istemci referansina donusur ve
 * `ROLE_ICONS[role]` sunucuda `undefined` olurdu.
 */

import {
  BarChart3,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { UserRole } from "@/lib/types";

export const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  icerik_uzmani: FileQuestion,
  egitmen: ClipboardCheck,
  ogrenci: GraduationCap,
  veli: HeartHandshake,
  egitim_yoneticisi: BarChart3,
  admin: ShieldCheck,
};
