"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AvailableModel, ModelGroup } from "@/lib/ai-model-catalog";
import type { AiProvider } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

/**
 * Model secici: TEK kutu, saglayici basliklari KATLANABILIR, aramali.
 *
 * Neden hazir `Select` degil:
 *
 *   - OpenRouter'in varlik sebebi tek anahtarla YUZLERCE modele erismek.
 *     Radix Select'in tek harfle atlayan typeahead'i o uzunlukta ise yaramiyor;
 *     "deepseek" yazip suzmek gerekiyor.
 *   - Katlanabilir baslik da Select'te yok. Katlanma sart: tek bir saglayici
 *     bile 36 model dondurebiliyor, hepsi acik gelince kutu bir duvar oluyor ve
 *     ikinci saglayicinin varligi hic gorunmuyor.
 *
 * Gruplar KAPALI acilir: once "hangi saglayici" gorunur, tiklayinca modelleri
 * iner. Arama yapilirken eslesen gruplar kendiliginden acilir - arama zaten
 * "modeli biliyorum" durumu, orada bir tiklama daha istemek gereksiz.
 *
 * Liste her zaman ASAGI dogru acilir; yer darsa kendi icinde kayar.
 */

export interface ModelComboboxProps {
  id: string;
  groups: readonly ModelGroup[];
  /** Secili modelin saglayicisi. */
  provider: AiProvider;
  /** Secili model kimligi. */
  modelId: string;
  onSelect: (provider: AiProvider, modelId: string) => void;
  disabled?: boolean;
}

/** Ekranda gorunen grup: suzulmus modelleri ve acik/kapali durumuyla. */
interface VisibleGroup {
  provider: AiProvider;
  providerLabel: string;
  keyMissing: boolean;
  /** Gruptaki toplam model (arama oncesi). */
  total: number;
  /** Aramaya uyanlar. */
  matches: readonly AvailableModel[];
  expanded: boolean;
}

export function ModelCombobox({
  id,
  groups,
  provider,
  modelId,
  onSelect,
  disabled = false,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  /** Elle acilmis gruplar. Arama varken bu kume yok sayilir. */
  const [expanded, setExpanded] = React.useState<ReadonlySet<AiProvider>>(
    () => new Set(),
  );
  /** Klavyeyle uzerinde durulan model satiri; -1 = hicbiri. */
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const searching = search.trim().length > 0;

  const visibleGroups = React.useMemo<VisibleGroup[]>(() => {
    const needle = search.trim().toLocaleLowerCase("en");

    return groups.map((group) => {
      const matches = needle
        ? group.models.filter(
            (model) =>
              model.id.toLocaleLowerCase("en").includes(needle) ||
              model.label.toLocaleLowerCase("en").includes(needle) ||
              group.providerLabel.toLocaleLowerCase("en").includes(needle),
          )
        : group.models;

      return {
        provider: group.provider,
        providerLabel: group.providerLabel,
        keyMissing: group.keyMissing,
        total: group.models.length,
        matches,
        // Arama sirasinda eslesen grup kendiliginden acilir.
        expanded: needle ? matches.length > 0 : expanded.has(group.provider),
      };
    });
  }, [groups, search, expanded]);

  /** Kutudaki toplam model - arama kutusunun ipucunda yaziyor. */
  const totalCount = React.useMemo(
    () => groups.reduce((sum, group) => sum + group.models.length, 0),
    [groups],
  );

  /** Aramaya uyan model sayisi. */
  const matchCount = visibleGroups.reduce(
    (sum, group) => sum + group.matches.length,
    0,
  );

  /** Klavye gezintisi: yalnizca ACIK gruplarin satirlari, render sirasiyla. */
  const navRows = React.useMemo(
    () =>
      visibleGroups
        .filter((group) => group.expanded)
        .flatMap((group) =>
          group.matches.map((model) => ({ provider: group.provider, id: model.id })),
        ),
    [visibleGroups],
  );

  const selected =
    groups
      .find((group) => group.provider === provider)
      ?.models.find((model) => model.id === modelId) ?? null;

  const selectedGroup = groups.find((group) => group.provider === provider);

  /* Disari tiklaninca kapat. */
  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function toggleGroup(target: AiProvider): void {
    setActiveIndex(-1);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }

  function choose(nextProvider: AiProvider, nextModel: string): void {
    onSelect(nextProvider, nextModel);
    setOpen(false);
    setSearch("");
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (navRows.length === 0) return;

      setActiveIndex((current) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = current + step;
        if (next < 0) return navRows.length - 1;
        if (next >= navRows.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      const row = navRows[activeIndex];
      if (row) {
        event.preventDefault();
        choose(row.provider, row.id);
      }
    }
  }

  /** Render sirasindaki mutlak satir numarasi - klavye vurgusu icin. */
  let navCursor = -1;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
          setSearch("");
          setActiveIndex(-1);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">
            {selected?.label || modelId || "Model seçin"}
          </span>
          {selectedGroup ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {selectedGroup.providerLabel}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md">
          {/*
            Arama kutusu kaydirma alaninin DISINDA: 300 modelin arasinda
            asagi inerken de gorunur kalmali. Ayrica zeminine `bg-muted`
            veriliyor - liste ile ayni renkte oldugunda gozden kaciyordu.
          */}
          <div className="border-b bg-muted/40 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`${totalCount} model içinde ara: gpt-4o, claude, deepseek...`}
                className="h-9 bg-background pl-9"
                aria-label="Model ara"
              />
            </div>

            {searching ? (
              <p className="px-1 pt-1.5 text-xs text-muted-foreground">
                {matchCount === 0
                  ? "Eşleşme yok."
                  : `${matchCount} model bulundu.`}
              </p>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto py-1" role="listbox" aria-label="Modeller">
            {visibleGroups.every((group) => group.matches.length === 0) ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aramaya uyan model yok.
              </p>
            ) : (
              visibleGroups.map((group) => {
                if (searching && group.matches.length === 0) return null;

                return (
                  <div key={group.provider}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.provider)}
                      aria-expanded={group.expanded}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      {group.expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 text-sm font-semibold">
                        {group.providerLabel}
                      </span>
                      {group.keyMissing ? (
                        <Badge variant="warning" className="text-[0.65rem]">
                          Anahtar gerekli
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {searching
                          ? `${group.matches.length}/${group.total}`
                          : `${group.total} model`}
                      </span>
                    </button>

                    {group.expanded
                      ? group.matches.map((model) => {
                          navCursor += 1;
                          const index = navCursor;

                          return (
                            <ModelRow
                              key={`${group.provider}:${model.id}`}
                              model={model}
                              selected={
                                group.provider === provider &&
                                model.id === modelId
                              }
                              active={index === activeIndex}
                              onHover={() => setActiveIndex(index)}
                              onClick={() => choose(group.provider, model.id)}
                            />
                          );
                        })
                      : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tek satir                                                                 */
/* -------------------------------------------------------------------------- */

interface ModelRowProps {
  model: AvailableModel;
  selected: boolean;
  /** Klavyeyle uzerinde durulan satir. */
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}

function ModelRow({ model, selected, active, onHover, onClick }: ModelRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center justify-between gap-3 py-2 pl-9 pr-3 text-left transition-colors",
        active ? "bg-muted" : "",
        selected ? "bg-primary/10" : "",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {selected ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : null}
          <span className="truncate text-sm">{model.label}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
            {model.id}
          </span>
          {model.recommended ? (
            <Badge variant="success" className="shrink-0 gap-1 text-[0.6rem]">
              <Sparkles className="h-2.5 w-2.5" />
              Önerilen
            </Badge>
          ) : null}
        </span>
      </span>

      {/*
        Fiyati bilinmeyen model BOS birakilmiyor.

        Fiyat, OpenRouter'in acik listesinden eslenerek bulunuyor; orada
        karsiligi olmayan (cogunlukla yeni ya da "preview") modellerde tutar
        cikarilamiyor. Bos birakmak "bedava mi?" diye okunuyordu.
      */}
      <span className="shrink-0 text-right">
        {model.cost ? (
          <>
            <span className="block text-sm font-semibold tabular-nums">
              {model.cost}
            </span>
            <span className="block text-[0.7rem] text-muted-foreground">
              10 soru
            </span>
          </>
        ) : (
          <span className="block text-[0.7rem] text-muted-foreground">
            fiyat bilinmiyor
          </span>
        )}
      </span>
    </button>
  );
}
