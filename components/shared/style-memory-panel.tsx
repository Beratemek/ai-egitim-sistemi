"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Check,
  Loader2,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deletePreference, updatePreference } from "@/app/actions/questions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  /** Duzenleme panelinden gelen degisikligi kaydeder: karar + gerekce. */
  async function save(
    row: QuestionPreference,
    patch: { verdict: PreferenceVerdict; note: string },
  ) {
    setPendingId(row.id);
    const previous = rows;
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? { ...item, verdict: patch.verdict, note: patch.note.trim() || null }
          : item,
      ),
    );

    try {
      const result = await updatePreference(row.id, {
        verdict: patch.verdict,
        note: patch.note,
      });
      if (!result.ok) throw new Error(result.error);

      toast.success("Örnek güncellendi", {
        description:
          patch.verdict === row.verdict
            ? "Gerekçe kaydedildi."
            : patch.verdict === "begendi"
              ? "Beğeniye çevrildi; AI yeni kararı görecek."
              : "Redde çevrildi; AI yeni kararı görecek.",
      });
      router.refresh();
    } catch (caught) {
      setRows(previous);
      toast.error("Kaydedilemedi", {
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
              <TabsList className="w-full justify-start">
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
              <ul className="grid max-h-[560px] gap-2.5 overflow-y-auto pr-1 lg:grid-cols-2">
                {visible.map((row) => (
                  <PreferenceRow
                    key={row.id}
                    row={row}
                    pending={pendingId === row.id}
                    onSave={(patch) => save(row, patch)}
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

/**
 * Tek ornek satiri.
 *
 * Karar degistirme dogrudan bir dugme DEGIL, "Duzenle"nin altinda. Once
 * satirda "Redde cevir" duruyordu ve tek tikla karari ters ceviriyordu:
 * geri alinmasi kolay ama YANLISLIKLA basilmasi da kolaydi, ustelik
 * gerekceyi duzeltmenin hicbir yolu yoktu. Gerekce onemli, cunku o metin
 * modele "bu taslak neden kotu" diye gidiyor.
 */
function PreferenceRow({
  row,
  pending,
  onSave,
  onRemove,
}: {
  row: QuestionPreference;
  pending: boolean;
  onSave: (patch: { verdict: PreferenceVerdict; note: string }) => Promise<void>;
  onRemove: () => void;
}) {
  const liked = row.verdict === "begendi";
  const [editing, setEditing] = React.useState(false);
  const [draftVerdict, setDraftVerdict] = React.useState<PreferenceVerdict>(
    row.verdict,
  );
  const [draftNote, setDraftNote] = React.useState(row.note ?? "");

  /** Duzenlemeyi acarken taslak her zaman KAYITLI degerden baslar. */
  function openEditor() {
    setDraftVerdict(row.verdict);
    setDraftNote(row.note ?? "");
    setEditing(true);
  }

  async function save() {
    await onSave({ verdict: draftVerdict, note: draftNote });
    setEditing(false);
  }

  return (
    <li
      className={cn(
        "rounded-lg border p-3.5 transition-colors",
        liked ? "border-success/35 bg-success/[0.04]" : "border-destructive/30",
      )}
    >
      <div className="flex items-start gap-2.5">
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

        <div className="min-w-0 flex-1 space-y-2">
          {/* Metin kesilmiyor: karari degistirmek icin soruyu TAM okumak
              gerekiyor - kirpik metin "bunu neden begenmistim" sorusunu
              yanitlamiyordu. */}
          <p className="text-xs leading-relaxed">{row.question_text}</p>

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

          {/* Gerekce de modele gidiyor; duzenleme kapaliyken de gorunsun. */}
          {!editing && row.note ? (
            <p className="rounded bg-muted/60 px-2 py-1 text-[11px] italic text-muted-foreground">
              &ldquo;{row.note}&rdquo;
            </p>
          ) : null}

          {editing ? (
            <div className="space-y-2.5 rounded-lg border bg-muted/40 p-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Karar
                </p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={draftVerdict === "begendi" ? "default" : "outline"}
                    className="h-7 gap-1.5 text-xs"
                    disabled={pending}
                    onClick={() => setDraftVerdict("begendi")}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Beğendim
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      draftVerdict === "begenmedi" ? "destructive" : "outline"
                    }
                    className="h-7 gap-1.5 text-xs"
                    disabled={pending}
                    onClick={() => setDraftVerdict("begenmedi")}
                  >
                    <ThumbsDown className="h-3 w-3" />
                    Beğenmedim
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={`not-${row.id}`}
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Gerekçe
                </Label>
                <Input
                  id={`not-${row.id}`}
                  value={draftNote}
                  disabled={pending}
                  onChange={(event) => setDraftNote(event.target.value)}
                  placeholder="Nesi eksik? (örnek: çeldiriciler zayıf, çok kolay)"
                  className="h-8 text-xs"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Bu metin modele gidiyor; ne kadar somut olursa o kadar işe
                  yarar. Boş bırakırsanız gerekçe silinir.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={pending}
                  onClick={() => void save()}
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Kaydet
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={pending}
                  onClick={() => setEditing(false)}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                disabled={pending}
                onClick={openEditor}
              >
                <Pencil className="h-3 w-3" />
                Düzenle
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
          )}
        </div>
      </div>
    </li>
  );
}
