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

/**
 * "Tum dersler" yetkisini temsil eden joker deger.
 *
 * `instructor_subjects` icinde bu degeri tasiyan satir "her derse yetkili"
 * demektir. Tek tek her dersi isaretlemekten farki: ders listesinden BAGIMSIZ
 * oldugu icin YARIN EKLENEN dersi de kapsar. Icerik uzmani yeni bir ders
 * adiyla soru urettiginde "her derse yetkili" hocanin kapsami kendiliginden
 * genisler.
 *
 * Veritabanindaki karsiligi: public.all_subjects_token()
 */
export const ALL_SUBJECTS = "*";

/** Bu kullaniciya "tum dersler" yetkisi verilmis mi? */
export function hasAllSubjects(subjects: readonly string[]): boolean {
  return subjects.includes(ALL_SUBJECTS);
}

/** Ekranda gosterilecek ad; joker deger okunabilir metne cevrilir. */
export function subjectLabel(subject: string): string {
  return subject === ALL_SUBJECTS ? "Tüm dersler" : subject;
}

/**
 * ARAMA icin normalizasyon - KIMLIK KARSILASTIRMASI ICIN DEGIL.
 *
 * `subjectKey` bilerek duz `toLowerCase()` kullanir cunku yetkiyi nihai
 * olarak Postgres'in `lower()`u belirler (bkz. dosyanin basi). Ama o kural
 * ARAMA icin kotudur: kullanici "matematik" yazdiginda "MATEMATİK" secenegi
 * eslesmemeli miydi? Eslesmiyordu, cunku "İ".toLowerCase() birlesik noktali
 * bir karakter uretir.
 *
 * Bu fonksiyon YALNIZCA "yazdikca oneri suzme" icin kullanilir. Sonucu asla
 * kaydedilmez, karsilastirilmaz, yetki kararina girmez: kullanici bir oneriye
 * tikladiginda kaydedilen sey listedeki KANONIK yazimdir. Bu yuzden burada
 * Turkce kurallari serbestce kullanilabilir.
 *
 * Turkce klavye olmadan da aranabilsin diye i/ı, s/ş, g/ğ, c/ç, o/ö, u/ü
 * tek harfe indirgenir: "ogrenme" -> "ogrenme", "Öğrenme" -> "ogrenme".
 */
export function subjectSearchKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}
