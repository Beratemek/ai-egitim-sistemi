import Link from "next/link";
import { Sparkles, Target, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  outcomeLevel,
  type OutcomeAnalysisRow,
  type OutcomeLevel,
} from "@/lib/outcome-analysis";
import { cn } from "@/lib/utils";

/** Seviye basina renk ve etiket. */
const LEVEL_STYLE: Record<
  OutcomeLevel,
  { label: string; badge: "danger" | "warning" | "success" | "soft"; bar: string }
> = {
  zayif: { label: "Zayıf", badge: "danger", bar: "bg-destructive" },
  orta: { label: "Orta", badge: "warning", bar: "bg-warning" },
  iyi: { label: "İyi", badge: "success", bar: "bg-success" },
  olculmedi: { label: "Ölçülmedi", badge: "soft", bar: "bg-muted" },
};

export interface OutcomeAnalysisProps {
  rows: readonly OutcomeAnalysisRow[];
  /**
   * "Bu kazanıma soru üret" baglantisi gosterilsin mi?
   *
   * Yalnizca soru uretebilen rollerde anlamli. Egitim yoneticisi raporu
   * okur, uretim yapmaz - ona olmayan bir yetkiyi ima eden dugme
   * gostermek yanlis olur.
   */
  canGenerate?: boolean;
  /** En fazla kac satir gosterilecek. Verilmezse hepsi. */
  limit?: number;
}

/**
 * Kazanim bazli basari tablosu.
 *
 * BU EKRAN BIR EYLEM LISTESI, bir istatistik dokumu degil. Bu yuzden:
 *
 *   - En zayif kazanim EN USTTE (siralama `analyzeOutcomes` icinde).
 *   - Her zayif satirin yaninda "soru uret" baglantisi var: analiz -> uretim
 *     -> olcme -> analiz dongusunu kapatiyor. Rakiplerin cogu tek yonlu bir
 *     boru hatti kurar; donguyu kapatan sistem farkli bir ise donusur.
 *   - "Olculmedi" ile "%0" ayri gosteriliyor. Ikisini karistirmak hocayi
 *     var olmayan bir soruna yonlendirir.
 *   - Onay bekleyen cevap sayisi yaziliyor: "%38" ile "%38 ama 40 cevap
 *     onay bekliyor" cok farkli iki bilgi.
 */
export function OutcomeAnalysis({
  rows,
  canGenerate = false,
  limit,
}: OutcomeAnalysisProps) {
  const visible = limit ? rows.slice(0, limit) : rows;
  const measured = rows.filter((row) => row.averageScore !== null);
  const weak = measured.filter((row) => outcomeLevel(row.averageScore) === "zayif");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4.5 w-4.5 text-primary" />
          Kazanım bazlı başarı
        </CardTitle>
        <CardDescription>
          Yalnızca eğitmen onaylı puanlar hesaba katılır. En zayıf kazanım en
          üstte.
          {weak.length > 0
            ? ` ${weak.length} kazanım dikkat gerektiriyor.`
            : measured.length > 0
              ? " Zayıf kazanım yok."
              : null}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
            <Target className="h-7 w-7 text-muted-foreground/50" />
            <p className="font-medium">Henüz kazanım tanımlı değil</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              İçerik uzmanı kazanım tanımlayıp sorular bu kazanımlara
              bağlandığında başarı kırılımı burada oluşur.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((row) => {
              const level = outcomeLevel(row.averageScore);
              const style = LEVEL_STYLE[level];

              return (
                <li
                  key={row.outcomeId}
                  className={cn(
                    "rounded-xl border p-3",
                    level === "zayif" && "border-destructive/40 bg-destructive/[0.03]",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.subject ? (
                          <Badge variant="soft" className="font-normal">
                            {row.subject}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {row.topic}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-relaxed">
                        {row.outcomeText}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={style.badge}>
                        {row.averageScore === null
                          ? style.label
                          : `%${row.averageScore}`}
                      </Badge>
                    </div>
                  </div>

                  {row.averageScore !== null ? (
                    <Progress
                      value={row.averageScore}
                      className="mt-2.5 h-1.5"
                      indicatorClassName={style.bar}
                    />
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{row.questionCount} soru havuzda</span>
                    {row.answerCount > 0 ? (
                      <span>
                        {row.answerCount} onaylı cevap · {row.studentCount} öğrenci
                      </span>
                    ) : (
                      <span>Henüz onaylı cevap yok</span>
                    )}
                    {row.pendingCount > 0 ? (
                      <span className="flex items-center gap-1 text-warning">
                        <TriangleAlert className="h-3 w-3" />
                        {row.pendingCount} cevap onay bekliyor
                      </span>
                    ) : null}

                    {/*
                      DONGUYU KAPATAN BAGLANTI.
                      Kazanim kimligi adres satirinda tasiniyor; uretim formu
                      onu okuyup kazanimi hazir seciyor. Global durum yerine
                      URL kullanildi: paylasilabilir, geri tusu calisir ve iki
                      sayfa arasinda gizli bir bagimlilik olusmaz.
                    */}
                    {canGenerate ? (
                      <Link
                        href={`/dashboard/icerik-uzmani?kazanim=${row.outcomeId}`}
                        className="ml-auto flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {level === "zayif" ? "Tekrar sorusu üret" : "Soru üret"}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {limit && rows.length > limit ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {rows.length - limit} kazanım daha var.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
