"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ExamStatistics, Question, QuestionStatus } from "@/lib/types";
import type { ScoreTrendPoint } from "@/lib/mock-data";

/* --------------------------------------------------------------------------
 *  Renkler
 *
 *  Kategorik seriler ve durum renkleri dogrulanmis bir paletten alinmistir.
 *  Iki seri (mavi / turuncu) her iki temada da renk korlugu ayrimi ve
 *  yuzeye karsi 3:1 kontrast esiklerini gecer.
 *
 *  Durum renkleri (yesil / sari / kirmizi) sabittir ve HER ZAMAN ikon +
 *  etiketle birlikte kullanilir - anlam asla renge tek basina birakilmaz.
 * ------------------------------------------------------------------------ */

const SERIES_BLUE = { light: "#2a78d6", dark: "#3987e5" } as const;
const SERIES_ORANGE = { light: "#eb6834", dark: "#d95926" } as const;

const STATUS_COLORS: Record<QuestionStatus, string> = {
  onayli: "#0ca30c",
  taslak: "#fab219",
  reddedildi: "#d03b3b",
};

const STATUS_META: Record<QuestionStatus, { label: string; icon: LucideIcon }> = {
  onayli: { label: "Onayli", icon: CheckCircle2 },
  taslak: { label: "Taslak", icon: CircleDashed },
  reddedildi: { label: "Reddedildi", icon: XCircle },
};

/* ==========================================================================
 *  1. Sinav bazli ortalama puan  (tek seri -> lejant yok, dogrudan etiket)
 * ========================================================================== */

const examAverageConfig = {
  average: { label: "Ortalama puan", theme: SERIES_BLUE },
} satisfies ChartConfig;

export function ExamAverageChart({ data }: { data: readonly ExamStatistics[] }) {
  const rows = data
    .filter((row) => row.average_score !== null)
    .map((row) => ({
      name: row.exam_title,
      average: row.average_score ?? 0,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sinav bazli ortalama puan</CardTitle>
        <CardDescription>
          Egitmen onayi verilmis puanlar; onay bekleyenlerde AI on puani kullanilir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={examAverageConfig} className="h-[240px] w-full">
            <BarChart
              accessibilityLayer
              data={rows}
              layout="vertical"
              margin={{ left: 4, right: 48, top: 4, bottom: 4 }}
              barCategoryGap="32%"
              maxBarSize={26}
            >
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="tabular"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={168}
                fontSize={12}
                tickFormatter={(value: string) =>
                  value.length > 26 ? `${value.slice(0, 25)}...` : value
                }
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                content={<ChartTooltipContent />}
              />
              <Bar dataKey="average" fill="var(--color-average)" radius={[0, 4, 4, 0]}>
                {/* Tek seri: lejant yerine dogrudan deger etiketi */}
                <LabelList
                  dataKey="average"
                  position="right"
                  offset={8}
                  fontSize={12}
                  className="fill-foreground tabular"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ==========================================================================
 *  2. Soru havuzu durum dagilimi  (%100 yigilmis cubuk + ikonlu lejant)
 * ========================================================================== */

export function QuestionStatusChart({ questions }: { questions: readonly Question[] }) {
  const total = questions.length;

  const counts: Record<QuestionStatus, number> = {
    onayli: questions.filter((q) => q.status === "onayli").length,
    taslak: questions.filter((q) => q.status === "taslak").length,
    reddedildi: questions.filter((q) => q.status === "reddedildi").length,
  };

  const chartData = [
    {
      name: "Havuz",
      onayli: counts.onayli,
      taslak: counts.taslak,
      reddedildi: counts.reddedildi,
    },
  ];

  const config = {
    onayli: { label: "Onayli", color: STATUS_COLORS.onayli },
    taslak: { label: "Taslak", color: STATUS_COLORS.taslak },
    reddedildi: { label: "Reddedildi", color: STATUS_COLORS.reddedildi },
  } satisfies ChartConfig;

  const order: readonly QuestionStatus[] = ["onayli", "taslak", "reddedildi"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soru havuzu durumu</CardTitle>
        <CardDescription>
          Toplam {total} sorunun egitmen incelemesine gore dagilimi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <EmptyChart />
        ) : (
          <>
            <ChartContainer config={config} className="h-[72px] w-full">
              <BarChart
                accessibilityLayer
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                barSize={28}
              >
                <XAxis type="number" hide domain={[0, total]} />
                <YAxis type="category" dataKey="name" hide />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                {order.map((status, index) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    stackId="havuz"
                    fill={`var(--color-${status})`}
                    /* Segmentler arasi 2px yuzey bosluğu */
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    radius={
                      index === 0
                        ? [4, 0, 0, 4]
                        : index === order.length - 1
                          ? [0, 4, 4, 0]
                          : 0
                    }
                  />
                ))}
              </BarChart>
            </ChartContainer>

            {/* Ikon + etiket + sayi: anlam renge tek basina birakilmaz */}
            <ul className="space-y-2">
              {order.map((status) => {
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                const count = counts[status];
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <li
                    key={status}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: STATUS_COLORS[status] }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-sm">{meta.label}</span>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      {count}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        %{percentage}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ==========================================================================
 *  3. Basari trendi  (iki seri -> lejant + imlec ipucu)
 * ========================================================================== */

const trendConfig = {
  aiScore: { label: "AI on puani", theme: SERIES_BLUE },
  approvedScore: { label: "Egitmen onayli", theme: SERIES_ORANGE },
} satisfies ChartConfig;

export function ScoreTrendChart({ data }: { data: readonly ScoreTrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ortalama puan trendi</CardTitle>
        <CardDescription>
          AI&apos;in verdigi on puan ile egitmen onayindan sonraki nihai puanin
          hafta bazinda karsilastirmasi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={trendConfig} className="h-[280px] w-full">
            <LineChart
              accessibilityLayer
              data={[...data]}
              margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
            >
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                domain={[50, 90]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={36}
                className="tabular"
                fontSize={12}
              />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                dataKey="aiScore"
                type="monotone"
                stroke="var(--color-aiScore)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="approvedScore"
                type="monotone"
                stroke="var(--color-approvedScore)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      Gosterilecek veri yok.
    </div>
  );
}
