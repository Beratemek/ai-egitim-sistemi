"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import type { ChartVisual, QuestionVisual } from "@/lib/visual";

/**
 * Grafik renkleri.
 *
 * SABIT hex degerler kullaniliyor, tema degiskenleri DEGIL. Marka paleti
 * (zumrut + kehribar) bilerek dar tutulmus - ikisi de yesil/sicak tonda ve
 * uc seri bir grafige girince ayirt edilmesi zorlasiyordu. Veri gorsellestirme
 * ayri bir gorevdir: seriler birbirinden UZAK hue'lerde olmali. Bu renkler
 * hem karanlik hem `.exam-paper` (acik) zeminde okunur kaliyor.
 */
const SERI_RENKLERI = [
  "#2563eb", // mavi
  "#f97316", // turuncu
  "#16a34a", // yesil
  "#dc2626", // kirmizi
  "#7c3aed", // mor
];

const EKSEN_BICIMI = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
} as const;

/**
 * Basit deterministik hash - ayni metin her zaman ayni sayiyi verir.
 *
 * Renklerde "donen baslangic noktasi" icin kullaniliyor (asagida). Rastgele
 * degil BILEREK: ayni grafik yeniden render edildiginde (sayfa yenilense
 * bile) hep ayni renklerde cikmali, her seferinde farkli renk secmek
 * kullaniciyi sasirtirdi.
 */
function basitHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Bir grafigin renk paletini dondurur.
 *
 * Once her grafik SERI_RENKLERI'ni bastan (index 0'dan) kullaniyordu; iki
 * seri varsa HER GRAFIK hep mavi+turuncu oluyordu - kullaniciya "hep ayni
 * grafik" gibi gorunuyordu. Baslik/xKey'den turetilen bir "donme" (rotation)
 * ile farkli grafikler farkli renk ciftleriyle basliyor; AYNI grafik icinde
 * seriler yine birbirinden ayirt edilebilir kaliyor (renk cakismasi olmaz,
 * yalnizca hangi renkten baslandigi degisir).
 */
function paletOlustur(anahtar: string): (index: number) => string {
  const baslangic = basitHash(anahtar) % SERI_RENKLERI.length;
  return (index) => SERI_RENKLERI[(baslangic + index) % SERI_RENKLERI.length] as string;
}

/**
 * Grafik elementini dondurur.
 *
 * BILESEN DEGIL, DUZ FONKSIYON - ve bu bilincli. `ResponsiveContainer`
 * cocugunu klonlayip olculen `width`/`height` degerlerini ona gecirir; araya
 * bir React bileseni girerse o proplari BarChart'a iletmedigi icin grafik
 * 0x0 boyutunda cizilir: cerceve ve baslik gorunur, ic bombos kalir.
 * Fonksiyon olarak cagrilinca donen element dogrudan ResponsiveContainer'in
 * cocugu olur ve olculer yerine oturur.
 */
function chartBody(visual: ChartVisual): React.ReactElement {
  const { chartType, xKey, series, data } = visual;
  const renkAl = paletOlustur(visual.title ?? xKey);

  // Pie tek bir deger serisi cizer; birden fazla seri verilirse ilki alinir.
  // Seri listesi bos olamaz (parseVisual dogruluyor) ama tip guvenligi icin
  // kontrol ediliyor: bos gelirse sutun grafigine dusuluyor - null donmek
  // ResponsiveContainer'in tip sozlesmesini bozardi.
  const ilkSeri = series[0];

  if (chartType === "pie" && ilkSeri) {
    const seri = ilkSeri;
    return (
      <PieChart>
        <Tooltip />
        <Pie data={data} dataKey={seri.key} nameKey={xKey} outerRadius="75%" label>
          {data.map((_, index) => (
            <Cell key={index} fill={renkAl(index)} />
          ))}
        </Pie>
      </PieChart>
    );
  }

  if (chartType === "line") {
    return (
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} tick={EKSEN_BICIMI} />
        <YAxis tick={EKSEN_BICIMI} />
        <Tooltip />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
        {series.map((seri, index) => (
          <Line
            key={seri.key}
            type="monotone"
            dataKey={seri.key}
            name={seri.label}
            stroke={renkAl(index)}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    );
  }

  return (
    <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey={xKey} tick={EKSEN_BICIMI} />
      <YAxis tick={EKSEN_BICIMI} />
      <Tooltip />
      {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
      {series.map((seri, index) => (
        <Bar
          key={seri.key}
          dataKey={seri.key}
          name={seri.label}
          fill={renkAl(index)}
          radius={[4, 4, 0, 0]}
        />
      ))}
    </BarChart>
  );
}

export interface QuestionVisualProps {
  visual: QuestionVisual;
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
        <div style={{ height: yukseklik }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartBody(visual)}
          </ResponsiveContainer>
        </div>
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
        <div
          className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          style={{ maxHeight: yukseklik * 1.4 }}
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
