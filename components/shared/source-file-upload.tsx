"use client";

import * as React from "react";
import {
  ChevronDown,
  FileText,
  Loader2,
  Paperclip,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExtractTextResult } from "@/app/api/extract-text/route";
import type { ApiResponse } from "@/lib/types";

/** Kullaniciya gosterilen ve `accept` niteligine yazilan bicimler. */
const ACCEPTED = ".pdf,.docx,.txt,.md";

export interface SourceFileUploadProps {
  /** Su anki kaynak metin - "Metni goster" onizlemesinde kullanilir. */
  value: string;
  /** Cikarilan metin hazir oldugunda cagrilir; form bunu kaynak metin alanina yazar. */
  onExtracted: (text: string) => void;
  disabled?: boolean;
}

/**
 * Kaynak metni dosyadan yukleme.
 *
 * Dosya sunucuda (`POST /api/extract-text`) cozumlenir, yalnizca duz metin
 * geri doner ve kaynak metin alanina yazilir. Kullanici metni gorup
 * duzenleyebildigi icin modele ne gittigi seffaf kalir - dosya hicbir yere
 * kaydedilmez.
 */
export function SourceFileUpload({
  value,
  onExtracted,
  disabled = false,
}: SourceFileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [pending, setPending] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [loaded, setLoaded] = React.useState<ExtractTextResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showText, setShowText] = React.useState(false);

  async function handleFile(file: File) {
    setPending(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/extract-text", { method: "POST", body });
      const result = (await response.json()) as ApiResponse<ExtractTextResult>;

      if (!result.ok) throw new Error(result.error);

      setLoaded(result.data);
      onExtracted(result.data.text);

      toast.success("Metin cikarildi", {
        description: `${result.data.fileName} - ${result.data.chars.toLocaleString("tr")} karakter${
          result.data.truncated ? " (kirpildi)" : ""
        }`,
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Dosya okunurken hata olustu.";
      setError(message);
      toast.error("Dosya okunamadi", { description: message });
    } finally {
      setPending(false);
      // Ayni dosya tekrar secilebilsin diye girdi sifirlanir.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clear() {
    setLoaded(null);
    setError(null);
    setShowText(false);
    onExtracted("");
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        aria-label="Kaynak dosya sec"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {loaded ? (
        /* ---------- Yuklendi ---------- */
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{loaded.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {loaded.chars.toLocaleString("tr")} karakter
                {loaded.pages !== undefined ? ` · ${loaded.pages} sayfa` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0 gap-1.5 text-muted-foreground"
              onClick={clear}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" />
              Kaldir
            </Button>
          </div>

          {/*
            Kirpma sessizce gecilmemeli: 169 sayfalik bir kitaptan yalnizca ilk
            40.000 karakter modele gider, geri kalani hic gormez.
          */}
          {loaded.truncated ? (
            <p className="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-2 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Metin 40.000 karaktere kirpildi; modele yalnizca bastaki bolum gidiyor.
                Daha isabetli sorular icin ilgili bolumu ayirip yuklemeniz onerilir.
              </span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowText((current) => !current)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary"
            aria-expanded={showText}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showText && "rotate-180")}
            />
            {showText ? "Metni gizle" : "Metni goster"}
          </button>

          {showText ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-2.5 text-xs leading-relaxed">
              {value}
            </pre>
          ) : null}
        </div>
      ) : (
        /* ---------- Birakma alani ---------- */
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !pending) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (disabled || pending) return;
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
            dragging ? "border-primary bg-primary/5" : "bg-muted/20",
          )}
        >
          <div className="flex items-center gap-2.5">
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Dosyadan yukle</p>
              <p className="text-xs text-muted-foreground">
                PDF, Word (.docx), TXT · surukleyip birakabilirsiniz · en fazla 10 MB
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={disabled || pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Okunuyor...
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5" />
                Dosya sec
              </>
            )}
          </Button>
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
