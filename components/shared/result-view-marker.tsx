"use client";

import { useEffect, useRef } from "react";

import { markExamResultViewed } from "@/app/actions/submissions";

/**
 * Sonuc sayfasi gercekten acildiginda okundu bilgisini kaydeder. Sonuclar
 * listesini ziyaret etmek tek basina sonucu "goruldu" saymaz.
 */
export function ResultViewMarker({ examId }: { examId: string }) {
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    void markExamResultViewed(examId).catch(() => {
      // Bildirim takibi, sonuc ekraninin goruntulenmesini engellememeli.
    });
  }, [examId]);

  return null;
}
