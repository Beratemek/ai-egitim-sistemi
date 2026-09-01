/**
 * `page-flip` (StPageFlip) icin tip bildirimi.
 *
 * NEDEN ELLE YAZILDI: paket kendi tiplerini gondermiyor - package.json'da
 * `types` alani yok ve `@types/page-flip` diye bir paket de mevcut degil.
 * Bildirim olmadan `strict` modda import bile derlenmiyor.
 *
 * KAPSAM BILINCLI OLARAK DAR: burada yalnizca projede GERCEKTEN cagrilan
 * uyeler var. Kutuphanenin tamamini yeniden yazmak, kullanmadigimiz
 * imzalarin yanlis olmasi riskini bedavaya satin almak olurdu; yanlis bir
 * tip, tip yokluğundan daha tehlikeli.
 *
 * Yeni bir uye kullanilacaksa once buraya eklenmeli.
 */
declare module "page-flip" {
  export interface PageFlipSettings {
    /** Tek bir sayfanin genisligi (piksel). Kitap yatay modda bunun iki kati. */
    width: number;
    height: number;
    /** "fixed" sabit olcu, "stretch" kapsayiciya uyum saglar. */
    size: "fixed" | "stretch";
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    /** Ilk yaprak kapak gibi tek basina dursun mu. */
    showCover: boolean;
    /** Dar ekranda tek sayfaya dusmeye izin ver. */
    usePortrait: boolean;
    /** Dokunmatikte dikey kaydirma tarayicida kalsin. */
    mobileScrollSupport: boolean;
    drawShadow: boolean;
    maxShadowOpacity: number;
    flippingTime: number;
    useMouseEvents: boolean;
    /** Sayfaya tiklayarak cevirmeyi kapatir. */
    disableFlipByClick: boolean;
    /** Tiklamalari sayfanin icindeki a/button ogelerine iletir. */
    clickEventForward: boolean;
    swipeDistance: number;
    startPage: number;
    startZIndex: number;
    autoSize: boolean;
    showPageCorners: boolean;
  }

  /**
   * Olay yuku olaya gore DEGISIYOR:
   *   "flip"        -> yeni yaprak numarasi (sayi)
   *   "changeState" -> "user_fold" | "flipping" | "read" (metin)
   * Bu yuzden tip birlesim; kullanim yerinde `typeof` ile daraltiliyor.
   */
  export interface PageFlipEvent {
    data: number | string;
    object: PageFlip;
  }

  export type PageFlipEventName =
    | "flip"
    | "changeOrientation"
    | "changeState"
    | "init"
    | "update";

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<PageFlipSettings>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    turnToPage(pageNum: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    on(event: PageFlipEventName, callback: (e: PageFlipEvent) => void): PageFlip;
    off(event: PageFlipEventName): void;
  }
}
