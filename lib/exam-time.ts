/** Milisaniyeyi sinav sayacinda kullanilan SS:DD:SS / DD:SS bicimine cevirir. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export interface DeadlineInput {
  /** Sinavin acik oldugu pencerenin sonu. */
  endsAt: string | null;
  /** Ogrenci basina sure (dakika); yoksa yalnizca pencere baglar. */
  durationMinutes: number | null;
  /** Ogrencinin denemeyi baslattigi an; baslamadiysa null. */
  startedAt: string | null;
}

/**
 * Ogrenciyi baglayan ETKIN bitis ani.
 *
 * Iki ayri kisit var ve HANGISI ONCE BITERSE o baglar:
 *   - Pencere:  sinavin acik oldugu tarih araligi (herkes icin ayni)
 *   - Sure:     denemeyi baslattigi andan itibaren taninan dakika (kisiye ozel)
 *
 * 40 dakikasi olan ama pencerenin bitmesine 10 dakika kala baslayan ogrenci
 * 10 dakika alir. Ikisi de yoksa sinir yoktur.
 *
 * Veritabanindaki karsiligi: public.exam_attempt_deadline(). Ikisi ayni
 * kurali uygulamali - bu yalnizca sayac ve durum icin, ASIL KISIT
 * veritabanindadir; sayaci durdurmak cevabin gitmesini engellemez.
 */
export function effectiveDeadline({
  endsAt,
  durationMinutes,
  startedAt,
}: DeadlineInput): Date | null {
  const pencere = endsAt ? new Date(endsAt).getTime() : null;

  const sure =
    durationMinutes !== null && startedAt
      ? new Date(startedAt).getTime() + durationMinutes * 60_000
      : null;

  const adaylar = [pencere, sure].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  if (adaylar.length === 0) return null;
  return new Date(Math.min(...adaylar));
}
