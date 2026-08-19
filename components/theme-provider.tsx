"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/** next-themes sarmalayicisi. Tema sinifi <html> uzerine `.dark` olarak yazilir. */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
