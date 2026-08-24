"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import type { QuestionVisual as QuestionVisualData } from "@/lib/visual";

/*
  Grafik motoru (recharts, ~130 kB) TALEP UZERINE yuklenir.

  Statik import edildiginde soru gosteren HER sayfanin ilk yukune giriyordu:
  icerik uzmani ekrani, ogrenci sinav ekrani, havuz onayi. Oysa sorularin
  cok azinda grafik var - grafiksiz bir sinava giren ogrenci de bedelini
  oduyordu. `ssr: false` cunku recharts olcum icin DOM'a ihtiyac duyuyor.
*/
const QuestionChart = dynamic(
  () => import("@/components/shared/question-chart").then((m) => m.QuestionChart),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg bg-muted/60" style={{ height: 130 }} />
    ),
  },
);

export interface QuestionVisualProps {
  visual: QuestionVisualData;
  /** Sik gorselleri kucuk cizilir. */
  compact?: boolean;
  className?: string;
}

/**
 * Bir soru gorselini cizer: grafik, sema ya da fotograf.
 *
 * Uc bicim de AYNI bilesenden geciyor - soru karti, havuz, sinav ekrani ve
 * onay diyalogu ayni gorunumu paylasiyor. Ogrencinin sinavda gordugu sey ile
 * uzmanin onayladigi sey birebir ayni olmali; iki ayri render yolu olsa
 * zamanla ayrisirdi.
 */
export function QuestionVisual({ visual, compact, className }: QuestionVisualProps) {
  // Once 240px'ti: iki sutunlu taslak gorunumunde bu, karta oranla asiri
  // buyuk duruyordu ("kocaman"). Dar bir kart icinde 200px hem grafigi
  // okunur tutuyor hem kartin cogunu kaplamiyor.
  const yukseklik = compact ? 130 : 200;

  if (visual.kind === "chart") {
    return (
      <figure className={cn("rounded-xl border bg-card/60 p-3", className)}>
        {visual.title ? (
          <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
            {visual.title}
          </figcaption>
        ) : null}
        <QuestionChart visual={visual} height={yukseklik} />
      </figure>
    );
  }

  if (visual.kind === "svg") {
    return (
      <figure className={cn("rounded-xl border bg-card/60 p-3", className)}>
        {visual.title ? (
          <figcaption className="mb-2 text-xs font-medium text-muted-foreground">
            {visual.title}
          </figcaption>
        ) : null}
        {/*
          dangerouslySetInnerHTML BILINCLI.

          SVG'yi calistirilabilir icerikten arindirmak `lib/visual.ts` icindeki
          `sanitizeSvg()` gorevi ve o fonksiyon veritabanina YAZILIRKEN de
          calisiyor. Burada yeniden temizlemek yanlis bir guven duygusu
          verirdi: tek dogru sinir yazma anidir, cunku okuma yollari birden
          fazla (kart, havuz, sinav, onay).

          Alternatif olarak <img src="data:image/svg+xml"> kullanilabilirdi ama
          o zaman cizim tema renklerini (currentColor) alamaz ve karanlik
          temada okunmaz hale gelirdi.
        */}
        {/*
          YUKSEKLIK SINIRI SVG'NIN KENDISINE VERILIR - sarmalayiciya degil.

          HATA: sinir yalnizca bu div'in `maxHeight`indeydi ve `overflow`
          serbestti. Veritabanindaki cizimler
              <svg viewBox="0 0 200 120" width="100%" height="100%">
          bicimde; `[&_svg]:h-auto` yuksekligi serbest birakinca SVG genisligi
          kartin tamamini (~1100px) aliyor ve en-boy orani geregi ~660px
          yukseklige uzuyordu. Sarmalayicinin maxHeight'i onu KIRPMIYORDU
          (overflow: visible); cizim asagi tasip siklarin uzerine biniyor,
          sorunun okunmasini engelliyordu.

          Simdi hem SVG'ye max-height veriliyor hem sarmalayiciya
          overflow-hidden konuyor. SVG'nin varsayilan
          preserveAspectRatio="xMidYMid meet" davranisi geregi cizim
          KIRPILMAZ; kutuya sigacak sekilde kucultulup ortalanir.
        */}
        <div
          className="overflow-hidden [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[var(--gorsel-en-fazla)] [&_svg]:w-full [&_svg]:max-w-full"
          style={
            {
              maxHeight: yukseklik * 1.4,
              "--gorsel-en-fazla": `${yukseklik * 1.4}px`,
            } as React.CSSProperties
          }
          dangerouslySetInnerHTML={{ __html: visual.svg }}
        />
      </figure>
    );
  }

  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-card/60", className)}>
      {/*
        next/image KULLANILMIYOR: kaynak Wikimedia gibi dis bir alan adi ve
        next.config icinde tek tek izin vermek gerekiyor. Duz <img> ile
        herhangi bir https kaynagi calisiyor; boyut sinirini stil veriyor.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={visual.url}
        alt={visual.alt}
        loading="lazy"
        className="w-full object-contain"
        style={{ maxHeight: yukseklik }}
      />
      <figcaption className="border-t px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {visual.alt ? <span className="block">{visual.alt}</span> : null}
        Kaynak: {visual.credit} · Lisans: {visual.license}
        {visual.sourceUrl ? (
          <>
            {" · "}
            <a
              href={visual.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-foreground"
            >
              dosya sayfası
            </a>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
