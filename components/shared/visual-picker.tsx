"use client";

import * as React from "react";
import { ImagePlus, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { QuestionVisual } from "@/components/shared/question-visual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/lib/types";
import type { ImageVisual, QuestionVisual as Visual } from "@/lib/visual";
import { VISUAL_LABELS } from "@/lib/visual";

export interface VisualPickerProps {
  /** Soruda hali hazirda bulunan gorsel. */
  value: Visual | null;
  onChange: (visual: Visual | null) => void;
  /** Arama kutusuna onceden yazilacak metin (konu adi gibi). */
  defaultQuery?: string;
}

/**
 * Soruya gorsel ekleme / kaldirma.
 *
 * AI grafik (chart) ve cizim (svg) URETIR; FOTOGRAF uretmez. Fotograf
 * gerektiginde var olan bir gorsel bulunup lisansiyla birlikte eklenir -
 * kaynagi Wikimedia Commons (bkz. app/api/visual-search/route.ts).
 *
 * Modelin urettigi grafik/cizim burada yalnizca GORUNUR ve kaldirilabilir;
 * elle duzenlenemez. Sebep: grafik verisini ya cizim yolunu elle duzenlemek
 * bir kod duzenleyicisi ister, o da bu diyalogun isi degil. Begenilmeyen
 * gorsel kaldirilip yeniden uretilir ya da fotografla degistirilir.
 */
export function VisualPicker({ value, onChange, defaultQuery = "" }: VisualPickerProps) {
  const [query, setQuery] = React.useState(defaultQuery);
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<ImageVisual[] | null>(null);

  async function search() {
    const term = query.trim();
    if (term.length < 2) {
      toast.error("Arama için en az 2 karakter girin");
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/visual-search?q=${encodeURIComponent(term)}`);
      const body = (await response.json()) as ApiResponse<ImageVisual[]>;
      if (!body.ok) throw new Error(body.error);

      setResults(body.data);
      if (body.data.length === 0) {
        toast.info("Sonuç bulunamadı", {
          description: "Daha genel bir terim deneyin (örneğin İngilizcesi).",
        });
      }
    } catch (caught) {
      toast.error("Görsel aranamadı", {
        description: caught instanceof Error ? caught.message : "Bilinmeyen hata.",
      });
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Görsel</Label>
        {value ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(null)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Kaldır
          </Button>
        ) : null}
      </div>

      {value ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Ekli görsel türü: <strong>{VISUAL_LABELS[value.kind]}</strong>
            {value.kind === "image" ? null : " · AI üretti, kod çizdi"}
          </p>
          <QuestionVisual visual={value} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          Bu soruda görsel yok. Grafik ve şemayı üretim formundaki
          &quot;Görsel&quot; seçeneğiyle AI üretir; fotoğrafı aşağıdan
          arayabilirsiniz.
        </p>
      )}

      {/* ---------- Wikimedia arama ---------- */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Diyalog icindeki formu gondermesin.
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Fotoğraf ara (ör. photosynthesis)"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={searching}
          onClick={() => void search()}
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Ara
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Kaynak: Wikimedia Commons. Seçtiğiniz görselin kaynağı ve lisansı
        soruyla birlikte gösterilir. Türkçe terim sonuç vermezse İngilizcesini
        deneyin.
      </p>

      {results && results.length > 0 ? (
        <ul className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {results.map((item) => (
            <li key={item.url}>
              <button
                type="button"
                onClick={() => {
                  onChange(item);
                  setResults(null);
                }}
                className="group w-full overflow-hidden rounded-lg border text-left transition-colors hover:border-primary"
                title={`${item.alt} · ${item.license}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt}
                  loading="lazy"
                  className="h-24 w-full bg-muted object-cover"
                />
                <span className="flex items-center gap-1 px-2 py-1.5 text-[11px] leading-tight text-muted-foreground group-hover:text-foreground">
                  <ImagePlus className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-2">{item.alt}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
