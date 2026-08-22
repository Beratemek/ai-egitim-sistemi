"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Check,
  GraduationCap,
  Loader2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  assignExamToClassroom,
  setExamProctored,
  unassignExamFromClassroom,
} from "@/app/actions/exams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Sinavi sinifa atama.
 *
 * Ogrenciyi tek tek secmek yerine SINIF secilir: "Derslik-3'e biyoloji
 * sinavi". Sinif bilgisi ogrencinin profilinde durur ve sistem yoneticisi
 * tarafindan atanir; burada yalnizca hangi sinifin sinava gireceği belirlenir.
 */

export interface ClassroomSummary {
  name: string;
  /** Siniftaki onayli ogrenci sayisi. */
  studentCount: number;
  /** Bu sinava atanmis ogrenci sayisi. */
  assignedCount: number;
}

export interface ExamClassroomAssignProps {
  examId: string;
  classrooms: readonly ClassroomSummary[];
  /** Sinav kamera+mikrofon acikken mi cozulecek? */
  proctored?: boolean;
  canPersist?: boolean;
}

export function ExamClassroomAssign({
  examId,
  classrooms,
  proctored = false,
  canPersist = false,
}: ExamClassroomAssignProps) {
  const [kamera, setKamera] = React.useState(proctored);
  const [kameraPending, setKameraPending] = React.useState(false);

  React.useEffect(() => setKamera(proctored), [proctored]);

  async function kamerayiDegistir(deger: boolean) {
    if (!canPersist) {
      toast.error("Demo modunda kayıt yapılamaz");
      return;
    }

    // Once ekranda degistir: anahtarin tiklamaya aninda yanit vermesi
    // gerekiyor, sunucu turu ~150 ms suruyor.
    setKamera(deger);
    setKameraPending(true);

    try {
      const result = await setExamProctored(examId, deger);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.proctored
          ? "Kamera zorunluluğu açıldı"
          : "Kamera zorunluluğu kaldırıldı",
        {
          description: result.data.proctored
            ? "Öğrenciler sınavı kamera ve mikrofon açıkken çözecek."
            : "Sınav kamerasız çözülebilir.",
        },
      );
      router.refresh();
    } catch (caught) {
      setKamera(!deger);
      toast.error("Ayar kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setKameraPending(false);
    }
  }
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function assign(classroom: ClassroomSummary) {
    setPending(classroom.name);
    try {
      const result = await assignExamToClassroom(examId, classroom.name);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.assigned > 0
          ? `${classroom.name}: ${result.data.assigned} öğrenciye atandı`
          : `${classroom.name} zaten atanmıştı`,
      );
      router.refresh();
    } catch (caught) {
      toast.error("Atama yapılamadı", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPending(null);
    }
  }

  async function unassign(classroom: ClassroomSummary) {
    setPending(classroom.name);
    try {
      const result = await unassignExamFromClassroom(examId, classroom.name);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.removed > 0
          ? `${classroom.name}: ${result.data.removed} atama kaldırıldı`
          : "Kaldırılacak atama yok",
        {
          description:
            "Sınava başlamış öğrencilerin ataması korunur; cevapları ortada kalmasın.",
        },
      );
      router.refresh();
    } catch (caught) {
      toast.error("Atama kaldırılamadı", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-4.5 w-4.5 text-primary" />
          Sınıflara ata
        </CardTitle>
        <CardDescription>
          Sınav, seçtiğiniz sınıfın tüm öğrencilerine açılır. Sınıfları sistem
          yöneticisi belirler.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---------- Kamera zorunlulugu ---------- */}
        <label
          htmlFor="exam-proctored"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
            kamera ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
          )}
        >
          <Checkbox
            id="exam-proctored"
            checked={kamera}
            disabled={kameraPending || !canPersist}
            onChange={(event) => void kamerayiDegistir(event.target.checked)}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Camera className="h-3.5 w-3.5" />
              Kamera zorunlu olsun
              {kameraPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Açarsanız öğrenci sınava ancak kamerası ve mikrofonu açıkken
              girebilir; soruları tek tek geçer. Görüntü ve ses kaydedilmez,
              yalnızca sınav boyunca açık kalması gerekir. Ayar sınavın
              tamamı için geçerlidir, sınıf başına değil.
            </span>
          </span>
        </label>

        {classrooms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">
            Henüz tanımlı sınıf yok. Sistem yöneticisi{" "}
            <Link
              href="/dashboard/sistem"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sistem Yönetimi
            </Link>{" "}
            ekranından öğrencileri bir sınıfa yerleştirdiğinde burada
            listelenirler.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {classrooms.map((classroom) => {
              const busy = pending === classroom.name;
              const full =
                classroom.studentCount > 0 &&
                classroom.assignedCount === classroom.studentCount;
              const partial =
                classroom.assignedCount > 0 && !full;

              return (
                <div
                  key={classroom.name}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
                    full && "border-success/40 bg-success/5",
                    partial && "border-warning/40 bg-warning/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{classroom.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {classroom.studentCount} öğrenci
                      </p>
                    </div>

                    {full ? (
                      <Badge variant="success" className="gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        Atandı
                      </Badge>
                    ) : partial ? (
                      <Badge variant="warning">
                        {classroom.assignedCount} / {classroom.studentCount}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={full ? "outline" : "default"}
                      className="flex-1 gap-1.5"
                      disabled={busy || classroom.studentCount === 0 || full}
                      onClick={() => void assign(classroom)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      {full ? "Tamamı atandı" : "Ata"}
                    </Button>

                    {classroom.assignedCount > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => void unassign(classroom)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Kaldır
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canPersist ? null : (
          <p className="mt-3 text-xs text-muted-foreground">
            Demo modunda atama kaydedilmez.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
