/**
 * Puan olcegi cevrimleri: YUZDE <-> SORU PUANI.
 *
 * Veritabaninda bir cevabin puani her zaman YUZDE tutulur
 * (`submissions.ai_score` ve `instructor_approved_score`, 0-100 arasi CHECK
 * kisitiyla). Sinav toplami ise `exam_questions.points` ile agirliklandirilir:
 * bir sorunun sinavdaki agirligi degistiginde eski cevaplarin yeniden
 * puanlanmasi gerekmesin diye.
 *
 * ARAYUZ ise yuzde konusmaz. Egitmen "bu sorudan 25 uzerinden kac verdim"
 * diye dusunur; ogrenci de karnesinde 25 uzerinden gorur. Bu modul iki dunyayi
 * birbirine cevirir ve cevrim kuralinin TEK kaynagidir - ayni hesap uc ayri
 * dosyada elle yazildiginda yuvarlama farklari birbirini tutmuyordu.
 */

/** Yuzdeyi sorunun puanina cevirir: %85 x 20 puan -> 17. */
export function yuzdedenPuana(yuzde: number, soruPuani: number): number {
  return (yuzde / 100) * soruPuani;
}

/**
 * Soru puanini yuzdeye cevirir: 17 / 20 puan -> %85.
 *
 * Iki ondalige yuvarlanir: sutun `numeric(5,2)`, daha fazlasi zaten kaybolur.
 * `soruPuani` 0 ise bolme yapilamaz; 0 puanlik bir sorudan alinan her cevap
 * yuzde olarak 0 kabul edilir.
 */
export function puandanYuzdeye(puan: number, soruPuani: number): number {
  if (soruPuani <= 0) return 0;
  return Math.round((puan / soruPuani) * 100 * 100) / 100;
}

/**
 * Ekranda gosterilecek puan metni: "17 / 20 puan".
 *
 * Sorunun puani bilinmiyorsa (havuzdan silinmis soru) yuzde olarak birakir;
 * uydurma bir payda yazmaktansa ham degeri gostermek dogru.
 */
export function puanMetni(
  yuzde: number | null,
  soruPuani: number | undefined,
): string {
  if (yuzde === null) return "—";
  if (soruPuani === undefined) return "%" + Math.round(yuzde);

  return `${puanGosterimi(yuzdedenPuana(yuzde, soruPuani))} / ${soruPuani} puan`;
}

/**
 * Ondalik yalnizca GEREKIYORSA yazilir: 17 kalir, 16.5 gorunur.
 *
 * Esik 0.05: yuzde->puan cevriminde 23.33% x 30 = 6.999 gibi degerler cikar,
 * bunlari "7.0" diye gostermek egitmene kendi girmedigi bir ondalik gosterirdi.
 */
export function puanGosterimi(puan: number): string {
  return Math.abs(puan - Math.round(puan)) < 0.05
    ? String(Math.round(puan))
    : puan.toFixed(1);
}

/**
 * Puani TAM PUANA oturtur ve yuzde olarak dondurur.
 *
 * Egitmen sinav kagidinda bucuklu puan vermez: 25 puanlik bir sorudan 20 ya da
 * 21 verilir, 20,83 verilmez. Yuzde once sorunun puanina cevrilir, yuvarlanir,
 * sonra yuzdeye geri donusturulur.
 *
 * Sorunun puani bilinmiyorsa (havuzdan silinmis soru) yuzde yalnizca iki
 * ondalige kirpilir - uydurma bir paydaya gore yuvarlamak daha kotu olurdu.
 *
 * HASSASIYET SINIRI: yuzde sutunu numeric(5,2). 100u tam bolmeyen bir soru
 * puaninda (or. 30) 1 puan %3,33 olarak saklanir ve geri cevrildiginde 0,999
 * doner - 0,001 puanlik bir sapma. Ekranda gorunmez (puanGosterimi yuvarlar)
 * ama sinav toplaminda soru basina bu kadarlik bir kayma olur. Kabul edildi:
 * alternatif, puani mutlak deger olarak saklamak icin tum puanlama zincirini
 * ve mevcut kayitlari tasiyan bir migration demekti.
 */
export function tamPuanaOturt(
  yuzde: number,
  soruPuani: number | undefined,
): number {
  if (soruPuani === undefined || soruPuani <= 0) {
    return Math.round(yuzde * 100) / 100;
  }
  return puandanYuzdeye(Math.round(yuzdedenPuana(yuzde, soruPuani)), soruPuani);
}
