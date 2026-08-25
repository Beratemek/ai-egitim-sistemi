"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markExamResultViewed } from "@/app/actions/submissions";

/**
 * Sonuc sayfasi gercekten acildiginda okundu bilgisini kaydeder. Sonuclar
 * listesini ziyaret etmek tek basina sonucu "goruldu" saymaz.
 */
export function ResultViewMarker({ examId }: { examId: string }) {
  const router = useRouter();
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    void markExamResultViewed(examId)
      .then((result) => {
        if (result.ok) router.refresh();
      })
      .catch(() => {
        // Bildirim takibi, sonuc ekraninin goruntulenmesini engellememeli.
      });
  }, [examId, router]);

  return null;
}
