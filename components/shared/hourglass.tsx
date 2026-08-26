import { cn } from "@/lib/utils";

/**
 * Bekleme gostergesi: kum saati.
 *
 * NEDEN DONEN CEMBER DEGIL: donen cember "bir sey oluyor" der ama neyin
 * bekledigini soylemez ve her uygulamada ayni gorunur. Kum saati urunun
 * kagit/kitap dilini surduruyor ve "sabir" duygusunu tasiyor.
 *
 * Uc katmanli animasyon (globals.css icindeki keyframe'ler):
 *   1. kum-saati-cevir : govde 180 derece doner - saat ters cevrildi.
 *   2. kum-ust         : ust hazne bosalir.
 *   3. kum-alt         : alt hazne dolar.
 * Ucu de AYNI sureye (2.4sn) bagli; boylece kum bittigi anda saat cevrilir.
 *
 * `prefers-reduced-motion` acikken hicbiri oynamaz - hareket duyarliligi
 * olan kullanicida donup duran bir nesne birakmak dogru olmaz. O durumda
 * saat yari dolu, sabit bir simge olarak kalir.
 */
export function Hourglass({ className }: { className?: string }) {
  return (
    <span
      className={cn("kum-saati inline-block", className)}
      role="status"
      aria-label="Yükleniyor"
    >
      <svg viewBox="0 0 24 34" className="h-full w-full" aria-hidden>
        {/* Ust ve alt kapaklar */}
        <rect x="2" y="0" width="20" height="2.6" rx="1.3" fill="currentColor" />
        <rect x="2" y="31.4" width="20" height="2.6" rx="1.3" fill="currentColor" />

        {/* Cam govde */}
        <path
          d="M4.5 2.6h15c0 5.4-5.2 7.6-5.2 14.4S19.5 26 19.5 31.4h-15c0-5.4 5.2-7.6 5.2-14.4S4.5 8 4.5 2.6Z"
          fill="currentColor"
          opacity={0.12}
        />
        <path
          d="M4.5 2.6h15c0 5.4-5.2 7.6-5.2 14.4S19.5 26 19.5 31.4h-15c0-5.4 5.2-7.6 5.2-14.4S4.5 8 4.5 2.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.1}
          opacity={0.55}
        />

        {/*
          Kum. clipPath cam govdenin ta kendisi: kum haznenin disina tasmaz,
          dikdortgenin yuksekligi degistikce dolu/bos gorunur.
        */}
        <clipPath id="kum-saati-cam">
          <path d="M4.5 2.6h15c0 5.4-5.2 7.6-5.2 14.4S19.5 26 19.5 31.4h-15c0-5.4 5.2-7.6 5.2-14.4S4.5 8 4.5 2.6Z" />
        </clipPath>

        <g clipPath="url(#kum-saati-cam)">
          <rect className="kum-ust" x="3" y="3" width="18" height="13" fill="currentColor" />
          <rect className="kum-alt" x="3" y="18" width="18" height="13" fill="currentColor" />
          {/* Ince akis cizgisi - iki hazne arasinda */}
          <rect className="kum-akis" x="11.4" y="15" width="1.2" height="5" fill="currentColor" />
        </g>
      </svg>
    </span>
  );
}

/**
 * "Yukleniyor" seridi: kum saati + kisa metin.
 *
 * Iskeletin ustunde durur. Iskelet "sayfanin duzeni bu olacak" der; bu serit
 * "hala calisiyorum" der. Ikisi birlikte, bos ekranda beklemenin aksine,
 * gecisi ilerliyor gosterir.
 */
export function LoadingBanner({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <Hourglass className="h-5 w-auto text-primary" />
      <span>{label}</span>
    </div>
  );
}
