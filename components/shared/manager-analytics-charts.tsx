"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

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
import type {
  ManagerClassroomSummary,
  ManagerOutcomeSummary,
  ManagerTrendPoint,
} from "@/lib/manager-analytics";

const comparisonConfig = {
  averageScore: { label: "Ortalama puan", color: "hsl(var(--stat-1))" },
  completionRate: { label: "Teslim oranı", color: "hsl(var(--stat-2))" },
} satisfies ChartConfig;

export function ManagerClassroomChart({
  classrooms,
}: {
  classrooms: readonly ManagerClassroomSummary[];
}) {
  const data = classrooms.map((classroom) => ({
    classroom: classroom.name,
    averageScore: classroom.averageScore ?? 0,
    completionRate: classroom.completionRate,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Sınıf karşılaştırması</CardTitle>
        <CardDescription>
          Nihai puan ortalaması ile sınav teslim oranı aynı ölçekte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart label="Karşılaştırılacak sınıf yok." />
        ) : (
          <ChartContainer config={comparisonConfig} className="h-[290px] w-full">
            <ComposedChart
              accessibilityLayer
              data={data}
              margin={{ left: 0, right: 10, top: 12, bottom: 4 }}
            >
              <defs>
                <linearGradient id="manager-class-bars" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-averageScore)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-averageScore)" stopOpacity={0.48} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="classroom" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={34} />
              <ChartTooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="averageScore"
                fill="url(#manager-class-bars)"
                radius={[7, 7, 2, 2]}
                maxBarSize={38}
                animationDuration={850}
              />
              <Line
                dataKey="completionRate"
                type="monotone"
                stroke="var(--color-completionRate)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "var(--color-completionRate)" }}
                activeDot={{ r: 5 }}
                animationDuration={1050}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const trendConfig = {
  averageScore: { label: "Sınav ortalaması", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export function ManagerScoreTrendChart({
  data,
}: {
  data: readonly ManagerTrendPoint[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Değerlendirme eğrisi</CardTitle>
        <CardDescription>Sonuçlanan son sekiz sınavın kronolojik hareketi.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart label="Henüz sonuçlanan sınav yok." />
        ) : (
          <ChartContainer config={trendConfig} className="h-[290px] w-full">
            <AreaChart
              accessibilityLayer
              data={[...data]}
              margin={{ left: 0, right: 10, top: 12, bottom: 4 }}
            >
              <defs>
                <linearGradient id="manager-score-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-averageScore)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-averageScore)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={34} />
              <ChartTooltip
                cursor={{ stroke: "hsl(var(--border))" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => payload[0]?.payload.fullLabel ?? "Sınav"}
                  />
                }
              />
              <Area
                dataKey="averageScore"
                type="monotone"
                fill="url(#manager-score-area)"
                stroke="var(--color-averageScore)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                animationDuration={1050}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const outcomeConfig = {
  averageScore: { label: "Kazanım puanı", color: "hsl(var(--book-8))" },
} satisfies ChartConfig;

export function ManagerOutcomeRiskChart({
  outcomes,
}: {
  outcomes: readonly ManagerOutcomeSummary[];
}) {
  const rows = outcomes
    .filter((outcome) => outcome.averageScore !== null)
    .slice(0, 7)
    .map((outcome) => ({
      label:
        outcome.outcomeText.length > 34
          ? `${outcome.outcomeText.slice(0, 33)}…`
          : outcome.outcomeText,
      fullLabel: outcome.outcomeText,
      averageScore: outcome.averageScore,
    }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Öncelikli kazanımlar</CardTitle>
        <CardDescription>En düşük onaylı puandan başlayarak ilk yedi alan.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart label="Ölçülmüş kazanım bulunmuyor." />
        ) : (
          <ChartContainer config={outcomeConfig} className="h-[320px] w-full">
            <BarChart
              accessibilityLayer
              data={rows}
              layout="vertical"
              margin={{ left: 0, right: 28, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={176}
                fontSize={11}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted) / 0.45)" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => payload[0]?.payload.fullLabel ?? "Kazanım"}
                  />
                }
              />
              <Bar
                dataKey="averageScore"
                fill="var(--color-averageScore)"
                radius={[2, 7, 7, 2]}
                maxBarSize={22}
                animationDuration={900}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[230px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
