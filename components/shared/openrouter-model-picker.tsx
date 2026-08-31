"use client";

import * as React from "react";
import { Check, Pencil, Search, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  costTier,
  formatContext,
  formatUsd,
  questionCost,
  type CostTier,
  type OpenRouterModel,
} from "@/lib/openrouter-models";
import { cn } from "@/lib/utils";

/**
 * OpenRouter model secici - FIYATIYLA BIRLIKTE.
 *
 * Neden bir metin kutusu yetmiyor: OpenRouter'da yuzlerce model var ve
 * aralarindaki fiyat farki 100 kata cikabiliyor. Model adini elle yazan
 * yonetici "bu secim ne tutar" sorusunu hicbir yerde goremiyor, ucuz modelle
 * pahali modeli ayirt edemiyordu. Burada her satirin yaninda 10 ve 100 soru
 * icin tahmini tutar yaziyor.
 *
 * Ikinci ve daha sinsi problem: her model JSON SEMASI destegi vermiyor.
 * Uygulama sorulari `generateObject` ile uretiyor, yani sema zorunlu.
 * Desteklemeyen bir model secildiginde hata ancak ilk soru uretiminde
 * gorunurdu. Liste varsayilan olarak destekleyenleri gosterir; digerleri
 * acikca isaretlenir.
 */

/** Kac soruluk maliyet gosterilecek. */
const SMALL_BATCH = 10;
const LARGE_BATCH = 100;

/** Arama sonrasi ekranda gosterilen en fazla satir. */
const VISIBLE_LIMIT = 60;

const TIER_LABEL: Record<CostTier, string> = {
  ucretsiz: "Ücretsiz",
  ucuz: "Ucuz",
  orta: "Orta",
  pahali: "Pahalı",
};

const TIER_VARIANT: Record<CostTier, "success" | "warning" | "secondary"> = {
  ucretsiz: "success",
  ucuz: "success",
  orta: "secondary",
  pahali: "warning",
};

export interface OpenRouterModelPickerProps {
  id: string;
  label: string;
  description?: string;
  models: readonly OpenRouterModel[];
  /** Liste alinamadiysa sebebi; bu durumda elle yazma kutusu gosterilir. */
  loadError?: string | null;
  value: string;
  onChange: (modelId: string) => void;
}

export function OpenRouterModelPicker({
  id,
  label,
  description,
  models,
  loadError = null,
  value,
  onChange,
}: OpenRouterModelPickerProps) {
  const [search, setSearch] = React.useState("");
  const [onlySchema, setOnlySchema] = React.useState(true);
  const [manual, setManual] = React.useState(false);

  const selected = React.useMemo(
    () => models.find((model) => model.id === value) ?? null,
    [models, value],
  );

  /*
    Secili model listede yoksa (elle yazilmis ya da listenin disinda kalmis)
    kutuyu kendiliginden aciyoruz - aksi halde yonetici kayitli degerini
    goremeden listeden baska bir model secmis olurdu.
  */
  const manualMode = manual || models.length === 0 || (Boolean(value) && !selected);

  const visible = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("en");

    return models
      .filter((model) => {
        if (onlySchema && !model.structuredOutput) return false;
        if (!needle) return true;
        return (
          model.id.toLocaleLowerCase("en").includes(needle) ||
          model.label.toLocaleLowerCase("en").includes(needle)
        );
      })
      .slice(0, VISIBLE_LIMIT);
  }, [models, onlySchema, search]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {models.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setManual((current) => !current)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {manualMode ? "Listeden seç" : "Model adını elle yaz"}
          </Button>
        ) : null}
      </div>

      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}

      {loadError ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {loadError}
        </p>
      ) : null}

      {manualMode ? (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="openai/gpt-4o-mini"
          className="font-mono text-sm"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={id}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Model ara: gpt, claude, gemini, deepseek..."
                className="pl-9"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={onlySchema}
                onChange={(event) => setOnlySchema(event.target.checked)}
              />
              Yalnızca JSON şema destekleyenler
            </label>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border">
            {visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aramaya uyan model yok.
              </p>
            ) : (
              <ul className="divide-y">
                {visible.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    selected={model.id === value}
                    onSelect={() => onChange(model.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {visible.length === VISIBLE_LIMIT ? (
            <p className="text-xs text-muted-foreground">
              İlk {VISIBLE_LIMIT} model gösteriliyor; aramayla daraltın.
            </p>
          ) : null}
        </>
      )}

      {selected && !manualMode ? (
        <p className="text-xs text-muted-foreground">
          Seçili: <span className="font-mono text-foreground">{selected.id}</span> —{" "}
          {SMALL_BATCH} soru ≈{" "}
          <span className="font-semibold text-foreground">
            {formatUsd(questionCost(selected, SMALL_BATCH))}
          </span>
        </p>
      ) : null}
    </div>
  );
}

interface ModelRowProps {
  model: OpenRouterModel;
  selected: boolean;
  onSelect: () => void;
}

function ModelRow({ model, selected, onSelect }: ModelRowProps) {
  const tier = costTier(model);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors",
          selected ? "bg-primary/10" : "hover:bg-muted/60",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {selected ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : null}
            <span className="truncate text-sm font-medium">{model.label}</span>
          </span>
          <span className="mt-0.5 block truncate font-mono text-[0.7rem] text-muted-foreground">
            {model.id}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={TIER_VARIANT[tier]} className="text-[0.65rem]">
              {TIER_LABEL[tier]}
            </Badge>
            <Badge variant="outline" className="text-[0.65rem]">
              {formatContext(model.contextLength)} bağlam
            </Badge>
            {model.structuredOutput ? null : (
              <Badge variant="warning" className="text-[0.65rem]">
                JSON şema desteklemiyor
              </Badge>
            )}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {formatUsd(questionCost(model, SMALL_BATCH))}
          </span>
          <span className="block text-[0.7rem] text-muted-foreground">
            {SMALL_BATCH} soru
          </span>
          <span className="mt-1 block text-[0.7rem] text-muted-foreground tabular-nums">
            {LARGE_BATCH} soru {formatUsd(questionCost(model, LARGE_BATCH))}
          </span>
        </span>
      </button>
    </li>
  );
}
