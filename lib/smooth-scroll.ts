/**
 * Sakin, denetimli sayfa kaydirma.
 *
 * NEDEN CSS DEGIL: `scroll-behavior: smooth` yumusatir ama SURESINI
 * ayarlamaya izin vermez - tarayici kendi (kisa) suresini kullanir. Karsilama
 * sayfasindaki bolumler uzun; oraya atlarken hizli bir kaydirma "sayfa
 * zipladi" hissi veriyordu. Burada sure ve egri bizde.
 *
 * NEDEN ANIMASYON: baglantilar duz `<a href="#...">` idi, yani tarayici hic
 * kaydirmadan ANINDA konumlaniyordu. Kullanicinin nereden nereye gittigini
 * takip edebilmesi icin arada bir yol olmali.
 */

/**
 * Yumusak giris-cikis: basta hizlanir, sonda YAVASLAYARAK durur.
 *
 * Sonda yavaslamasi onemli: hedefe carparak degil, yerlesip durarak
 * varilmasi "tok" duran bir hareket verir.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface SmoothScrollOptions {
  /** Hedefin ustunde birakilacak bosluk (yapiskan cubuk icin). */
  offset?: number;
  /** Toplam sure (ms). Uzun mesafede kendiliginden bir miktar uzar. */
  duration?: number;
}

/**
 * Verilen elemana kaydirir.
 *
 * Kullanici animasyon sirasinda TEKERLEGE dokunursa animasyon birakilir:
 * sayfayi kullanicinin elinden almak, yavas kaydirmadan daha rahatsiz edici
 * olurdu.
 */
export function smoothScrollToElement(
  target: Element,
  { offset = 0, duration = 900 }: SmoothScrollOptions = {},
): void {
  const baslangic = window.scrollY;
  const hedef = Math.max(
    0,
    Math.min(
      baslangic + target.getBoundingClientRect().top - offset,
      document.documentElement.scrollHeight - window.innerHeight,
    ),
  );

  const mesafe = hedef - baslangic;
  if (Math.abs(mesafe) < 2) return;

  // Hareket duyarliligi: animasyon yok, dogrudan konumlan.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, hedef);
    return;
  }

  /*
    Uzun mesafede sure bir miktar artar ama TAVANI var: sayfanin bir ucundan
    otekine giderken sabit sure kullanmak orayi "roket" gibi hizli yapardi,
    mesafeyle dogru orantili yapmak da bitmeyen bir kaydirma uretirdi.
  */
  const sure = Math.min(duration + Math.abs(mesafe) * 0.28, 1500);

  let baslangicAni: number | null = null;
  let iptal = false;

  const birak = () => {
    iptal = true;
    window.removeEventListener("wheel", birak);
    window.removeEventListener("touchstart", birak);
    window.removeEventListener("keydown", birak);
  };

  window.addEventListener("wheel", birak, { passive: true, once: true });
  window.addEventListener("touchstart", birak, { passive: true, once: true });
  window.addEventListener("keydown", birak, { once: true });

  function adim(an: number) {
    if (iptal) return;
    if (baslangicAni === null) baslangicAni = an;

    const gecen = an - baslangicAni;
    const oran = Math.min(1, gecen / sure);

    window.scrollTo(0, baslangic + mesafe * easeInOutCubic(oran));

    if (oran < 1) {
      window.requestAnimationFrame(adim);
    } else {
      birak();
    }
  }

  window.requestAnimationFrame(adim);
}

/** `#kimlik` bicimindeki bir baglantiyi hedefe kaydirir. */
export function smoothScrollToHash(
  hash: string,
  options?: SmoothScrollOptions,
): boolean {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  const target = document.getElementById(id);
  if (!target) return false;

  smoothScrollToElement(target, options);
  return true;
}
