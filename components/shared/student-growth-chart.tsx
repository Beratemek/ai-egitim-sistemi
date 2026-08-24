"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StudentGrowthPoint {
  attemptId: string;
  examId: string;
  title: string;
  subject: string;
  completedAt: string;
  score: number;
}

type Range = "30" | "90" | "all";

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export function StudentGrowthChart({ points }: { points: StudentGrowthPoint[] }) {
  const [range, setRange] = React.useState<Range>("90");
  const [subject, setSubject] = React.useState("all");

  const subjects = React.useMemo(
    () => [...new Set(points.map((point) => point.subject))].sort(),
    [points],
  );

  const visible = React.useMemo(() => {
    const dayCount = range === "all" ? null : Number(range);
    const cutoff = dayCount
      ? Date.now() - dayCount * 24 * 60 * 60 * 1000
      : Number.NEGATIVE_INFINITY;

    return points
      .filter(
        (point) =>
          (subject === "all" || point.subject === subject) &&
          new Date(point.completedAt).getTime() >= cutoff,
      )
      .slice(-5)
      .map((point) => ({
        ...point,
        dateLabel: new Intl.DateTimeFormat("tr-TR", {
          day: "2-digit",
          month: "short",
        }).format(new Date(point.completedAt)),
      }));
  }, [points, range, subject]);

  const latest = visible.at(-1);
  const previous = visible.at(-2);
  const change =
    latest && previous ? Math.round((latest.score - previous.score) * 10) / 10 : null;

  return (
    <Card>
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div>
          <CardTitle>Zaman içinde gelişim</CardTitle>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Eğitmen onaylı son beş sınavını ve bir önceki sonuca göre değişimini izle.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Ders filtresi">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm dersler</SelectItem>
              {subjects.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-3 rounded-lg border bg-muted/20 p-1">
            {([
              ["30", "30 gün"],
              ["90", "90 gün"],
              ["all", "Tümü"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={range === value ? "default" : "ghost"}
                className="h-8 px-3"
                onClick={() => setRange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {visible.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
            Bu filtrelerde açıklanmış sınav sonucu bulunmuyor.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-muted/25 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Son sonuç</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {scoreFormatter.format(latest?.score ?? 0)} / 100
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Önceki sınava göre</p>
                <p
                  className={`mt-1 text-sm font-semibold tabular-nums ${
                    change === null
                      ? "text-muted-foreground"
                      : change >= 0
                        ? "text-primary"
                        : "text-destructive"
                  }`}
                >
                  {change === null
                    ? "Karşılaştırma için ikinci sonuç gerekli"
                    : `${change > 0 ? "+" : ""}${scoreFormatter.format(change)} puan`}
                </p>
              </div>
            </div>

            <div className="h-72 w-full" aria-label="Sınav puanlarının zaman grafiği">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visible} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} opacity={0.35} />
                  <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value) => [`${scoreFormatter.format(Number(value))} / 100`, "Puan"]}
                    labelFormatter={(_, payload) => payload[0]?.payload?.title ?? "Sınav"}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
