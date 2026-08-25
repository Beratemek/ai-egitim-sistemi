"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  Clock3,
  ListTodo,
  Trash2,
} from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getStudyPlan,
  removeStudyPlanItem,
  STUDENT_STUDY_PLAN_CHANGED_EVENT,
  type StudyPlanItem,
  type StudyPlanStatus,
  updateStudyPlanStatus,
} from "@/lib/student-study-plan";

type PlanFilter = "tumu" | StudyPlanStatus;

const STATUS_META: Record<
  StudyPlanStatus,
  {
    label: string;
    variant: "outline" | "warning" | "success";
    icon: typeof Circle;
  }
> = {
  baslanmadi: { label: "Başlanmadı", variant: "outline", icon: Circle },
  calisiliyor: { label: "Çalışılıyor", variant: "warning", icon: Clock3 },
  tamamlandi: { label: "Tamamlandı", variant: "success", icon: CheckCircle2 },
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function sortItems(items: readonly StudyPlanItem[]) {
  const order: Record<StudyPlanStatus, number> = {
    calisiliyor: 0,
    baslanmadi: 1,
    tamamlandi: 2,
  };
  return [...items].sort((a, b) => {
    const statusDifference = order[a.status] - order[b.status];
    if (statusDifference !== 0) return statusDifference;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function StudentStudyPlanBoard() {
  const [items, setItems] = React.useState<StudyPlanItem[]>([]);
  const [filter, setFilter] = React.useState<PlanFilter>("tumu");
  const [ready, setReady] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setItems(sortItems(await getStudyPlan()));
      setSyncError(null);
    } catch (caught) {
      setSyncError(
        caught instanceof Error
          ? caught.message
          : "Çalışma planı hesabınızdan yüklenemedi.",
      );
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    const handleChange = () => void refresh();
    void refresh();
    window.addEventListener(STUDENT_STUDY_PLAN_CHANGED_EVENT, handleChange);
    return () => {
      window.removeEventListener(STUDENT_STUDY_PLAN_CHANGED_EVENT, handleChange);
    };
  }, [refresh]);

  const completedCount = items.filter((item) => item.status === "tamamlandi").length;
  const inProgressCount = items.filter((item) => item.status === "calisiliyor").length;
  const completionRate =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const visibleItems =
    filter === "tumu" ? items : items.filter((item) => item.status === filter);

  async function changeStatus(id: string, status: StudyPlanStatus) {
    setPendingId(id);
    try {
      const updated = await updateStudyPlanStatus(id, status);
      setItems((current) =>
        sortItems(current.map((item) => (item.id === id ? updated : item))),
      );
      toast.success("Çalışma durumu hesabınıza kaydedildi.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Çalışma durumu kaydedilemedi.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function removeItem(id: string) {
    setPendingId(id);
    try {
      await removeStudyPlanItem(id);
      setItems((current) => current.filter((item) => item.id !== id));
      toast.success("Çalışma planınızdan çıkarıldı.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Çalışma plandan çıkarılamadı.",
      );
    } finally {
      setPendingId(null);
    }
  }

  if (!ready) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground min-h-[240px]">
          Çalışma planın yükleniyor…
        </CardContent>
      </Card>
    );
  }

  if (syncError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center min-h-[240px]">
          <p className="font-medium text-destructive">Çalışma planı yüklenemedi</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {syncError}
          </p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => void refresh()}>
            Yeniden dene
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-16 text-center min-h-[240px]">
          <ListTodo className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 font-medium">Çalışma planın henüz boş</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Gelişim ekranındaki veri destekli önerilerden çalışmak istediklerini
            planına ekleyebilirsin.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/ogrenci/gelisim">
              Gelişim önerilerine git
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Plandaki çalışma"
          value={items.length}
          icon={ListTodo}
          accent="cat1"
        />
        <StatCard
          label="Üzerinde çalışılan"
          value={inProgressCount}
          icon={Clock3}
          accent="cat2"
        />
        <StatCard
          label="Tamamlanan"
          value={completedCount}
          icon={BookOpenCheck}
          accent="cat3"
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Plan ilerlemesi</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {completedCount} / {items.length} çalışma tamamlandı
              </p>
            </div>
            <span className="text-lg font-semibold tabular-nums">%{completionRate}</span>
          </div>
          <Progress value={completionRate} className="h-2.5" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl">Planındaki kazanımlar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Durumunu güncelle; tamamladığın çalışmalar plan ilerlemesine yansır.
          </p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as PlanFilter)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Plan durumu filtresi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tumu">Tüm çalışmalar</SelectItem>
            <SelectItem value="baslanmadi">Başlanmadı</SelectItem>
            <SelectItem value="calisiliyor">Çalışılıyor</SelectItem>
            <SelectItem value="tamamlandi">Tamamlandı</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visibleItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground min-h-[240px]">
            Bu durumda bir çalışma bulunmuyor.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleItems.map((item) => {
            const meta = STATUS_META[item.status];
            const StatusIcon = meta.icon;
            const feedbackHref = item.latestExamId
              ? `/dashboard/ogrenci/sinav/${item.latestExamId}`
              : "/dashboard/ogrenci/sonuclar";

            return (
              <Card
                key={item.id}
                className={item.status === "tamamlandi" ? "bg-muted/20" : undefined}
              >
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant={meta.variant} className="gap-1.5">
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </Badge>
                      <h3 className="mt-3 font-semibold leading-snug">{item.title}</h3>
                      {item.context ? (
                        <p className="mt-1 text-xs text-muted-foreground">{item.context}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`${item.title} çalışmasını plandan çıkar`}
                      title="Plandan çıkar"
                      disabled={pendingId === item.id}
                      onClick={() => void removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {item.action ? (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Çalışma adımı
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed">{item.action}</p>
                      {item.evidence ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Dayanak: {item.evidence}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-auto space-y-3 border-t pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Select
                        value={item.status}
                        onValueChange={(value) =>
                          void changeStatus(item.id, value as StudyPlanStatus)
                        }
                        disabled={pendingId === item.id}
                      >
                        <SelectTrigger
                          className="w-full sm:w-40"
                          aria-label={`${item.title} durumu`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baslanmadi">Başlanmadı</SelectItem>
                          <SelectItem value="calisiliyor">Çalışılıyor</SelectItem>
                          <SelectItem value="tamamlandi">Tamamlandı</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button asChild variant="outline" size="sm">
                        <Link href={feedbackHref}>
                          Geri bildirimi incele
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Plana eklenme: {dateFormatter.format(new Date(item.savedAt))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Çalışma planınız hesabınıza kaydedilir; aynı hesapla giriş yaptığınız
        diğer cihazlarda da güncel haliyle görünür.
      </p>
    </div>
  );
}
