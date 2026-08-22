/**
 * Panel kenarlarındaki kitap yığınları.
 *
 * Geniş ekranlarda içerik sütununun iki yanında geniş boş şeritler kalıyordu;
 * ekran "dümdüz" duruyordu. Buraya üst üste yığılmış kitaplar konuldu:
 * ürünün ne olduğunu söyleyen, okumayı bölmeyen bir dolgu.
 *
 * Kitaplar YATAY duruyor - dar bir şeritte dikey sırtlar çubuk grafiğe
 * benzerken, yığılmış ciltler açıkça kitap okunuyor. Her cildin genişliği ve
 * rengi farklı; gerçek bir yığında da hiçbir kitap diğerinin aynı değil.
 *
 * Tamamı dekoratif: `aria-hidden`, `pointer-events-none` ve yalnızca xl ve
 * üzeri ekranlarda görünür. Dar ekranda içerik için yer bırakmak, süslemeden
 * önce gelir.
 */

export interface SideBooksProps {
  side: "left" | "right";
  className?: string;
}

/** Yığındaki ciltler: genişlik, kalınlık, renk numarası, eğim. */
const YIGIN: readonly {
  w: number;
  h: number;
  book: number;
  tilt: number;
}[] = [
  { w: 96, h: 16, book: 4, tilt: 0 },
  { w: 84, h: 13, book: 2, tilt: -1.2 },
  { w: 100, h: 19, book: 1, tilt: 0.8 },
  { w: 78, h: 12, book: 6, tilt: 0 },
  { w: 92, h: 17, book: 3, tilt: -0.9 },
  { w: 88, h: 14, book: 8, tilt: 1.4 },
  { w: 104, h: 21, book: 5, tilt: 0 },
  { w: 80, h: 13, book: 7, tilt: -1.6 },
  { w: 96, h: 16, book: 2, tilt: 0 },
  { w: 86, h: 18, book: 4, tilt: 1 },
  { w: 74, h: 12, book: 6, tilt: 0 },
  { w: 98, h: 15, book: 1, tilt: -0.7 },
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
      <div
        className={[
          "flex flex-col-reverse items-end gap-[3px] px-3 pb-6",
          sol ? "items-start" : "items-end",
        ].join(" ")}
      >
        {YIGIN.map((kitap, index) => (
          <div
            key={index}
            className={sol ? "animate-kitap-soldan" : "animate-kitap-sagdan"}
            style={{
              // Kademeli gecikme: yigin alttan uste dogru kurulmus gibi
              // gorunsun, hepsi ayni anda belirmesin.
              animationDelay: `${index * 60}ms`,
            }}
          >
            <div
              className="relative rounded-[3px] shadow-sm"
              style={{
                width: `${kitap.w}px`,
                height: `${kitap.h}px`,
                background: `hsl(var(--book-${kitap.book}) / 0.55)`,
                transform: `rotate(${kitap.tilt}deg)`,
              }}
            >
              {/* Sayfa kenari: cildin ic tarafinda acik bir serit */}
              <span
                className="absolute inset-y-[2px] rounded-[2px] bg-background/70"
                style={
                  sol
                    ? { right: "3px", width: "5px" }
                    : { left: "3px", width: "5px" }
                }
              />

              {/* Sirttaki bant */}
              <span
                className="absolute inset-y-[3px] w-[2px] rounded-full bg-background/50"
                style={sol ? { left: "10px" } : { right: "10px" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
