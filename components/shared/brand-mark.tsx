import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandSymbolProps = {
  className?: string;
  inverse?: boolean;
};

type BrandMarkProps = {
  className?: string;
  href?: string;
  inverse?: boolean;
  showTagline?: boolean;
};

/**
 * İzometri marka sembolü.
 *
 * KAVRAM - DÖNME. Matematikte izometri, uzaklığı koruyan dönüşümlerdir: dönme,
 * yansıma, öteleme. İşaret bunlardan dönmeyi kendi üzerinde gösteriyor: tek bir
 * kare, merkez etrafında 120° aralıklarla üç kez yerleştirilmiş. Yani üç ayrı
 * şekil değil, AYNI şeklin üç konumu - üçüncü dereceden dönme simetrisi.
 * Markanın adı ne diyorsa biçim onu yapıyor.
 *
 * ÖLÇÜLER TARAYICIDA HESAPLANDI, göz kararı değil. `getBBox()` ile ölçülen
 * gerçek sınır kutusu 75.37 x 66.02 idi - yani 72'lik tuvali YATAYDA AŞIYORDU
 * ve kareler sağ/sol kenardan kırpılıyordu. Gelen dosyadaki `scale(0.84)`
 * yetmiyordu; doğru değer 0.8215 ve merkeze oturtan öteleme (6.42, 6.79).
 *
 * `stroke-width` 5.6 yerine 6.82: ölçek küçültüldüğü için çizgi de küçülüyordu,
 * telafi edilmeseydi işaret 16 pikselde sararıp kaybolacaktı. 6.82 x 0.8215
 * ekranda yine 5.6 eder.
 *
 * SINIRI BILEREK YAZIYORUM: bu işaret detay yüklü - üç iç içe geçmiş KONTUR
 * kare. 32 piksel ve üstünde iyi okunuyor, 16 pikselde (tarayıcı sekmesi)
 * ayrıntı kayboluyor ve tek bir leke gibi duruyor. Favicon için sadeleşmiş bir
 * varyant (tek kare, ya da kontur yerine dolu) gerekirse burası değiştirilecek
 * yerdir.
 *
 * KAP İŞARETİN PARÇASI, süs değil: tek renk ve kontur bir çizim zeminsiz
 * kullanıldığında kayboluyor. Kap ayrıca favicon, avatar ve uygulama simgesi
 * gibi KARE alanlara doğal oturuyor.
 *
 * `inverse` koyu/renkli zeminler için ters kilit verir (krem kap, zümrüt
 * işaret) - zümrüt kap koyu yeşil bir zeminin üstünde eriyordu.
 *
 * KONTRAST ölçüldü: kâğıt işaret / zümrüt kap = 5.14:1, grafik öğeleri için
 * gereken 3:1 sınırının rahat üstünde.
 */
export function BrandSymbol({ className, inverse = false }: BrandSymbolProps) {
  const kap = inverse ? "#FDFAF2" : "#177866";
  const isaret = inverse ? "#177866" : "#FDFAF2";

  return (
    <svg
      aria-hidden
      className={cn("shrink-0", className)}
      viewBox="0 0 72 72"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="72" height="72" rx="16" fill={kap} />
      <g
        transform="translate(6.42 6.79) scale(0.8215)"
        fill="none"
        stroke={isaret}
        strokeWidth="6.82"
        strokeLinejoin="miter"
      >
        {/*
          TEK kare, uc konum. Ayni `<rect>` tanimi 0/120/240 derece
          dondurulerek tekrarlaniyor - kod da fikri tekrarliyor: bir sekil ve
          onun donmeleri. Karenin kendi 20 derecelik egimi, uclusun pervane
          gibi durmasini sagliyor; egim olmasa uc kare ust uste binip tek bir
          yildiza donusuyordu.
        */}
        {[0, 120, 240].map((aci) => (
          <g key={aci} transform={`rotate(${aci} 36 36)`}>
            <rect
              x="23"
              y="9"
              width="26"
              height="26"
              transform="rotate(20 36 22)"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** İzometri yatay marka kilidi. Sunucu bileşenidir. */
export function BrandMark({
  className,
  href = "/",
  inverse = false,
  showTagline = true,
}: BrandMarkProps) {
  return (
    <Link
      aria-label="İzometri ana sayfa"
      href={href}
      className={cn("group flex min-w-0 items-center gap-2.5", className)}
    >
      <BrandSymbol
        className="h-9 w-9 transition-transform duration-500 ease-out group-hover:-rotate-2 group-hover:scale-[1.03]"
        inverse={inverse}
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "truncate font-sans text-[16px] font-bold tracking-[-0.045em]",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          İzometri
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 truncate text-[10px] font-medium tracking-[-0.01em]",
              inverse ? "text-primary-foreground/68" : "text-muted-foreground",
            )}
          >
            Öğrenmeyi görünür kıl.
          </span>
        ) : null}
      </span>
    </Link>
  );
}
