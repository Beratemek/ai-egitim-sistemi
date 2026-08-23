"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deletePreference,
  updatePreferenceVerdict,
} from "@/app/actions/questions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PreferenceVerdict, QuestionPreference } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * AI tarz hafizasi.
 *
 * Onceki surum yalnizca iki sayi gosteriyordu ("10 begeni · 3 red"). Uzman
 * modelin NEYI ogrendigini goremiyor, yanlislikla verdigi bir karari da geri
 * alamiyordu - kayit veritabaninda duruyor ve her uretimde modele ornek
 * olarak gitmeye devam ediyordu.
 *
 * Artik ornekler listeleniyor ve karar DEGISTIRILEBILIYOR: begeniyi rede,
 * redi begeniye cevirmek ya da kaydi tumuyle silmek mumkun. Karar
 * degistiginde bir sonraki uretimde model yeni karari gorur.
 */

type VerdictTab = PreferenceVerdict | "hepsi";

const TABS: readonly { value: VerdictTab; label: string }[] = [
  { value: "hepsi", label: "Tümü" },
  { value: "begendi", label: "Beğenilen" },
  { value: "begenmedi", label: "Beğenilmeyen" },
];

export interface StyleMemoryPanelProps {
  preferences: readonly QuestionPreference[];
  /** Supabase yoksa liste bos gelir; panel bunu ayrica soyler. */
  canPersist?: boolean;
}

export function StyleMemoryPanel({
  preferences,
  canPersist = true,
}: StyleMemoryPanelProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState<readonly QuestionPreference[]>(preferences);
  const [tab, setTab] = React.useState<VerdictTab>("hepsi");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(preferences);
  }, [preferences]);

  const counts = React.useMemo(
    () => ({
      hepsi: rows.length,
      begendi: rows.filter((row) => row.verdict === "begendi").length,
      begenmedi: rows.filter((row) => row.verdict === "begenmedi").length,
    }),
    [rows],
  );

  const visible = React.useMemo(
    () => (tab === "hepsi" ? rows : rows.filter((row) => row.verdict === tab)),
    [rows, tab],
  );

  /** Begeni <-> red. Kayit silinmez; yalnizca karar degisir. */
  async function flip(row: QuestionPreference) {
    const next: PreferenceVerdict =
      row.verdict === "begendi" ? "begenmedi" : "begendi";

    setPendingId(row.id);
    const previous = rows;
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, verdict: next } : item)),
    );

    try {
      const result = await updatePreferenceVerdict(row.id, next);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        next === "begendi" ? "Beğeniye çevrildi" : "Redde çevrildi",
        { description: "AI bir sonraki üretimde yeni kararı görecek." },
      );
      router.refresh();
    } catch (caught) {
      setRows(previous);
      toast.error("Karar değiştirilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  /** Kaydi tumuyle siler: ornek kumesinden cikar, modele hic gitmez. */
  async function remove(row: QuestionPreference) {
    setPendingId(row.id);
    const previous = rows;
    setRows((current) => current.filter((item) => item.id !== row.id));

    try {
      const result = await deletePreference(row.id);
      if (!result.ok) throw new Error(result.error);

      toast.success("Örnek silindi", {
        description: "Bu taslak artık modele örnek olarak verilmeyecek.",
      });
      router.refresh();
    } catch (caught) {
      setRows(previous);
      toast.error("Örnek silinemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Brain className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">AI tarz hafızası</p>
            {rows.length === 0 ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {canPersist
                  ? "Henüz örnek yok. Üretilen taslakları beğenip reddettikçe AI sizin soru tarzınızı öğrenir ve sonraki üretimlerde ona yaklaşır."
                  : "Tanıtım modunda tercih kaydı tutulmaz."}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Bu örnekler bir sonraki üretimde modele veriliyor. Kararınızı
                değiştirebilir ya da örneği silebilirsiniz.
              </p>
            )}
          </div>
        </div>

        {rows.length === 0 ? null : (
          <>
            <Tabs value={tab} onValueChange={(value) => setTab(value as VerdictTab)}>
              <TabsList className="w-full justify-start overflow-x-auto">
                {TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value} className="gap-1.5">
                    {item.label}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {counts[item.value]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/*
              Liste KENDI ICINDE kayar. Panel formun altinda duruyor; 50
              ornek sayfayi metrelerce uzatir ve sagdaki taslak sutunuyla
              hizasi tumuyle kacardi.
            */}
            {visible.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Bu kümede örnek yok.
              </p>
            ) : (
              <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {visible.map((row) => (
                  <PreferenceRow
                    key={row.id}
                    row={row}
                    pending={pendingId === row.id}
                    onFlip={() => void flip(row)}
                    onRemove={() => void remove(row)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function PreferenceRow({
  row,
  pending,
  onFlip,
  onRemove,
}: {
  row: QuestionPreference;
  pending: boolean;
  onFlip: () => void;
  onRemove: () => void;
}) {
  const liked = row.verdict === "begendi";

  return (
    <li
      className={cn(
        "rounded-lg border p-2.5 transition-colors",
        liked ? "border-success/35 bg-success/[0.04]" : "border-destructive/30",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            liked
              ? "bg-success/15 text-success"
              : "bg-destructive/10 text-destructive",
          )}
          aria-hidden
        >
          {liked ? (
            <ThumbsUp className="h-3.5 w-3.5" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Uzun taslaklari uc satirda kesiyoruz: bu bir okuma ekrani degil,
              "hangi karari vermistim" hatirlatmasi. */}
          <p className="line-clamp-3 text-xs leading-relaxed">{row.question_text}</p>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {row.question_type === "test" ? "Çoktan seçmeli" : "Açık uçlu"}
            </Badge>
            {row.difficulty ? (
              <Badge variant="outline" className="font-normal">
                {row.difficulty}
              </Badge>
            ) : null}
            {row.topic ? <span className="truncate">{row.topic}</span> : null}
            <span aria-hidden>·</span>
            <span>{formatDateTime(row.created_at)}</span>
          </div>

          {/* Uzmanin yazdigi gerekce de modele gidiyor; burada gorunsun. */}
          {row.note ? (
            <p className="rounded bg-muted/60 px-2 py-1 text-[11px] italic text-muted-foreground">
              &ldquo;{row.note}&rdquo;
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              disabled={pending}
              onClick={onFlip}
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : liked ? (
                <ThumbsDown className="h-3 w-3" />
              ) : (
                <ThumbsUp className="h-3 w-3" />
              )}
              {liked ? "Redde çevir" : "Beğeniye çevir"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={onRemove}
            >
              <Trash2 className="h-3 w-3" />
              Sil
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
