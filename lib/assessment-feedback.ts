/**
 * Çoktan seçmeli ön değerlendirme mesajı.
 *
 * Doğru seçenek burada özellikle yer almaz: aynı alan sınav sonuçlanmadan
 * öğrencinin güvenli submission görünümüne de dönebildiği için cevap anahtarı
 * geri bildirim metnine gömülmemelidir.
 */
export function buildTestFeedback(isCorrect: boolean): string {
  return isCorrect ? "Doğru cevap." : "Yanlış cevap.";
}
