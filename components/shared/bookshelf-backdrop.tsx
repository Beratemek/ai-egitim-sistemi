/**
 * Kitap rafı arka planı.
 *
 * Ürünün ne olduğunu ilk bakışta söyleyen dekoratif katman: sayfanın altında
 * duran, rafa dizilmiş kitap sırtları. Tamamı elle çizilmiş SVG - hiçbir
 * görsel dosyası, hiçbir dış kaynak yok; renkler tema değişkenlerinden
 * geldiği için açık/koyu temada kendiliğinden uyuyor.
 *
 * Yoğunluk bilinçli olarak düşük: fark edilmeli ama okumayı bölmemeli.
 * `aria-hidden` çünkü hiçbir bilgi taşımıyor.
 */

export interface BookshelfBackdropProps {
  /** Rafın ekranın altına mı yoksa üstüne mi oturacağı. */
  position?: "bottom" | "top";
  className?: string;
}

/**
 * Rafa dizili kitaplar: genişlik / yükseklik / eğim / cilt rengi.
 *
 * Renkler tek tek verildi çünkü gerçek bir raf ritimsizdir; sırayla dönen
 * bir palet "desen" gibi durur, kitap gibi durmaz. Yükseklikler de bilerek
 * düzensiz.
 */
const KITAPLAR: readonly {
  w: number;
  h: number;
  tilt: number;
  band: boolean;
  book: number;
}[] = [
  { w: 26, h: 132, tilt: 0, band: true, book: 4 },
  { w: 18, h: 118, tilt: 0, band: false, book: 1 },
  { w: 34, h: 146, tilt: 0, band: true, book: 3 },
  { w: 14, h: 104, tilt: 0, band: false, book: 8 },
  { w: 22, h: 138, tilt: -6, band: true, book: 5 },
  { w: 30, h: 122, tilt: 0, band: false, book: 2 },
  { w: 16, h: 150, tilt: 0, band: true, book: 7 },
  { w: 24, h: 112, tilt: 0, band: false, book: 6 },
  { w: 20, h: 140, tilt: 4, band: true, book: 1 },
  { w: 32, h: 126, tilt: 0, band: false, book: 4 },
  { w: 15, h: 108, tilt: 0, band: true, book: 2 },
  { w: 28, h: 144, tilt: 0, band: false, book: 3 },
  { w: 21, h: 130, tilt: 0, band: true, book: 8 },
  { w: 36, h: 116, tilt: 0, band: false, book: 5 },
  { w: 17, h: 148, tilt: -3, band: true, book: 6 },
  { w: 27, h: 124, tilt: 0, band: false, book: 7 },
];

export function BookshelfBackdrop({
  position = "bottom",
  className,
}: BookshelfBackdropProps) {
  const TABAN = 160;
  const BOSLUK = 5;

  let x = 0;
  const raflar = KITAPLAR.map((kitap) => {
    const item = { ...kitap, x };
    x += kitap.w + BOSLUK;
    return item;
  });

  const genislik = x;

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none absolute inset-x-0 overflow-hidden",
        position === "bottom" ? "bottom-0" : "top-0 rotate-180",
        className ?? "",
      ].join(" ")}
    >
      <svg
        viewBox={`0 0 ${genislik} ${TABAN + 12}`}
        preserveAspectRatio="xMidYMax slice"
        className="h-[190px] w-full sm:h-[240px]"
        role="presentation"
      >
        {/* Rafın kendisi */}
        <rect
          x="0"
          y={TABAN}
          width={genislik}
          height="6"
          rx="2"
          fill="hsl(var(--foreground))"
          opacity="0.28"
        />

        {raflar.map((kitap, index) => {
          const y = TABAN - kitap.h;

          return (
            <g
              key={index}
              className="animate-kitap-yukselir"
              style={{ animationDelay: `${index * 45}ms` }}
              transform={
                kitap.tilt
                  ? `rotate(${kitap.tilt} ${kitap.x + kitap.w / 2} ${TABAN})`
                  : undefined
              }
            >
              {/* Sırt */}
              <rect
                x={kitap.x}
                y={y}
                width={kitap.w}
                height={kitap.h}
                rx="2"
                fill={`hsl(var(--book-${kitap.book}))`}
                opacity="0.42"
              />

              {/* Sırttaki iki şerit: kitabı "kutu"dan ayıran ayrıntı */}
              {kitap.band ? (
                <>
                  <rect
                    x={kitap.x + 3}
                    y={y + 14}
                    width={kitap.w - 6}
                    height="3"
                    fill="hsl(var(--background))"
                    opacity="0.7"
                  />
                  <rect
                    x={kitap.x + 3}
                    y={y + kitap.h - 22}
                    width={kitap.w - 6}
                    height="3"
                    fill="hsl(var(--background))"
                    opacity="0.7"
                  />
                </>
              ) : null}

              {/* Geniş kitaplarda sırt yazısını temsil eden çizgiler */}
              {kitap.w >= 24 ? (
                <rect
                  x={kitap.x + kitap.w / 2 - 1}
                  y={y + 28}
                  width="2"
                  height={kitap.h - 58}
                  fill="hsl(var(--background))"
                  opacity="0.5"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
