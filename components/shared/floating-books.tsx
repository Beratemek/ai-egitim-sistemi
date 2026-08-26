/**
 * Kenar cubugunun dekoratif zemini: havada suzulen silik kitaplar.
 *
 * NEDEN DEGISTI: burada once `.bg-shelf` vardi - dibe yapisik, sert dikey
 * cizgilerden olusan bir "raf". Krem acik temada o cizgiler zeminden
 * ayrisiyor, rol kartinin arkasinda desen gibi degil KIR gibi duruyordu.
 *
 * Yerine dagilmis, egik, cok silik kitap siluetleri kondu. Iki kural:
 *   1. HICBIR BILGI TASIMAZ  -> aria-hidden, pointer-events yok.
 *   2. MENUYU BASTIRMAZ      -> ustte tamamen seffaf, asagi indikce belirir
 *      (mask-image). Menu baglantilari her zaman net okunur; desen yalnizca
 *      bos kalan alt bosluga hayat verir.
 *
 * Renkler `--book-1..8` jetonlarindan gelir; acik ve koyu temada ayri
 * tanimlilar, bu yuzden motif iki temada da kendiliginden dogru tonlanir.
 */

interface Kitap {
  /** Yuzde cinsinden konum - kenar cubugu genisligi degisse de bozulmaz. */
  x: number;
  y: number;
  /** Derece. */
  aci: number;
  /** Kitap boyu (SVG birimi). */
  boy: number;
  /** --book-N jetonu. */
  renk: number;
  opaklik: number;
}

/*
  Konumlar ELLE secildi, rastgele uretilmedi: rastgelelik her cizimde
  degisip hydration uyusmazligi uretirdi ve kitaplar bazen ust uste
  binerdi. Bu dizilim ust bolgeyi (menu) bilerek bos birakir.
*/
const KITAPLAR: readonly Kitap[] = [
  { x: 16, y: 46, aci: -18, boy: 26, renk: 4, opaklik: 0.1 },
  { x: 74, y: 39, aci: 24, boy: 21, renk: 2, opaklik: 0.09 },
  { x: 44, y: 58, aci: -7, boy: 30, renk: 3, opaklik: 0.11 },
  { x: 86, y: 62, aci: -29, boy: 18, renk: 8, opaklik: 0.09 },
  { x: 24, y: 72, aci: 33, boy: 23, renk: 1, opaklik: 0.1 },
  { x: 62, y: 79, aci: -14, boy: 28, renk: 7, opaklik: 0.1 },
  { x: 10, y: 89, aci: 11, boy: 20, renk: 6, opaklik: 0.09 },
  { x: 88, y: 92, aci: -22, boy: 24, renk: 5, opaklik: 0.09 },
  { x: 48, y: 96, aci: 19, boy: 17, renk: 2, opaklik: 0.08 },
];

export function FloatingBooks({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        /*
          Ust %35 tamamen seffaf: menu baglantilarinin arkasi temiz kalir.
          Asagi dogru yavasca aciliyor - kitaplar "dibe cokmus" degil,
          bosluga dagilmis gorunsun diye gecis genis tutuldu.
        */
        maskImage:
          "linear-gradient(to bottom, transparent 0%, transparent 34%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.95) 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, transparent 34%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.95) 100%)",
      }}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        {KITAPLAR.map((kitap, index) => (
          <g
            key={index}
            transform={`translate(${kitap.x} ${kitap.y}) rotate(${kitap.aci})`}
            opacity={kitap.opaklik}
          >
            {/* Kapak */}
            <rect
              x={-kitap.boy / 2}
              y={-kitap.boy / 3}
              width={kitap.boy}
              height={(kitap.boy * 2) / 3}
              rx={1.6}
              fill={`hsl(var(--book-${kitap.renk}))`}
            />
            {/* Sirt: kapagin sol kenarinda koyu bir serit */}
            <rect
              x={-kitap.boy / 2}
              y={-kitap.boy / 3}
              width={kitap.boy * 0.16}
              height={(kitap.boy * 2) / 3}
              rx={1.2}
              fill={`hsl(var(--book-${kitap.renk}))`}
              opacity={0.85}
            />
            {/* Sayfa agzi: sagda ince acik cizgi */}
            <rect
              x={kitap.boy / 2 - kitap.boy * 0.09}
              y={-kitap.boy / 3 + kitap.boy * 0.06}
              width={kitap.boy * 0.07}
              height={(kitap.boy * 2) / 3 - kitap.boy * 0.12}
              rx={0.8}
              fill="hsl(var(--card))"
              opacity={0.5}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
