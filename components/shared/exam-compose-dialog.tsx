"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  FileText,
  ListChecks,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { createExamWithQuestions } from "@/app/actions/exams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pickBalancedByType, type TopicGroup } from "@/lib/question-pool";
import { cn } from "@/lib/utils";

/**
 * Havuzdan yeni sinav kurma penceresi.
 *
 * Iki calisma bicimi var ve ikisi de ayni pencerede:
 *
 *   SECILI SORULARLA — egitmen listeden tek tek secmisse, sinav dogrudan o
 *   sorularla kurulur.
 *
 *   OTOMATIK — hic secim yoksa (ya da egitmen otomatige gecerse) "kac test,
 *   kac klasik" kotasi verilir ve sorular bulunulan kademeden, konular
 *   arasinda dengeli dagitilarak secilir. Boylece 10 testin hepsi tek
 *   konudan gelmez.
 *
 * Kota havuzda karsilanamazsa SESSIZCE az soruyla devam edilmez; eksik
 * sayilar kullaniciya soylenir.
 */

export interface ExamComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Egitmenin listeden isaretledigi sorular. */
  selectedIds: readonly string[];
  /** Otomatik secimin kapsami: bulunulan kademenin konulari. */
  scopeTopics: readonly TopicGroup[];
  /** Kapsamin okunabilir adi ("Elektronik ve IoT dersi" gibi). */
  scopeLabel: string;
  /** Sinava atanacak ders; bulunulan kademeden gelir. */
  subject?: string | null;
  onCreated?: () => void;
}

type Kaynak = "secili" | "otomatik";

export function ExamComposeDialog({
  open,
  onOpenChange,
  selectedIds,
  scopeTopics,
  scopeLabel,
  subject = null,
  onCreated,
}: ExamComposeDialogProps) {
  const router = useRouter();

  const [baslik, setBaslik] = React.useState("");
  const [sure, setSure] = React.useState("60");
  const [testSayisi, setTestSayisi] = React.useState("10");
  const [klasikSayisi, setKlasikSayisi] = React.useState("5");
  const [kaynak, setKaynak] = React.useState<Kaynak>(
    selectedIds.length > 0 ? "secili" : "otomatik",
  );
  const [pending, setPending] = React.useState(false);

  // Pencere her acilista mevcut duruma gore baslasin.
  React.useEffect(() => {
    if (!open) return;
    setKaynak(selectedIds.length > 0 ? "secili" : "otomatik");
    setBaslik("");
  }, [open, selectedIds.length]);

  /** Kapsamda tip basina kac soru var? Kota alanlarinin ustunde gosterilir. */
  const mevcut = React.useMemo(() => {
    let test = 0;
    let acik = 0;
    for (const group of scopeTopics) {
      for (const question of group.questions) {
        if (question.type === "test") test += 1;
        else acik += 1;
      }
    }
    return { test, acik };
  }, [scopeTopics]);

  const istenenTest = Number.parseInt(testSayisi, 10);
  const istenenKlasik = Number.parseInt(klasikSayisi, 10);
  const toplamIstenen =
    (Number.isFinite(istenenTest) ? istenenTest : 0) +
    (Number.isFinite(istenenKlasik) ? istenenKlasik : 0);

  const gecerli =
    baslik.trim().length > 0 &&
    (kaynak === "secili" ? selectedIds.length > 0 : toplamIstenen > 0);

  async function olustur() {
    if (!gecerli) return;

    let ids: string[];

    if (kaynak === "secili") {
      ids = [...selectedIds];
    } else {
      const sonuc = pickBalancedByType(scopeTopics, {
        test: Number.isFinite(istenenTest) ? Math.max(0, istenenTest) : 0,
        acikUclu: Number.isFinite(istenenKlasik) ? Math.max(0, istenenKlasik) : 0,
      });

      ids = sonuc.ids;

      if (sonuc.eksik.test > 0 || sonuc.eksik.acikUclu > 0) {
        const eksikler = [
          sonuc.eksik.test > 0 ? `${sonuc.eksik.test} test` : null,
          sonuc.eksik.acikUclu > 0 ? `${sonuc.eksik.acikUclu} klasik` : null,
        ]
          .filter(Boolean)
          .join(" ve ");

        toast.warning(`Havuzda ${eksikler} soru eksik`, {
          description: "Sınav elde edilen sorularla kurulacak.",
        });
      }

      if (ids.length === 0) {
        toast.error("Bu kapsamda uygun soru yok", {
          description: "Üst kademeye çıkın veya kotayı düşürün.",
        });
        return;
      }
    }

    const dakika = Number.parseInt(sure.trim(), 10);

    setPending(true);

    try {
      const result = await createExamWithQuestions({
        title: baslik,
        description: `${scopeLabel} kapsamından oluşturuldu.`,
        ...(subject ? { subject } : {}),
        ...(Number.isFinite(dakika) ? { durationMinutes: dakika } : {}),
        questionIds: ids,
      });

      if (!result.ok) throw new Error(result.error);

      toast.success("Sınav oluşturuldu", {
        description: `${result.data.added} soru eklendi. Puanlar 100 üzerinden dağıtıldı.`,
      });

      onOpenChange(false);
      onCreated?.();
      router.push(`/dashboard/egitmen/sinavlar/${result.data.id}`);
    } catch (caught) {
      toast.error("Sınav oluşturulamadı", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
            Yeni sınav oluştur
          </DialogTitle>
          <DialogDescription>
            Sorular <span className="font-medium text-foreground">{scopeLabel}</span>{" "}
            kapsamından alınır. Puanlar 100 üzerinden kendiliğinden dağıtılır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ---------- Başlık ---------- */}
          <div className="space-y-2">
            <Label htmlFor="compose-title">Sınav adı</Label>
            <Input
              id="compose-title"
              value={baslik}
              onChange={(event) => setBaslik(event.target.value)}
              placeholder="Elektronik ve IoT 1. Dönem Yazılı"
              autoFocus
            />
          </div>

          {/* ---------- Soru kaynağı ---------- */}
          <div className="space-y-2">
            <Label>Sorular nereden gelsin?</Label>

            <div className="grid gap-2 sm:grid-cols-2">
              <KaynakSecenegi
                secili={kaynak === "secili"}
                devreDisi={selectedIds.length === 0}
                baslik="Seçtiklerim"
                aciklama={
                  selectedIds.length === 0
                    ? "Listeden soru işaretlemediniz"
                    : `${selectedIds.length} soru işaretli`
                }
                onSelect={() => setKaynak("secili")}
              />

              <KaynakSecenegi
                secili={kaynak === "otomatik"}
                devreDisi={false}
                baslik="Otomatik seç"
                aciklama="Konular arasında dengeli dağıtılır"
                onSelect={() => setKaynak("otomatik")}
              />
            </div>
          </div>

          {/* ---------- Kota ---------- */}
          {kaynak === "otomatik" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="compose-test" className="flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                  Test sorusu
                </Label>
                <Input
                  id="compose-test"
                  type="number"
                  min={0}
                  value={testSayisi}
                  onChange={(event) => setTestSayisi(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Kapsamda {mevcut.test} test sorusu var
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="compose-klasik" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Klasik (açık uçlu)
                </Label>
                <Input
                  id="compose-klasik"
                  type="number"
                  min={0}
                  value={klasikSayisi}
                  onChange={(event) => setKlasikSayisi(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Kapsamda {mevcut.acik} açık uçlu soru var
                </p>
              </div>
            </div>
          ) : null}

          {/* ---------- Süre ---------- */}
          <div className="space-y-2">
            <Label htmlFor="compose-sure" className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
              Süre (dakika)
            </Label>
            <Input
              id="compose-sure"
              type="number"
              min={1}
              max={600}
              value={sure}
              onChange={(event) => setSure(event.target.value)}
              className="sm:w-40"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Her öğrenci sınava başladığı andan itibaren bu süreyi alır.
              Ayarlardan sonradan değiştirilebilir.
            </p>
          </div>

          {/* ---------- Özet ---------- */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Sınav:</span>
            <Badge variant="soft">
              {kaynak === "secili" ? selectedIds.length : toplamIstenen} soru
            </Badge>
            <Badge variant="soft">{sure || "60"} dk</Badge>
            {subject ? <Badge variant="soft">{subject}</Badge> : null}

            {kaynak === "otomatik" &&
            (istenenTest > mevcut.test || istenenKlasik > mevcut.acik) ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                <TriangleAlert className="h-3.5 w-3.5" />
                Kapsam yetersiz olabilir
              </span>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button disabled={!gecerli || pending} onClick={() => void olustur()}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Sınavı oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function KaynakSecenegi({
  secili,
  devreDisi,
  baslik,
  aciklama,
  onSelect,
}: {
  secili: boolean;
  devreDisi: boolean;
  baslik: string;
  aciklama: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={devreDisi}
      aria-pressed={secili}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        secili ? "border-primary bg-primary/5" : "hover:bg-accent/40",
        devreDisi && "cursor-not-allowed opacity-50",
      )}
    >
      <p className="text-sm font-medium">{baslik}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {aciklama}
      </p>
    </button>
  );
}
