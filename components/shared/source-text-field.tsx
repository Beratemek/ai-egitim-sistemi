"use client";

import * as React from "react";
import { FileUp, Type } from "lucide-react";

import { SourceFileUpload } from "@/components/shared/source-file-upload";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Mode = "yapistir" | "dosya";

export interface SourceTextFieldProps {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}

/**
 * Kaynak metin alanı: iki yol, tek deger.
 *
 * "Metni yapıştır" sekmesinde duz bir metin alanı, "Dosya yükle" sekmesinde
 * PDF/Word/TXT yukleyici gösterilir. İki sekme AYNI degeri paylasir; dosya
 * yukleyip sekme degistirirseniz cikarilan metni gorup düzenleyebilirsiniz.
 *
 * Dosya sekmesinde büyük metin alanı BILINCLI Olarak gosterilmez - yüklenen
 * dosyanin ozeti yeterlidir, metni gormek isteyen "Metni göster"e basar.
 */
export function SourceTextField({
  value,
  onChange,
  disabled = false,
}: SourceTextFieldProps) {
  const [mode, setMode] = React.useState<Mode>("yapistir");

  return (
    <div className="space-y-2">
      <Label htmlFor={mode === "yapistir" ? "context" : undefined}>Kaynak metin</Label>

      <Tabs value={mode} onValueChange={(next) => setMode(next as Mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="yapistir" className="gap-1.5">
            <Type className="h-3.5 w-3.5" />
            Metni yapıştır
          </TabsTrigger>
          <TabsTrigger value="dosya" className="gap-1.5">
            <FileUp className="h-3.5 w-3.5" />
            Dosya yükle
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "yapistir" ? (
        <>
          <Textarea
            id="context"
            rows={8}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Soruların üretileceği ders metnini buraya yapıştırın..."
            className="resize-y"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            En az 20 karakter. Model yalnızca bu metinden dogrulanabilir sorular üretir.
          </p>
        </>
      ) : (
        <SourceFileUpload value={value} onExtracted={onChange} disabled={disabled} />
      )}
    </div>
  );
}
