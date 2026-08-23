"use client";

import * as React from "react";
import { Check, CornerDownLeft, Loader2, Plus, Target, X } from "lucide-react";
import { toast } from "sonner";

import { createOutcome } from "@/app/actions/questions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchOutcomes } from "@/lib/outcome-core";
import type { LearningOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Kazanim alani: YAZARKEN ARAYAN alan.
 *
 * Onceki surumde iki ayri yuzey vardi ve ikisi de kotu calisiyordu:
 *
 *   1. Acilir liste ("Serbest metin yaz" + 62 kazanim). Kazanim sayisi
 *      buyudukce kullanilmaz hale geliyordu; aradigini bulmak icin listeyi
 *      gozle taramak gerekiyordu ve secim yapilmadan once ne yazacagini
 *      bilmek zorundaydin.
 *   2. Sayfanin yanindaki "Tanimli kazanimlar" kutusu. Salt okunurdu;
 *      oradan bir sey secilemiyordu, yalnizca yer kapliyordu.
 *
 * Simdi tek alan var ve ad arar gibi calisiyor: yazmaya basladigin anda
 * eslesenler altta beliriyor. Birini secersen soru O KAZANIMA baglanir;
 * secmezsen yazdigin metin serbest kazanim olarak gider.
 *
 * Eslesme iki sinyali birlestirir (bkz. lib/outcome-core.ts searchOutcomes):
 * yarim yazilmis kelime icin ALT DIZI, farkli kelimelerle ayni seyi yazan
 * icin CEKIRDEK BENZERLIGI.
 */

export interface OutcomeSearchFieldProps {
  /** Yazilan kazanim metni. */
  value: string;
  onValueChange: (value: string) => void;
  /** Secili kayitli kazanimin kimligi; serbest metinde bos. */
  selectedId: string;
  /** Kayitli bir kazanim secildi ya da secim kaldirildi. */
  onSelect: (outcome: LearningOutcome | null) => void;
  outcomes: readonly LearningOutcome[];
  /**
   * Yeni kazanim kaydetmek icin gereken baglam.
   *
   * Kazanim tek basina anlamli degil: hangi dersin hangi konusunu olctugu
   * bilinmeden kaydedilemez (createOutcome ucunu de zorunlu tutuyor).
   * Formdaki Ders/Konu alanlarindan geliyor.
   */
  subject: string;
  topic: string;
  /** Kayit sonrasi listenin tazelenmesi icin. */
  onCreated?: () => void;
  disabled?: boolean;
}

export function OutcomeSearchField({
  value,
  onValueChange,
  selectedId,
  onSelect,
  outcomes,
  subject,
  topic,
  onCreated,
  disabled = false,
}: OutcomeSearchFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const selected = React.useMemo(
    () => outcomes.find((outcome) => outcome.id === selectedId) ?? null,
    [outcomes, selectedId],
  );

  const matches = React.useMemo(
    () => (selected ? [] : searchOutcomes(value, outcomes)),
    [value, outcomes, selected],
  );

  // Liste degisince vurgu basa donsun; yoksa kisalan listede var olmayan bir
  // satir secili kalip Enter hicbir sey yapmiyordu.
  React.useEffect(() => {
    setHighlight(0);
  }, [value]);

  // Liste eslesme OLMASA DA acilir: kaydetme satiri orada duruyor. Yoksa
  // yeni bir kazanim yazan kullanici (hicbir sey eslesmez) hicbir zaman
  // kaydetme yolunu goremezdi.
  const yazildi = value.trim().length >= 2;
  const open = focused && !selected && (matches.length > 0 || yazildi);

  function choose(outcome: LearningOutcome) {
    onSelect(outcome);
    setFocused(false);
  }

  /**
   * Yazilan metni yeni kazanim olarak kaydeder.
   *
   * Ayri bir "Kazanim tanimla" formu YOK; tanimlama da secim de bu alanda
   * oluyor. Once sayfanin tepesinde ayri bir bolum vardi, ama kazanim yazmak
   * ile kazanim secmek ayni anda yapilan iki is degil - kullanici uretim
   * formunu doldururken aradigini bulamayinca yukari cikip baska bir forma
   * gecmek zorunda kaliyordu.
   */
  async function saveNew() {
    const metin = value.trim();
    if (!metin) return;

    if (!subject.trim() || !topic.trim()) {
      toast.error("Ders ve konu gerekli", {
        description: "Kazanımı kaydetmek için önce Ders ve Konu alanlarını doldurun.",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await createOutcome({
        subject,
        topic,
        outcomeText: metin,
      });

      if (!result.ok) {
        // Tekrar uyarisi: cok benzer bir kazanim zaten varsa createOutcome
        // reddediyor ve hangisi oldugunu soyluyor.
        toast.error("Kazanım kaydedilemedi", { description: result.error });
        return;
      }

      toast.success("Kazanım kaydedildi", {
        description: "Üretilen sorular bu kazanıma bağlanacak.",
      });
      onSelect(result.data.outcome);
      setFocused(false);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => (current - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      // Form ICINDE oldugumuz icin Enter varsayilan olarak gonderirdi;
      // liste acikken tercih secim olmali.
      const secilen = matches[highlight];
      if (secilen) {
        event.preventDefault();
        choose(secilen);
      }
    } else if (event.key === "Escape") {
      setFocused(false);
    }
  }

  /* ---------- Kayitli kazanim secili ---------- */
  if (selected) {
    return (
      <div className="space-y-2">
        <Label>Kazanım</Label>
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-relaxed">
              {selected.outcome_text}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.subject ? `${selected.subject} · ` : ""}
              {selected.topic} — üretilen sorular bu kazanıma bağlanacak.
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            disabled={disabled}
            onClick={() => onSelect(null)}
            aria-label="Kazanım seçimini kaldır"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- Serbest yazim + canli arama ---------- */
  return (
    <div className="space-y-2">
      <Label htmlFor="kazanim">Kazanım</Label>

      <div className="relative">
        <Input
          id="kazanim"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => setFocused(true)}
          // Tiklama listedeki bir satira gidiyorsa blur ondan ONCE calisir;
          // gecikme olmadan liste kapanip secim hic gerceklesmezdi.
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder="Öğrenci fotosentezin evrelerini açıklar."
        />

        {open ? (
          <ul
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
            role="listbox"
          >
            {matches.map((outcome, index) => (
              <li key={outcome.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(outcome)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors",
                    index === highlight ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      index === highlight ? "text-primary" : "text-transparent",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-relaxed">
                      {outcome.outcome_text}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {outcome.subject ? `${outcome.subject} · ` : ""}
                      {outcome.topic}
                    </span>
                  </span>
                </button>
              </li>
            ))}

            {/* Kaydetme satiri: eslesen yoksa TEK secenek budur. */}
            <li className={cn(matches.length > 0 && "mt-1 border-t pt-1")}>
              <button
                type="button"
                disabled={saving || disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void saveNew()}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-relaxed">
                    Yeni kazanım olarak kaydet
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {subject.trim() && topic.trim()
                      ? `${subject} · ${topic} altına yazılır`
                      : "Önce Ders ve Konu alanlarını doldurun"}
                  </span>
                </span>
              </button>
            </li>

            {matches.length > 0 ? (
              <li className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground">
                <CornerDownLeft className="h-3 w-3" />
                Seçmek için Enter
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {yazildi && matches.length === 0 ? (
          <>
            Eşleşen kayıtlı kazanım yok. Kaydetmezseniz bu metin{" "}
            <strong>serbest kazanım</strong> olarak gider; gelişim raporunda
            kazanım kırılımı çıkmaz.
          </>
        ) : (
          "Yazmaya başlayın; benzer kazanımlar altta listelenir. Yenisini de aynı yerden kaydedebilirsiniz."
        )}
      </p>
    </div>
  );
}
