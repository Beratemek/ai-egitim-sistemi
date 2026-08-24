"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { subjectSearchKey } from "@/lib/subjects";
import { cn } from "@/lib/utils";

/**
 * Serbest metin girisi - yazdikca daha once girilmis degerleri altta onerir.
 *
 * Adi DERS icin konuldu ve varsayilanlari hala oyle; ama eslestirme kurali
 * (Turkce normalizasyon) ve davranisi alandan bagimsiz. KONU alani da ayni
 * bileseni kullaniyor: iki alan da "daha once ne yazmistim" sorusunu
 * cevaplamak zorunda ve ikisi de serbest metin. Ikinci bir kopya yazmak,
 * klavye/erisilebilirlik davranisinin zamanla ayrismasi demekti.
 *
 * NEDEN native <datalist> DEGIL:
 *   - Eslesmeyi tarayici yapar ve kurali TURKCE DEGILDIR: "matematik" yazan
 *     egitmene "MATEMATİK" secenegi cikmiyordu.
 *   - Gorunumu isletim sistemi cizer; koyu temada beyaz bir kutu olarak
 *     acilir, uygulamanin geri kalanina benzemez.
 *   - Klavyeyle gezilemez, ekran okuyucuya "combobox" olarak tanitilmaz.
 *
 * SERBEST METIN KORUNUR: liste bir kisitlama degil, kisayoldur. Egitmen
 * listede olmayan yeni bir ders adi yazabilir - "Ders atanmamis" durumundan
 * cikmanin tek yolu bu.
 *
 * Kaydedilen deger her zaman kullanicinin gordugu yazimdir; oneriden secilince
 * listedeki KANONIK yazim gelir. Suzme icin `subjectSearchKey` kullanilir ve
 * o deger asla saklanmaz - yetki eslesmesi hala `subjectKey` ile yapilir
 * (bkz. lib/subjects.ts).
 */

export interface SubjectComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Secilebilir degerler; soru havuzundan turetilir. */
  options: readonly string[];
  /**
   * Oneri listesinin ekran okuyucuya verilen adi.
   *
   * Ders disinda bir alanda kullanilirken "Eşleşen dersler" yanlis olurdu -
   * ekran okuyucu kullanicisi konu listesini ders sanirdi.
   */
  listLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Enter'a basildiginda (oneri listesi kapaliyken) calisir - kaydetmek icin. */
  onEnter?: () => void;
  className?: string;
  "aria-describedby"?: string;
}

/** Oneri listesinde en fazla kac satir gosterilsin. */
const GORUNEN_ONERI = 8;

export function SubjectCombobox({
  id,
  value,
  onChange,
  options,
  listLabel = "Eşleşen dersler",
  placeholder,
  disabled = false,
  onEnter,
  className,
  "aria-describedby": describedBy,
}: SubjectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  /** Klavyeyle uzerinde durulan satir; -1 = hicbiri. */
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const sarmalayiciRef = React.useRef<HTMLDivElement>(null);
  const listeRef = React.useRef<HTMLUListElement>(null);

  const eslesenler = React.useMemo(() => {
    const aranan = subjectSearchKey(value);
    const havuz = aranan
      ? options.filter((option) => subjectSearchKey(option).includes(aranan))
      : options;

    /*
      Basi tutanlar once. "fi" yazan biri "Fizik"i "Astrofizik"ten once
      gormeli; icinde-gecen eslesme de listede kalir ama asagida.
    */
    if (!aranan) return [...havuz].slice(0, GORUNEN_ONERI);

    const basta: string[] = [];
    const icinde: string[] = [];
    for (const option of havuz) {
      if (subjectSearchKey(option).startsWith(aranan)) basta.push(option);
      else icinde.push(option);
    }
    return [...basta, ...icinde].slice(0, GORUNEN_ONERI);
  }, [options, value]);

  /* Disariya tiklayinca kapan. */
  React.useEffect(() => {
    if (!open) return;

    function disariTiklandi(event: MouseEvent) {
      if (!sarmalayiciRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", disariTiklandi);
    return () => document.removeEventListener("mousedown", disariTiklandi);
  }, [open]);

  /* Klavyeyle inilen satir gorunur alanin disina tasmasin. */
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    listeRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const listeAcik = open && eslesenler.length > 0;

  function sec(option: string) {
    onChange(option);
    setOpen(false);
    setActiveIndex(-1);
  }

  function tusaBasildi(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((current) =>
        eslesenler.length === 0 ? -1 : (current + 1) % eslesenler.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      setActiveIndex((current) =>
        eslesenler.length === 0
          ? -1
          : (current - 1 + eslesenler.length) % eslesenler.length,
      );
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        // Liste aciksa Enter/Escape once LISTEYI hedefler; ust bilesenin
        // (or. pencerenin) kapanmasini tetiklemesin.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "Enter") {
      if (listeAcik && activeIndex >= 0) {
        event.preventDefault();
        sec(eslesenler[activeIndex]!);
        return;
      }
      // Liste kapaliysa Enter kaydetme kisayoludur.
      onEnter?.();
      return;
    }

    if (event.key === "Tab" && listeAcik) setOpen(false);
  }

  const listeId = id ? `${id}-oneriler` : undefined;

  return (
    <div ref={sarmalayiciRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={tusaBasildi}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={listeAcik}
        aria-controls={listeAcik ? listeId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          listeAcik && activeIndex >= 0 && listeId
            ? `${listeId}-${activeIndex}`
            : undefined
        }
        aria-describedby={describedBy}
      />

      {listeAcik ? (
        <ul
          ref={listeRef}
          id={listeId}
          role="listbox"
          aria-label={listLabel}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {eslesenler.map((option, index) => {
            const secili = subjectSearchKey(option) === subjectSearchKey(value);

            return (
              <li key={option}>
                <button
                  id={listeId ? `${listeId}-${index}` : undefined}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  /*
                    onMouseDown + preventDefault: input'un blur olmasini
                    engeller. Aksi halde blur listeyi kapatir ve tiklama
                    hicbir zaman onClick'e ulasmaz.
                  */
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => sec(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    index === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60",
                  )}
                >
                  <span className="truncate">{option}</span>
                  {secili ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
