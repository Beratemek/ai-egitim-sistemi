"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COURSE_FEEDBACK_METRICS,
  COURSE_FEEDBACK_PRIVACY_THRESHOLD,
  analyzeCourseFeedback,
  type CourseFeedbackComparison,
} from "@/lib/course-feedback-analytics";
import { courseFeedbackPeriodLabel } from "@/lib/course-feedback";
import type { CourseFeedbackSummary } from "@/lib/queries";

const metricChartConfig = {
  average: { label: "Ortalama", color: "hsl(var(--stat-1))" },
} satisfies ChartConfig;

const trendChartConfig = {
  average: { label: "Genel deneyim", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const comparisonChartConfig = {
  average: { label: "Genel deneyim", color: "hsl(var(--stat-2))" },
} satisfies ChartConfig;

type ComparisonMode = "subjects" | "instructors";

export function ManagerCourseFeedbackDashboard({
  summaries,
}: {
  summaries: readonly CourseFeedbackSummary[];
}) {
  const [period, setPeriod] = React.useState("all");
  const [subject, setSubject] = React.useState("all");
  const [instructor, setInstructor] = React.useState("all");
  const [comparisonMode, setComparisonMode] =
    React.useState<ComparisonMode>("subjects");

  const periods = React.useMemo(
    () =>
      [...new Set(summaries.map((summary) => summary.academicPeriod))].sort(
        (a, b) => b.localeCompare(a, "tr"),
      ),
    [summaries],
  );
  const subjects = React.useMemo(
    () =>
      [...new Set(summaries.map((summary) => summary.subject))].sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [summaries],
  );
  const instructors = React.useMemo(
    () =>
      [...new Map(
        summaries.map((summary) => [
          summary.instructorId,
          summary.instructorName,
        ]),
      ).entries()].sort((a, b) => a[1].localeCompare(b[1], "tr")),
    [summaries],
  );
  const filtered = React.useMemo(
    () =>
      summaries.filter(
        (summary) =>
          (period === "all" || summary.academicPeriod === period) &&
          (subject === "all" || summary.subject === subject) &&
          (instructor === "all" || summary.instructorId === instructor),
      ),
    [instructor, period, subject, summaries],
  );
  const analytics = React.useMemo(
    () => analyzeCourseFeedback(filtered),
    [filtered],
  );
  const hasFilters =
    period !== "all" || subject !== "all" || instructor !== "all";
  const comparisons =
    comparisonMode === "subjects"
      ? analytics.subjects
      : analytics.instructors;

  if (summaries.length === 0) return <FeedbackEmptyState />;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/[0.045]">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Anonimlik koruması etkin</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Öğrenci kimliği ve tekil yanıtlar bu ekrana gelmez. Aynı
              ders–eğitmen–dönem grubunda en az {COURSE_FEEDBACK_PRIVACY_THRESHOLD} değerlendirme
              oluşmadan puanlar ve yorumlar açılmaz.
            </p>
          </div>
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
            Toplu rapor
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center">
          <div className="grid flex-1 gap-2 sm:grid-cols-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger aria-label="Dönem filtresi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm dönemler</SelectItem>
                {periods.map((item) => (
                  <SelectItem key={item} value={item}>
                    {courseFeedbackPeriodLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger aria-label="Ders filtresi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm dersler</SelectItem>
                {subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={instructor} onValueChange={setInstructor}>
              <SelectTrigger aria-label="Eğitmen filtresi"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm eğitmenler</SelectItem>
                {instructors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasFilters}
            onClick={() => {
              setPeriod("all");
              setSubject("all");
              setInstructor("all");
            }}
          >
            <RotateCcw />
            Filtreleri temizle
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Anonim değerlendirme"
          value={analytics.totalResponses}
          hint={`${analytics.groupCount} ders grubu`}
          icon={MessageSquareText}
          accent="cat1"
        />
        <StatCard
          label="Raporlanabilir grup"
          value={analytics.reportableGroupCount}
          hint={`${analytics.protectedGroupCount} grup eşik bekliyor`}
          icon={UsersRound}
          accent="cat2"
        />
        <StatCard
          label="Genel deneyim"
          value={formatRating(analytics.overallAverage)}
          hint={`${analytics.ratedResponseCount} görünür yanıt · 5 üzerinden`}
          icon={Star}
          accent="cat3"
        />
        <StatCard
          label="Öncelikli alan"
          value={formatRating(analytics.weakestMetric?.average ?? null)}
          hint={analytics.weakestMetric?.label ?? "Henüz ölçülmedi"}
          icon={AlertTriangle}
          accent="cat4"
        />
      </div>

      {filtered.length === 0 ? (
        <FilteredEmptyState />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <MetricChart analytics={analytics} />
            <TrendChart periods={analytics.periods} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
            <ComparisonChart
              rows={comparisons}
              mode={comparisonMode}
              onModeChange={setComparisonMode}
            />
            <InsightCard analytics={analytics} />
          </div>

          <FeedbackGroupTable summaries={filtered} />

          <div className="grid gap-6 xl:grid-cols-2">
            <CommentStream
              title="Geliştirme önerileri"
              description="Tekrarlayan ihtiyaçları ders ve dönem bağlamıyla birlikte okuyun."
              summaries={filtered}
              kind="improvement"
            />
            <CommentStream
              title="Faydalı bulunanlar"
              description="Korunması ve yaygınlaştırılması gereken uygulamalar."
              summaries={filtered}
              kind="helpful"
            />
          </div>
        </>
      )}
    </div>
  );
}

function MetricChart({
  analytics,
}: {
  analytics: ReturnType<typeof analyzeCourseFeedback>;
}) {
  const data = analytics.metrics.map((metric) => ({
    label: metric.label,
    average: metric.average,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Deneyim boyutları</CardTitle>
        <CardDescription>Filtrelenen grupların yanıt sayısıyla ağırlıklandırılmış ortalaması.</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.overallAverage === null ? (
          <ChartEmpty />
        ) : (
          <ChartContainer config={metricChartConfig} className="h-[300px] w-full">
            <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="feedback-metric-bars" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-average)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-average)" stopOpacity={0.48} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(2)} / 5`} />} />
              <Bar dataKey="average" fill="url(#feedback-metric-bars)" radius={[7, 7, 2, 2]} maxBarSize={54} animationDuration={850} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({
  periods,
}: {
  periods: ReturnType<typeof analyzeCourseFeedback>["periods"];
}) {
  const data = periods
    .filter((point) => point.average !== null)
    .map((point) => ({
      ...point,
      label: courseFeedbackPeriodLabel(point.period).replace(" · ", " "),
    }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Dönemsel eğilim</CardTitle>
        <CardDescription>Genel ders deneyiminin dönemler arasındaki hareketi.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ChartContainer config={trendChartConfig} className="h-[300px] w-full">
            <AreaChart accessibilityLayer data={data} margin={{ top: 12, right: 10, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="feedback-trend-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-average)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-average)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(2)} / 5`} />} />
              <Area dataKey="average" type="monotone" fill="url(#feedback-trend-area)" stroke="var(--color-average)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={1000} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonChart({
  rows,
  mode,
  onModeChange,
}: {
  rows: readonly CourseFeedbackComparison[];
  mode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
}) {
  const data = rows
    .filter((row) => row.average !== null)
    .slice(0, 8)
    .map((row) => ({
      label: shorten(row.label, 28),
      fullLabel: row.label,
      average: row.average,
      responses: row.ratedResponseCount,
    }));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Karşılaştırmalı görünüm</CardTitle>
          <CardDescription>En düşük deneyim puanından başlayarak öncelik sırası.</CardDescription>
        </div>
        <div className="grid grid-cols-2 rounded-lg border bg-muted/20 p-1">
          <Button type="button" size="sm" variant={mode === "subjects" ? "default" : "ghost"} className="h-8" onClick={() => onModeChange("subjects")}>Ders</Button>
          <Button type="button" size="sm" variant={mode === "instructors" ? "default" : "ghost"} className="h-8" onClick={() => onModeChange("instructors")}>Eğitmen</Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ChartContainer config={comparisonChartConfig} className="h-[340px] w-full">
            <BarChart accessibilityLayer data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={154} fontSize={11} />
              <ChartTooltip labelFormatter={(_, payload) => payload[0]?.payload.fullLabel ?? "Grup"} content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(2)} / 5`} />} />
              <Bar dataKey="average" fill="var(--color-average)" radius={[2, 7, 7, 2]} maxBarSize={23} animationDuration={900} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCard({
  analytics,
}: {
  analytics: ReturnType<typeof analyzeCourseFeedback>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Karar notları</CardTitle>
        <CardDescription>Filtrelenen veriden doğrudan türetilen kısa aksiyon özeti.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Insight
          icon={AlertTriangle}
          title="Öncelikli deneyim alanı"
          value={analytics.weakestMetric ? `${analytics.weakestMetric.label} · ${formatRating(analytics.weakestMetric.average)}` : "Henüz ölçülmedi"}
          description="İyileştirme planında ilk incelenmesi gereken boyut."
        />
        <Insight
          icon={Sparkles}
          title="En güçlü deneyim alanı"
          value={analytics.strongestMetric ? `${analytics.strongestMetric.label} · ${formatRating(analytics.strongestMetric.average)}` : "Henüz ölçülmedi"}
          description="Korunabilecek ve diğer derslere taşınabilecek uygulama alanı."
        />
        <Insight
          icon={ShieldCheck}
          title="Anonimlik eşiği"
          value={`${analytics.protectedGroupCount} grup rapor eşiğinde`}
          description="Bu grupların puan ve yorumları öğrenci mahremiyeti için açılmadı."
        />
        <Insight
          icon={BookOpenCheck}
          title="Yazılı geri bildirim"
          value={`${analytics.improvementCommentCount} öneri · ${analytics.helpfulCommentCount} olumlu not`}
          description="Yalnızca raporlanabilir grupların anonim yorumları."
        />
      </CardContent>
    </Card>
  );
}

function Insight({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof AlertTriangle;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-0.5 text-sm font-semibold">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FeedbackGroupTable({ summaries }: { summaries: readonly CourseFeedbackSummary[] }) {
  const rows = [...summaries].sort(
    (a, b) =>
      (a.overallAverage === null ? 1 : 0) - (b.overallAverage === null ? 1 : 0) ||
      (a.overallAverage ?? 0) - (b.overallAverage ?? 0) ||
      b.responseCount - a.responseCount,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ders grupları</CardTitle>
        <CardDescription>Ders, eğitmen ve dönem kırılımındaki anonim toplu sonuçlar.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Ders</TableHead>
              <TableHead>Eğitmen</TableHead>
              <TableHead>Dönem</TableHead>
              <TableHead className="text-right">Yanıt</TableHead>
              <TableHead className="text-right">Genel deneyim</TableHead>
              <TableHead>Öncelikli boyut</TableHead>
              <TableHead className="text-right">Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((summary) => {
              const weakest = weakestMetricOf(summary);
              const protectedGroup = summary.overallAverage === null;
              return (
                <TableRow key={`${summary.instructorId}-${summary.subject}-${summary.academicPeriod}`}>
                  <TableCell className="font-medium">{summary.subject}</TableCell>
                  <TableCell>{summary.instructorName}</TableCell>
                  <TableCell>{courseFeedbackPeriodLabel(summary.academicPeriod)}</TableCell>
                  <TableCell className="text-right tabular-nums">{summary.responseCount}</TableCell>
                  <TableCell className="min-w-36 text-right">
                    {protectedGroup ? <span className="text-muted-foreground">—</span> : (
                      <div>
                        <span className="font-semibold tabular-nums">{formatRating(summary.overallAverage)}</span>
                        <Progress value={(summary.overallAverage ?? 0) * 20} className="mt-1.5 ml-auto h-1 w-24" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{weakest ? `${weakest.label} · ${formatRating(weakest.value)}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={protectedGroup ? "warning" : ratingVariant(summary.overallAverage)}>
                      {protectedGroup ? "Eşik bekliyor" : ratingLabel(summary.overallAverage)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CommentStream({
  title,
  description,
  summaries,
  kind,
}: {
  title: string;
  description: string;
  summaries: readonly CourseFeedbackSummary[];
  kind: "helpful" | "improvement";
}) {
  const comments = summaries
    .filter((summary) => summary.overallAverage !== null)
    .flatMap((summary) =>
      (kind === "helpful" ? summary.helpfulComments : summary.improvementComments).map((comment) => ({
        comment,
        subject: summary.subject,
        instructor: summary.instructorName,
        period: summary.academicPeriod,
      })),
    )
    .slice(0, 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {comments.length === 0 ? (
          <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">Bu filtrelerde yazılı yorum bulunmuyor.</div>
        ) : (
          <ul className="space-y-3">
            {comments.map((item, index) => (
              <li key={`${index}-${item.comment}`} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-sm leading-relaxed">“{item.comment}”</p>
                <p className="mt-2 text-xs text-muted-foreground">{item.subject} · {item.instructor} · {courseFeedbackPeriodLabel(item.period)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-[300px] flex-col items-center justify-center py-14 text-center">
        <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-4 font-medium">Henüz anonim ders deneyimi verisi yok</p>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">Öğrenciler sonuçlanan sınavların ardından ders deneyimlerini paylaştıkça ders, eğitmen ve dönem analizleri burada oluşacak.</p>
      </CardContent>
    </Card>
  );
}

function FilteredEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
        <p className="mt-3 font-medium">Filtrelerle eşleşen grup yok</p>
        <p className="mt-1 text-sm text-muted-foreground">Dönem, ders veya eğitmen filtresini değiştirebilirsiniz.</p>
      </CardContent>
    </Card>
  );
}

function ChartEmpty() {
  return <div className="flex h-[250px] items-center justify-center text-center text-sm text-muted-foreground">Anonimlik eşiğini geçen ölçüm bulunmuyor.</div>;
}

function weakestMetricOf(summary: CourseFeedbackSummary) {
  const metrics: Array<{ label: string; value: number | null }> =
    COURSE_FEEDBACK_METRICS.map((metric) => ({
      label: metric.label,
      value: summary[metric.key],
    }));

  return metrics
    .filter((metric): metric is { label: string; value: number } => metric.value !== null)
    .sort((a, b) => a.value - b.value)[0] ?? null;
}

function ratingVariant(value: number | null): "success" | "warning" | "danger" {
  if (value !== null && value >= 4) return "success";
  if (value !== null && value >= 3.25) return "warning";
  return "danger";
}

function ratingLabel(value: number | null) {
  if (value !== null && value >= 4) return "Güçlü";
  if (value !== null && value >= 3.25) return "İzlenmeli";
  return "İyileştirilmeli";
}

function formatRating(value: number | null) {
  return value === null ? "—" : value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function shorten(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
