/**
 * Ders adi karsilastirmasi.
 *
 * Ders yetkisi iki yerde eslestiriliyor:
 *   - Veritabani: `teaches_subject()` icinde SQL `lower()`
 *   - Arayuz:     secenek listesini tekillestirirken JS
 *
 * Bu ikisi AYNI kurali kullanmak zorunda. Kullanilmasi gereken kural
 * Postgres'in `lower()` davranisidir, cunku yetkiyi nihai olarak O belirler.
 *
 * DIKKAT - burada `toLocaleLowerCase("tr")` KULLANILMAZ. Turkce kurali
 * "MATEMATİK" -> "matematik" verir; Postgres'in varsayilan (en_US.UTF-8)
 * collation'i ise "matemati̇k" (i + birlesik nokta) verir. Arayuz Turkce
 * kurali kullansaydi iki taraf ayrilirdi: yonetici listede tek bir
 * "Matematik" gorur, ama veritabani onu sinavin dersiyle eslestiremez ve
 * hoca kendi dersindeki sinavi goremezdi.
 *
 * Sonuc olarak I/İ iceren farkli yazimlar listede AYRI secenek olarak
 * gorunur. Bu bilincli: veritabani da onlari ayri saydigi icin gosterim
 * gerceyi yansitir.
 */

/** Iki ders adi ayni mi? Karsilastirma anahtari. */
export function subjectKey(subject: string): string {
  return subject.trim().toLowerCase();
}

/**
 * Elle yazilmis bir ders adini bilinen secenege oturtur.
 *
 * "biyoloji" yazan egitmenin sinavi, yoneticinin "Biyoloji" olarak verdigi
 * yetkiyle eslessin diye kanonik yazim tercih edilir. Eslesme yoksa girdi
 * oldugu gibi korunur - yeni bir ders adi olabilir.
 */
export function canonicalizeSubject(
  input: string,
  options: readonly string[],
): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const key = subjectKey(trimmed);
  return options.find((option) => subjectKey(option) === key) ?? trimmed;
}
