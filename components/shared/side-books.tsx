/**
 * Panel kenarlarındaki kitaplık.
 *
 * İlk deneme yatay yığılmış ciltlerdi; uniform yuvarlak kutular olduğu için
 * kitaptan çok çubuk grafiğe benziyordu. Bu sürümde kitaplar RAFTA DİK
 * duruyor: farklı yükseklikte sırtlar, aralarında birkaç yatık cilt, altta
 * gerçek bir raf tahtası. Yükseklik farkı ve yatık ciltler olmadan sıra
 * hâlâ "çubuk" gibi okunuyordu.
 *
 * Tamamı dekoratif: `aria-hidden`, `pointer-events-none` ve yalnızca xl ve
 * üzeri ekranlarda görünür. Dar ekranda içerik için yer bırakmak süslemeden
 * önce gelir.
 */

export interface SideBooksProps {
  side: "left" | "right";
  className?: string;
}

/** Bir rafta duran ciltler: genişlik, yükseklik, renk, eğim. */
type Cilt = { w: number; h: number; book: number; tilt?: number };

/** Raflar aşağıdan yukarıya. Her raf kendi ritmini taşır. */
const RAFLAR: readonly Cilt[][] = [
  [
    { w: 13, h: 74 },
    { w: 9, h: 62, book: 2 },
    { w: 16, h: 82, book: 4 },
    { w: 8, h: 56, book: 8 },
    { w: 12, h: 70, book: 3, tilt: -7 },
    { w: 18, h: 66, book: 5 },
    { w: 10, h: 78, book: 7 },
  ].map((c, i) => ({ book: (i % 8) + 1, ...c })),
  [
    { w: 10, h: 58, book: 6 },
    { w: 15, h: 72, book: 1 },
    { w: 8, h: 64, book: 3 },
    { w: 13, h: 80, book: 8 },
    { w: 17, h: 60, book: 4, tilt: 5 },
    { w: 9, h: 68, book: 2 },
  ],
  [
    { w: 14, h: 66, book: 5 },
    { w: 8, h: 54, book: 7 },
    { w: 11, h: 76, book: 2 },
    { w: 16, h: 62, book: 6 },
    { w: 10, h: 70, book: 1, tilt: -5 },
  ],
];

/** Rafın en üstüne yatık konmuş bir cilt - dik sıranın tekdüzeliğini kırar. */
const YATIK: readonly { raf: number; w: number; h: number; book: number }[] = [
  { raf: 0, w: 34, h: 9, book: 6 },
  { raf: 2, w: 28, h: 8, book: 3 },
];

export function SideBooks({ side, className }: SideBooksProps) {
  const sol = side === "left";

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none fixed bottom-0 z-0 hidden select-none xl:block",
        sol ? "left-0" : "right-0",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex flex-col justify-end gap-5 px-4 pb-8">
        {RAFLAR.map((raf, rafIndex) => {
          const yatik = YATIK.find((item) => item.raf === rafIndex);

          return (
            <div key={rafIndex} className="flex flex-col items-start">
              {/* Ciltler */}
              <div
                className={[
                  "flex items-end gap-[2px]",
                  sol ? "justify-start" : "justify-end",
                ].join(" ")}
              >
                {raf.map((cilt, index) => (
                  <span
                    key={index}
                    className={sol ? "animate-kitap-soldan" : "animate-kitap-sagdan"}
                    style={{
                      animationDelay: `${(rafIndex * 7 + index) * 45}ms`,
                    }}
                  >
                    <span
                      className="relative block rounded-t-[2px]"
                      style={{
                        width: `${cilt.w}px`,
                        height: `${cilt.h}px`,
                        background: `hsl(var(--book-${cilt.book}) / 0.42)`,
                        transform: cilt.tilt
                          ? `rotate(${cilt.tilt}deg)`
                          : undefined,
                        transformOrigin: "bottom center",
                      }}
                    >
                      {/* Sırttaki bantlar */}
                      <span className="absolute inset-x-[2px] top-[9px] h-[2px] rounded-full bg-background/55" />
                      <span className="absolute inset-x-[2px] bottom-[11px] h-[2px] rounded-full bg-background/55" />

                      {/* Geniş ciltlerde sırt yazısı izlenimi */}
                      {cilt.w >= 13 ? (
                        <span className="absolute inset-y-[18px] left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-background/35" />
                      ) : null}
                    </span>
                  </span>
                ))}

                {/* Yatık cilt: dik sıranın yanına devrilmiş gibi */}
                {yatik ? (
                  <span
                    className={[
                      "self-end",
                      sol ? "animate-kitap-soldan" : "animate-kitap-sagdan",
                    ].join(" ")}
                    style={{ animationDelay: `${rafIndex * 120 + 200}ms` }}
                  >
                    <span
                      className="relative ml-[3px] block rounded-[2px]"
                      style={{
                        width: `${yatik.w}px`,
                        height: `${yatik.h}px`,
                        background: `hsl(var(--book-${yatik.book}) / 0.42)`,
                      }}
                    >
                      <span className="absolute inset-y-[2px] left-[6px] w-[2px] rounded-full bg-background/55" />
                    </span>
                  </span>
                ) : null}
              </div>

              {/* Raf tahtası */}
              <span
                className="mt-[2px] block h-[3px] rounded-full bg-foreground/[0.14]"
                style={{ width: "100%", minWidth: "108px" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
