/**
 * Tarz hafizasinin KAPSAM secimi.
 *
 * Icerik uzmaninin begeni/red kayitlari modele few-shot ornek olarak
 * veriliyor. Onceden hicbir kapsam yoktu: son kayitlar ders ayrimi olmadan
 * aliniyordu ve tarih dersinde "sozel olsun" diye verilen geri bildirim
 * matematik uretimini de sekillendiriyordu. Iki dersin soru tarzi ayni
 * olmadigi icin bu bir kusurdu.
 *
 * Secim mantigi veritabanindan ayri tutuldu: kural sinanabilir olmali.
 */

// Goreli yol: bu modul birim testinden dogrudan cagriliyor ve Node test
// calistiricisi tsconfig yol takma adlarini ("@/lib/...") cozemiyor. Yalnizca
// TIP alan satirlar derlemede silindigi icin takma ad kullanabilir.
import { subjectKey } from "./subjects.ts";
import type { StyleScope } from "@/lib/types";

/**
 * Kapsam daralirken en az kac ornek aranir.
 *
 * Tek ornek "tarz" olusturmuyor - modelin o tek soruyu kopyalamasina yol
 * aciyor. Iki ornek en az bir ortakligi gorunur kiliyor.
 */
export const KONU_ESIGI = 2;

/** Kapsam secimi icin gereken en az alan kumesi. */
export interface ScopedRow {
  subject: string | null;
  topic: string;
}

export interface StyleScopeInput {
  subject?: string;
  topic?: string;
}

export interface ScopeSelection<T> {
  rows: T[];
  scope: StyleScope;
}

/**
 * Kayitlari kapsamina gore suzer ve hangi kapsamin kullanildigini bildirir.
 *
 * Kademeli daralma:
 *
 *   1. AYNI DERS + AYNI KONU  - en az `KONU_ESIGI` ornek varsa yalnizca bunlar
 *   2. AYNI DERS              - en az 1 ornek varsa yalnizca bunlar
 *   3. GENEL                  - ders hakkinda hic geri bildirim yoksa
 *
 * 3. adima yalnizca ders TAMAMEN bossa dusuluyor: o derste tek bir ornek bile
 * varsa baska derslerin tarzi karismiyor. Hicbir ornek olmamasi, yanlis
 * dersin ornegini almaktan iyi degil - bu yuzden son basamak duruyor. Genel
 * kapsam prompt'ta "baska derslerden" diye isaretleniyor, boylece model onu
 * birebir tarz emri saymiyor.
 */
export function selectStyleScope<T extends ScopedRow>(
  rows: readonly T[],
  scope: StyleScopeInput = {},
): ScopeSelection<T> {
  if (rows.length === 0) return { rows: [], scope: "genel" };

  const wantedSubject = scope.subject?.trim() ? subjectKey(scope.subject) : null;
  const wantedTopic = scope.topic?.trim() ? subjectKey(scope.topic) : null;

  if (!wantedSubject) return { rows: [...rows], scope: "genel" };

  const sameSubject = rows.filter(
    (row) => row.subject && subjectKey(row.subject) === wantedSubject,
  );

  if (sameSubject.length === 0) return { rows: [...rows], scope: "genel" };

  if (wantedTopic) {
    const sameTopic = sameSubject.filter(
      (row) => subjectKey(row.topic) === wantedTopic,
    );
    if (sameTopic.length >= KONU_ESIGI) return { rows: sameTopic, scope: "konu" };
  }

  return { rows: sameSubject, scope: "ders" };
}
