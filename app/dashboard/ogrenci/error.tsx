"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function StudentDashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">
          Öğrenci bilgileri yüklenemedi
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Bağlantı geçici olarak kesilmiş olabilir. Yazdığınız kaydedilmemiş
          cevaplar bu tarayıcı sekmesinde korunur.
        </p>
        <Button onClick={reset} className="mt-6 gap-2">
          <RotateCcw className="h-4 w-4" />
          Yeniden dene
        </Button>
      </CardContent>
    </Card>
  );
}
