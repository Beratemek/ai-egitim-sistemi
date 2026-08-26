"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Açık/koyu tema anahtarı.
 *
 * Tema yalnızca tarayicida bilinir; sunucu ciktisi her zaman "acik" varsayar.
 * Bu yuzden ikon VE aria-label mount sonrasina kadar sabit tutulur - aksi
 * halde hidrasyon uyusmazligi oluşur.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mounted ? (isDark ? "Açık temaya geç" : "Koyu temaya geç") : "Tema"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={!mounted}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
