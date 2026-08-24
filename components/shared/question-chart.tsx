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
  XAxis,
  YAxis,
} from "recharts";

import type { ChartVisual } from "@/lib/visual";

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

/**
 * Grafik cizimi. AYRI DOSYADA ve TEMBEL YUKLENIR.
 *
 * `recharts` yaklasik 130 kB. Statik import edildiginde soru gosteren HER
 * sayfanin ilk yukune giriyordu - icerik uzmani ekrani, ogrenci sinav
 * ekrani, havuz onayi. Oysa sorularin cok azinda grafik var; grafiksiz bir
 * sinava giren ogrenci de bedelini oduyordu.
 *
 * Artik yalnizca `visual.kind === "chart"` olan bir gorsel cizilecegi zaman
 * inidiriliyor (bkz. question-visual.tsx icindeki dynamic import).
 */
export function QuestionChart({
  visual,
  height,
}: {
  visual: ChartVisual;
  height: number;
}) {
  /*
    SORU GRAFIGI ETKILESIMSIZDIR - bir RESIM gibi durur.

    Recharts varsayilan olarak fare uzerine gelince deger balonu (Tooltip) ve
    vurgu imleci gosterir. Burasi bir gosterge paneli DEGIL, sinav sorusunun
    govdesi: ogrenciye/egitmene grafigin uzerinde gezinip sayi okutmak
    sorunun kendisini degistirebilir (grafikten okunmasi istenen degeri
    balon dogrudan soyler). Uc <Tooltip /> kaldirildi.

    pointer-events-none: balon gitse de vurgu imleci ve imlec degisimi
    kalirdi; grafigin tiklanabilir/incelenebilir bir sey oldugu izlenimini
    tumuyle kaldiriyoruz. aria-hidden DEGIL - ekran okuyucu icin baslik ve
    cevre metin duruyor.
  */
  return (
    <div style={{ height }} className="pointer-events-none select-none">
      <ResponsiveContainer width="100%" height="100%">
        {chartBody(visual)}
      </ResponsiveContainer>
    </div>
  );
}
