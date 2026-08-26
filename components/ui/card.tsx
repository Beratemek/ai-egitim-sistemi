import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Golge azaltildi, kenarlik one cikti: hazir sablonlarin agir "yuzen kart"
    // gorunumu yerine basili bir foy hissi.
    "rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // Telefonda p-6 kartlari gereksiz buyutuyordu; taban daraltildi,
    // genis ekranda eski olcu korunuyor.
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/*
 * `pt-0` ARTIK KOSULLU: yalnizca ustunde bir kardes (CardHeader) varken.
 *
 * SORUN: taban sinif `p-4 pt-0 sm:p-6 sm:pt-0` idi. `pt-0` "ustumde zaten
 * CardHeader var, ust boslugu O versin" demek icin konmustu. Ama kod
 * tabaninda CardHeader'siz, dogrudan CardContent iceren 22 kart var (bos
 * durum kutulari, ozet seritleri...). Onlarin hepsi ust boslugunu
 * kaybediyordu.
 *
 * Cagiran taraf `py-6` yazinca da kurtulamiyordu: tailwind-merge
 * `sm:pt-0` ile sade `py-6`yi FARKLI gruplar sayar (biri sm: varyantli,
 * digeri degil), ikisi de hayatta kalir ve 640px ustunde `sm:pt-0` kazanir.
 * Olculdu (sinif ozeti karti, 1440px):
 *       padding-top = 0px,  padding-bottom = 24px
 * Icerik kartin ust cizgisine yapisik, tum bosluk altta birikmis.
 * "Uste yapisik" sikayetlerinin kaynagi buydu.
 *
 * `:not(:first-child)` tam olarak "ustumde bir sey var" demek: header'li
 * kartlarda eski davranis aynen korunur, header'siz kartlar dogal ust
 * boslugunu geri alir ve icerik dikeyde ortalanir.
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-4 sm:p-6 [&:not(:first-child)]:pt-0", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0 sm:p-6 sm:pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
