"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { PageFlip } from "page-flip";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FilterX,
  MessageSquareQuote,
  NotebookTabs,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";

import { MistakeCoachDialog } from "@/components/shared/mistake-coach-dialog";
import { QuestionSolution } from "@/components/shared/question-solution";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { QuestionVisual } from "@/components/shared/question-visual";
import { StatCard } from "@/components/shared/stat-card";
import { StudentRecommendationActions } from "@/components/shared/student-recommendation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  availableFilterOptions,
  filterStudentMistakes,
  type StudentMistakeFilterOption,
  type StudentMistakeNotebook,
  type StudentMistakeRecord,
  type StudentMistakeStatus,
} from "@/lib/student-mistakes";
import { cn, formatDateTime } from "@/lib/utils";

const ALL_FILTERS = "__all__";

const STATUS_META: Record<
  StudentMistakeStatus,
  {
    label: string;
    badge: "danger" | "warning" | "outline";
    border: string;
  }
> = {
  yanlis: {
    label: "Yanlış",
    badge: "danger",
    border: "border-l-destructive/70",
  },
  kismi: {
    label: "Eksik öğrenme",
    badge: "warning",
    border: "border-l-warning/70",
  },
  bos: {
    label: "Boş bırakıldı",
    badge: "outline",
    border: "border-l-muted-foreground/40",
  },
};

export function StudentMistakesNotebook({
  notebook,
}: {
  notebook: StudentMistakeNotebook;
}) {
  const [subject, setSubject] = React.useState(ALL_FILTERS);
  const [examId, setExamId] = React.useState(ALL_FILTERS);
  const [outcomeKey, setOutcomeKey] = React.useState(ALL_FILTERS);
  const [status, setStatus] = React.useState(ALL_FILTERS);

  const filters = React.useMemo(
    () => ({
      subject: subject === ALL_FILTERS ? null : subject,
      examId: examId === ALL_FILTERS ? null : examId,
      outcomeKey: outcomeKey === ALL_FILTERS ? null : outcomeKey,
      status: status === ALL_FILTERS ? null : (status as StudentMistakeStatus),
    }),
    [examId, outcomeKey, status, subject],
  );

  const filtered = React.useMemo(
    () => filterStudentMistakes(notebook.records, filters),
    [filters, notebook.records],
  );

  /*
    Secenekler DIGER suzgeclere gore daraliyor: ders secilince kazanim
    listesinde yalnizca o dersin kazanimlari kaliyor. Boylece acilir
    listelerden imkansiz bir birlesim kurulamiyor.
  */
  const secenekler = React.useMemo(
    () => availableFilterOptions(notebook.records, filters),
    [filters, notebook.records],
  );

  /*
    SIRALAMA TERSINE CEVRILINCE OLUSAN CIKMAZ.

    Once kazanim, sonra o kazanimi icermeyen bir ders secilirse mevcut
    kazanim secimi gecersiz kalir ve ekran boslar. Daralan listeler bunu
    tek basina engellemiyor - secim ZATEN yapilmis oluyor. Bu yuzden
    listeden dusen secim kendiliginden temizleniyor: kullanici hicbir zaman
    cikis yolu olmayan bir bosluga dusmuyor.
  */
  React.useEffect(() => {
    const dusenler: Array<[string, StudentMistakeFilterOption[], () => void]> = [
      [subject, secenekler.subjects, () => setSubject(ALL_FILTERS)],
      [examId, secenekler.exams, () => setExamId(ALL_FILTERS)],
      [outcomeKey, secenekler.outcomes, () => setOutcomeKey(ALL_FILTERS)],
      [status, secenekler.statuses, () => setStatus(ALL_FILTERS)],
    ];
    for (const [deger, liste, temizle] of dusenler) {
      if (deger !== ALL_FILTERS && !liste.some((o) => o.value === deger)) {
        temizle();
      }
    }
  }, [examId, outcomeKey, secenekler, status, subject]);

  const hasFilters = [subject, examId, outcomeKey, status].some(
    (value) => value !== ALL_FILTERS,
  );

  function resetFilters() {
    setSubject(ALL_FILTERS);
    setExamId(ALL_FILTERS);
    setOutcomeKey(ALL_FILTERS);
    setStatus(ALL_FILTERS);
  }

  if (notebook.records.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center py-14 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="mt-4 font-display text-xl">Defterin şimdilik boş</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Sonuçlanan sınavlarında tekrar gerektiren, eksik kalan veya boş
            bıraktığın sorular burada bir araya gelecek.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tekrar bekleyen"
          value={notebook.summary.total}
          hint="soru kanıtı"
          icon={NotebookTabs}
          accent="cat1"
        />
        <StatCard
          label="Yanlış cevap"
          value={notebook.summary.wrong}
          hint="yeniden çöz"
          icon={Target}
          accent="cat2"
        />
        <StatCard
          label="Eksik öğrenme"
          value={notebook.summary.partial}
          hint="geri bildirimi incele"
          icon={BookOpenCheck}
          accent="cat3"
        />
        <StatCard
          label="Etkilenen kazanım"
          value={notebook.summary.outcomeCount}
          hint={`${notebook.summary.blank} boş cevap`}
          icon={CircleDashed}
          accent="cat4"
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                label="Ders"
                value={subject}
                allLabel="Tüm dersler"
                options={secenekler.subjects}
                onValueChange={setSubject}
              />
              <FilterSelect
                label="Sınav"
                value={examId}
                allLabel="Tüm sınavlar"
                options={secenekler.exams}
                onValueChange={setExamId}
              />
              <FilterSelect
                label="Kazanım"
                value={outcomeKey}
                allLabel="Tüm kazanımlar"
                options={secenekler.outcomes}
                onValueChange={setOutcomeKey}
              />
              {/*
                Durum secenekleri de sabit degil: diger suzgeclerden gecen
                kayitlarda hic "Bos birakildi" yoksa o secenek gosterilmiyor.
              */}
              <FilterSelect
                label="Durum"
                value={status}
                allLabel="Tüm durumlar"
                options={secenekler.statuses}
                onValueChange={setStatus}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full xl:w-auto"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              <FilterX className="h-4 w-4" />
              Filtreleri temizle
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
            Nihai puanı 60/100 altında kalan veya boş bırakılan {notebook.records.length}
            {" "}kayıttan {filtered.length} tanesi gösteriliyor.
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center py-12 text-center">
            <FilterX className="h-8 w-8 text-muted-foreground/55" />
            <p className="mt-3 font-medium">Bu filtrelerle eşleşen kayıt yok</p>
            <Button
              type="button"
              variant="link"
              className="mt-1"
              onClick={resetFilters}
            >
              Tüm kayıtları göster
            </Button>
          </CardContent>
        </Card>
      ) : (
        <MistakeBook records={filtered} />
      )}
    </div>
  );
}

const SES_ANAHTARI = "izometri:defter-sesi";

/**
 * Sayfa cevirme sesi.
 *
 * DOSYA YOK, SES SENTEZLENIYOR: bir ses dosyasi eklemek projeye ikili bir
 * varlik, lisans sorusu ve her cevirmede bir ag istegi getirirdi. Kagit
 * hisirtisi zaten filtrelenmis gurultuden ibaret - Web Audio ile birkac
 * satirda uretiliyor ve cevrimdisi de calisiyor.
 *
 * TEK BIR AudioContext: her cevirmede yenisini acmak tarayicida ses baglami
 * biriktiriyor; tarayicilarin acik baglam siniri var ve bir sure sonra ses
 * hic cikmiyor. Baglam ILK CEVIRMEDE kuruluyor - yani bir kullanici
 * hareketinin icinde, bu yuzden otomatik oynatma engeline takilmiyor.
 *
 * SUSTURULABILIR: sessiz bir ortamda calisan ogrenci icin her sayfada ses
 * cikmasi rahatsiz edici. Tercih localStorage'da tutuluyor, bir kez
 * kapatilinca kapali kaliyor.
 */
function useSayfaSesi() {
  const baglam = React.useRef<AudioContext | null>(null);
  const [sessiz, setSessiz] = React.useState(false);

  /* Tercih yalnizca tarayicida okunabilir; sunucuda localStorage yok. */
  React.useEffect(() => {
    try {
      setSessiz(window.localStorage.getItem(SES_ANAHTARI) === "kapali");
    } catch {
      /* Depolama kapali olabilir (gizli sekme, katı gizlilik ayari). */
    }
  }, []);

  const sesiDegistir = React.useCallback(() => {
    setSessiz((onceki) => {
      const yeni = !onceki;
      try {
        window.localStorage.setItem(SES_ANAHTARI, yeni ? "kapali" : "acik");
      } catch {
        /* Yazilamazsa tercih yalnizca bu oturumda gecerli olur. */
      }
      return yeni;
    });
  }, []);

  const cal = React.useCallback(() => {
    if (sessiz) return;
    try {
      const Baglam =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Baglam) return;

      baglam.current ??= new Baglam();
      const ctx = baglam.current;
      if (ctx.state === "suspended") void ctx.resume();

      const sure = 0.26;
      const ornekSayisi = Math.floor(ctx.sampleRate * sure);
      const tampon = ctx.createBuffer(1, ornekSayisi, ctx.sampleRate);
      const veri = tampon.getChannelData(0);

      for (let i = 0; i < ornekSayisi; i += 1) {
        const t = i / ornekSayisi;
        /* Cok hizli yukselis, ussel dusus: kagidin tek seferlik hisirtisi. */
        const zarf = Math.min(1, t * 30) * (1 - t) ** 2.4;
        veri[i] = (Math.random() * 2 - 1) * zarf;
      }

      const kaynak = ctx.createBufferSource();
      kaynak.buffer = tampon;

      /* Bant gecirgen suzgec: duz gurultuyu kagit tinisina yaklastiriyor. */
      const suzgec = ctx.createBiquadFilter();
      suzgec.type = "bandpass";
      suzgec.frequency.value = 1900;
      suzgec.Q.value = 0.8;

      const seviye = ctx.createGain();
      seviye.gain.value = 0.18;

      kaynak.connect(suzgec);
      suzgec.connect(seviye);
      seviye.connect(ctx.destination);
      kaynak.start();
    } catch {
      /* Ses bir susleme: basarisiz olursa sayfa yine de cevrilmeli. */
    }
  }, [sessiz]);

  return { cal, sessiz, sesiDegistir };
}

/**
 * Kayitlari GERCEK BIR DEFTER gibi gosterir: iki sayfa yan yana, ortada
 * spiral tel.
 *
 * NEDEN LISTE DEGIL: defterde onlarca kayit olabiliyor ve hepsini alt alta
 * vermek metin duvarina donuyordu - ogrenci kaydiriyor, hicbirini
 * okumuyordu. Sayfa formati TEK kayda odakliyor; bir soruyu bitirmeden
 * digerine gecilmiyor. Ustelik "kacinci sayfadayim" bilgisi biten bir liste
 * hissi veriyor.
 *
 * UC AYRI CEVIRME YOLU: sayfanin iki yanindaki oklar (gercek bir defterde
 * elin gittigi yer), alttaki dugmeler (dokunmatikte bas parmagin ulastigi
 * yer) ve klavye ok tuslari. Ucu de ayni iki islevi cagiriyor.
 */
/* Bir kaydin KAC YAPRAK ettigi: solda soru, sagda degerlendirme. */
const YAPRAK_BASINA = 2;

/*
 * Sayfa cevirmeyi BASLATMAMASI gereken yerler.
 *
 * StPageFlip'in `clickEventForward` ayari yetmiyor. Kutuphanenin kendi
 * kodu su:
 *
 *     checkTarget(t) {
 *       return !clickEventForward || !["a","button"].includes(t.tagName...)
 *     }
 *
 * Iki acigi var:
 *   1. Liste yalnizca `a` ve `button`. `<summary>` yok - yani "Cozumu gor"
 *      satirina tiklayinca cozum aciliyor AMA sayfa da cevriliyordu.
 *   2. DOGRUDAN hedefin etiketine bakiyor, atalarina degil. Dugmenin
 *      icindeki `<svg>` ikona tiklandiginda hedef `svg` oluyor, listede
 *      olmadigi icin sayfa yine cevriliyordu.
 *
 * Bu yuzden korumayi kendimiz yapiyoruz ve `closest` ile ATAYA bakiyoruz.
 */
const ETKILESIMLI_ALAN =
  "button, a, summary, input, textarea, select, [role='region']";

/*
 * NEDEN YEREL DINLEYICI, REACT'IN onMouseDown'i DEGIL:
 *
 * StPageFlip `mousedown`i `.stf__block` uzerinde, KABARMA evresinde
 * dinliyor. React 17'den beri olaylar kok kapsayicida toplaniyor; sayfa
 * icerigi `.stf__block`un ICINDE oldugu icin olay once kutuphaneye, sonra
 * React'e ulasiyor. React tarafinda `stopPropagation` cagirmak GEC kalirdi.
 *
 * Dinleyici yaprak kutusuna baglaniyor: o, `.stf__block`tan daha yakin bir
 * ata oldugu icin once bizim elimize geliyor.
 */
function etkilesimliyseDurdur(olay: Event) {
  const hedef = olay.target;
  if (hedef instanceof Element && hedef.closest(ETKILESIMLI_ALAN)) {
    olay.stopPropagation();
  }
}

/* Tek yapragin olculeri. StPageFlip sabit olcu istiyor - "buyuyup duran
   cerceve" sorununun cozumu de tam olarak bu. */
const YAPRAK_GENISLIK = 420;
const YAPRAK_YUKSEKLIK = 580;

/**
 * Kayitlari GERCEK BIR KITAP gibi gosterir: sayfa kosesinden tutulup
 * cevriliyor, kagit bukuluyor, arkasi gorunuyor.
 *
 * NEDEN StPageFlip: bu efekt elle yazilabilecek bir sey degil. Kivrilan
 * yaprak, kagidin arka yuzu ve kenardaki golge, her karede yeniden
 * hesaplanan bir koni geometrisi - kutuphane bunu canvas uzerinde ciziyor.
 * CSS ile yapilan `rotateY` yalnizca DUZ bir levhayi cevirebiliyordu.
 * (EBA'nin e-kitap goruntuleyicisi de aynisini kullaniyor.)
 *
 * NEDEN SABIT OLCU: onceki surumde sayfa icerige gore uzuyordu; cozum
 * acilinca defter 422px'den 751px'e ciktigi icin "kitap" degil "buyuyen
 * bir cerceve" gibi duruyordu. Artik yaprak sabit: tasan icerik sayfanin
 * KENDI ICINDE kayiyor, tipki basili bir kitapta oldugu gibi.
 *
 * ---------------------------------------------------------------------
 * PORTAL KULLANIMI - bu dosyadaki en onemli karar
 * ---------------------------------------------------------------------
 * StPageFlip, verilen yaprak ogelerini KENDI yapisinin icine TASIYOR.
 * Bu ogeleri React uretmis olsaydi, React kendi tuttugu agacla gercek DOM
 * arasinda uyusmazliga duser ve sokum sirasinda "removeChild" hatasi
 * verirdi - bu, kutuphaneyi React ile birlestirirken en sik dusulen tuzak.
 *
 * Cozum: yaprak KUTULARI elle olusturuluyor (React onlari yonetmiyor,
 * istedigi gibi tasinabilirler), ICERIKLERI ise portal ile basiliyor.
 * Portal yalnizca kabin COCUKLARINI yonetir, kabin kendisini degil - iki
 * taraf da kendi alaninda kaliyor ve kimse otekinin dugumunu tasimiyor.
 *
 * ---------------------------------------------------------------------
 * TEK KULLANIMLIK IC KAP - `destroy()` kabi SILIYOR
 * ---------------------------------------------------------------------
 * `pf.destroy()` yalnizca temizlik yapmiyor, kendisine verilen ogeyi
 * DOM'DAN KALDIRIYOR (olculdu: destroy sonrasi `document.contains(kap)`
 * false, ebeveynin cocuk sayisi 0).
 *
 * Kitap dogrudan React'in `ref`ledigi div uzerine kurulsaydi: React
 * gelistirme modunda her efekti bilerek iki kez calistirir (kur -> temizle
 * -> kur). Ikinci kurulum, birincinin sildigi KOPMUS bir dugum uzerinde
 * olurdu; kopmus ogenin genisligi 0 oldugu icin StPageFlip tek sayfa
 * moduna duser ve HICBIR SEY cizmez - ekranda bos bir alan ve "1 / 78"
 * gibi yaprak sayan bir sayac kalirdi.
 *
 * Bu yuzden her kurulum kendi tek kullanimlik ic kabini yaratiyor.
 * Kutuphane onu silmekte serbest; React'in tuttugu dis kap hic
 * dokunulmadan yerinde kaliyor.
 */
function MistakeBook({ records }: { records: StudentMistakeRecord[] }) {
  const kap = React.useRef<HTMLDivElement>(null);
  const kitap = React.useRef<PageFlip | null>(null);
  const [yapraklar, setYapraklar] = React.useState<HTMLDivElement[]>([]);
  const [aktifYaprak, setAktifYaprak] = React.useState(0);
  /*
    Dar ekranda StPageFlip TEK SAYFA moduna dusuyor ve her cevirme bir
    yaprak ilerliyor - iki degil. Sayac bunu bilmezse "Sonraki"ye basildiginda
    ayni kaydin sag sayfasina gecilir ama numara degismez; kullanici dugmenin
    calismadigini sanir. Bu yuzden hangi modda oldugumuz izleniyor.
  */
  const [tekSayfa, setTekSayfa] = React.useState(false);
  /*
    Spiral telin YASADIGI YER: StPageFlip'in kendi `.stf__block` katmani.

    Tel once kitabin USTUNDE (z-20) duruyordu. Duragan halde dogruydu ama
    yaprak kivrilirken halkalar kagidin ONUNDEN gectigi icin sayfa
    SEFFAFMIS gibi gorunuyordu. Cevirme sirasinda teli sondurmeyi denedim -
    bu sefer de tel yok oluyordu; bir sorunu digeriyle takas etmis oldum.

    DOGRUSU KATMAN SIRASI. Olculdu:
        duran yapraklar z=1 | ALTTAKI acilan z=3 | CEVRILEN z=5 | golge z=10
    Tel z=2'ye konunca duranlarin USTUNDE, cevrilenin ALTINDA kaliyor -
    yani yaprak telin onunden gecerken teli KAPATIYOR. Gercek bir telli
    defterde de olan bu.

    Ama z-index yalnizca AYNI yigin baglaminda karsilastirilir. `.stf__block`
    `perspective` tasidigi icin kendi baglamini yaratiyor; tel disarida
    kaldigi surece araya giremezdi. Bu yuzden tel portal ile o blogun
    ICINE basiliyor.
  */
  const [telKabi, setTelKabi] = React.useState<HTMLElement | null>(null);
  const { cal, sessiz, sesiDegistir } = useSayfaSesi();

  /*
    Ses `cal` her surumde yeni bir islev; efektin bagimliliginda olsaydi
    kitap her seferinde yikilip yeniden kurulurdu. Ref uzerinden okunuyor.
  */
  const calRef = React.useRef(cal);
  React.useEffect(() => {
    calRef.current = cal;
  }, [cal]);

  React.useEffect(() => {
    const disKap = kap.current;
    if (!disKap || records.length === 0) return;

    /* Tek kullanimlik ic kap: `destroy()` bunu silecek, dis kap kalacak. */
    const kutu = document.createElement("div");
    disKap.appendChild(kutu);

    /* Yaprak kutulari: React'in gormedigi, StPageFlip'in tasidigi ogeler. */
    const olusan: HTMLDivElement[] = [];
    for (let i = 0; i < records.length * YAPRAK_BASINA; i += 1) {
      const yaprak = document.createElement("div");
      yaprak.className = "defter-yaprak";
      /* Dugme, baglanti ve <summary> tiklamalari sayfayi cevirmesin. */
      yaprak.addEventListener("mousedown", etkilesimliyseDurdur);
      yaprak.addEventListener("touchstart", etkilesimliyseDurdur, {
        passive: true,
      });
      kutu.appendChild(yaprak);
      olusan.push(yaprak);
    }

    const pf = new PageFlip(kutu, {
      width: YAPRAK_GENISLIK,
      height: YAPRAK_YUKSEKLIK,
      size: "stretch",
      minWidth: 260,
      maxWidth: 480,
      minHeight: 380,
      maxHeight: 660,
      showCover: false,
      /* Dar ekranda tek sayfaya dusuyor - 390px'e iki sayfa sigmiyor. */
      usePortrait: true,
      mobileScrollSupport: true,
      drawShadow: true,
      maxShadowOpacity: 0.45,
      flippingTime: 700,
      useMouseEvents: true,
      /* Sayfadaki dugme ve baglantilar calismaya devam etsin. */
      clickEventForward: true,
      swipeDistance: 30,
    });

    /*
      DINLEYICILER `loadFromHTML`DEN ONCE BAGLANIYOR.

      Yonelim (iki sayfa mi, tek sayfa mi) tam da yukleme sirasinda
      belirleniyor ve `changeOrientation` orada bir kez tetikleniyor.
      Dinleyici sonra baglandiginda bu ilk olay kaciriliyordu: dar ekranda
      kitap tek sayfaya duser ama bilesen bunu duymaz, sayac kayit saymaya
      devam eder ve "Sonraki"ye basildiginda numara degismezdi.
    */
    pf.on("changeOrientation", (olay) => {
      setTekSayfa(olay.data === "portrait");
    });
    pf.on("flip", (olay) => {
      if (typeof olay.data === "number") setAktifYaprak(olay.data);
    });
    /* Ses cevirme BASLARKEN calmali; "flip" olayi bittikten sonra geliyor. */
    pf.on("changeState", (olay) => {
      if (olay.data === "flipping") calRef.current();
    });

    pf.loadFromHTML(olusan);
    kitap.current = pf;
    setYapraklar(olusan);
    setTelKabi(kutu.querySelector<HTMLElement>(".stf__block"));

    return () => {
      pf.destroy();
      kitap.current = null;
      setYapraklar([]);
      setTelKabi(null);
      /* destroy ic kabi zaten siliyor; silmediyse diye garantiye aliniyor. */
      kutu.remove();
    };
  }, [records]);

  const onceki = React.useCallback(() => kitap.current?.flipPrev(), []);
  const sonraki = React.useCallback(() => kitap.current?.flipNext(), []);

  /*
    Klavyeyle cevirme. Girdi alanindayken devre disi - ogrenci bir metin
    kutusuna yaziyorsa ok tuslari imleci hareket ettirmeli, sayfayi degil.
  */
  React.useEffect(() => {
    function tus(event: KeyboardEvent) {
      const hedef = event.target as HTMLElement | null;
      const yaziyor =
        hedef?.tagName === "INPUT" ||
        hedef?.tagName === "TEXTAREA" ||
        hedef?.isContentEditable;
      if (yaziyor) return;

      if (event.key === "ArrowLeft") onceki();
      if (event.key === "ArrowRight") sonraki();
    }
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [onceki, sonraki]);

  if (records.length === 0) return null;

  const toplamYaprak = records.length * YAPRAK_BASINA;

  /*
    Iki sayfali duzende sayac KAYIT sayiyor ("3. soru / 39"); tek sayfali
    duzende YAPRAK sayiyor, cunku orada bir kayit iki cevirme suruyor ve
    kayit saymak numarayi her iki basista bir dondururdu.
  */
  const gosterilen = tekSayfa
    ? aktifYaprak + 1
    : Math.min(records.length, Math.floor(aktifYaprak / YAPRAK_BASINA) + 1);
  const toplam = tekSayfa ? toplamYaprak : records.length;
  const sondayiz = tekSayfa
    ? aktifYaprak >= toplamYaprak - 1
    : gosterilen >= records.length;

  return (
    <div className="space-y-3">
      <div className="defter-tezgah">
        <div ref={kap} className="defter-kitap" />
        {telKabi ? createPortal(<DefterTeli />, telKabi) : null}

        {yapraklar.map((dugum, i) => {
          const kayit = records[Math.floor(i / YAPRAK_BASINA)];
          if (!kayit) return null;
          return createPortal(
            i % YAPRAK_BASINA === 0 ? (
              <MistakePageLeft record={kayit} />
            ) : (
              <MistakePageRight record={kayit} />
            ),
            dugum,
            `${kayit.examId}:${kayit.questionId}:${i % YAPRAK_BASINA}`,
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aktifYaprak === 0}
          onClick={onceki}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
          Önceki
        </Button>

        <p className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">
          <span className="font-display text-base text-foreground">
            {gosterilen}
          </span>{" "}
          / {toplam}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sondayiz}
          onClick={sonraki}
          aria-label="Sonraki sayfa"
        >
          Sonraki
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/*
          Ses acma/kapama cevirme dugmelerinin YANINDA: sesi duyan kisi onu
          tam da cevirdigi anda kapatmak istiyor.
        */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={sesiDegistir}
          aria-pressed={!sessiz}
          aria-label={sessiz ? "Sayfa sesini aç" : "Sayfa sesini kapat"}
          title={sessiz ? "Sayfa sesini aç" : "Sayfa sesini kapat"}
        >
          {sessiz ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Sayfanın köşesinden tutup çevirebilir, alttaki düğmeleri ya da
        klavyenin ok tuşlarını kullanabilirsin.
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={`${label} filtresi`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTERS}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Tek bir yanlis kaydi - defterin ACIK BIR SAYFA CIFTI olarak.
 *
 * SAYFA BOLUNMESI RASTGELE DEGIL:
 *
 *   SOL SAYFA  "ne soruldu, ben ne yazdim"     -> olay
 *   SAG SAYFA  "kac aldim, neden, nasil olmaliydi" -> degerlendirme
 *
 * Ogrenci soldan saga okuyor: once kendi cevabiyla yuzlesiyor, sonra
 * aciklamayi goruyor. Ters sirada olsa gozu dogrudan cozume kayardi.
 *
 * `.exam-paper` KULLANILIYOR: bu sinif kagit renklerini kendi icinde yeniden
 * tanimliyor, yani KOYU TEMADA BILE sayfa acik kaliyor. Gercek bir defter
 * karanlikta siyaha donmez; ustelik kagit zemin uygulamanin geri kalanindan
 * ayrilan "burasi senin defterin" hissini veriyor.
 *
 * MOBILDE cilt gizleniyor ve iki sayfa alt alta yigiliyor - dar ekranda yan
 * yana iki sutun okunmuyor.
 */
/**
 * Defterin spiral teli.
 *
 * SABIT SAYIDA HALKA + KIRPMA: halkalari `justify-around` ile dagitmak
 * denendi, ama o zaman halka araligi sayfa yuksekligiyle degisiyordu -
 * uzun sayfada seyrek, kisa sayfada sik. Gercek bir spiralin adimi
 * sabittir. Bu yuzden bol sayida halka sabit araliklarla diziliyor,
 * tasanlar `overflow-hidden` ile kirpiliyor: yukseklik ne olursa olsun
 * adim ayni kaliyor.
 *
 * IKI YON: genis ekranda iki sayfanin ortasinda dikey; dar ekranda sayfalar
 * alt alta yigildigi icin dikisin uzerinde yatay. Ikisi de `aria-hidden` -
 * tel bir sustur, ekran okuyucuya soylenecek bir sey degil.
 */
/**
 * Defterin spiral teli.
 *
 * SABIT ADIM: halkalari `justify-around` ile dagitmak denenmisti, ama o
 * zaman halka araligi kitap yuksekligiyle degisiyordu. Gercek bir spiralin
 * adimi sabittir; bol halka sabit araliklarla diziliyor, tasanlar
 * kirpiliyor.
 *
 * KITABIN USTUNDE DURUYOR: yapraklar telin ETRAFINDA doniyor - gercek bir
 * telli defterde de sayfa halkalarin ekseninde cevrilir. Tel sabit kalip
 * yapragin onunden gectigi icin donme menteseli gorunuyor.
 *
 * Tek sayfali (dar ekran) modda gizli: orada ortada bir dikis yok.
 */
const TEL_SAYISI = 40;

function DefterTeli() {
  return (
    <div
      aria-hidden
      className="defter-tel-serit pointer-events-none absolute inset-y-0 left-1/2 z-[2] hidden w-12 -translate-x-1/2 flex-col items-center justify-start gap-3 overflow-hidden py-3"
    >
      {Array.from({ length: TEL_SAYISI }).map((_, i) => (
        <span key={i} className="defter-tel h-2 w-10 shrink-0 -rotate-6 rounded-full" />
      ))}
    </div>
  );
}

/**
 * SOL SAYFA - "ne soruldu, ben ne yazdim, dogrusu neymis".
 *
 * Sayfa SABIT YUKSEKLIKTE: basili bir kitapta sayfa icerige gore uzamaz.
 * Tasan icerik sayfanin kendi govdesinde kayiyor; ust serit (numara,
 * durum, ders) kayma disinda kaliyor ki hangi soruda oldugun her zaman
 * gorunsun.
 *
 * COZUM DE BU SAYFADA, sorunun hemen altinda: cozumu okurken sorunun ve
 * kendi cevabinin goz onunde olmasi gerekiyor. Karsi sayfada dururken goz
 * ikisi arasinda gidip geliyordu.
 */
function MistakePageLeft({ record }: { record: StudentMistakeRecord }) {
  const meta = STATUS_META[record.status];

  return (
    <div
      className={cn(
        "exam-paper defter-kagit flex h-full flex-col overflow-hidden border-l-4",
        meta.border,
      )}
    >
      <div className="shrink-0 px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-semibold text-primary">
            {record.questionNumber}
          </span>
          <Badge variant={meta.badge}>{meta.label}</Badge>
          <Badge variant="soft">{record.subject}</Badge>
          <QuestionTypeBadge type={record.questionType} />
          {/*
            SORUNUN AGIRLIGI buraya tasindi.

            Sag sayfada "Aldigin puan" diye bir kart vardi: kocaman
            `0 / 100`. Deftere yalnizca 60 altı kayitlar girdigi ve bunlarin
            ezici cogunlugu "Yanlis" (yani tam 0) oldugu icin o sayi hicbir
            sey soylemiyordu - solundaki "Yanlis" rozeti zaten ayni seyi
            soyluyor. Ustelik ayni puan sinav detay sayfasinda `GradePanel`
            ile zaten gosteriliyor.

            Kaybolmamasi gereken tek bilgi sorunun AGIRLIGIYDI (kac puanlik
            bir soruyu kacirdim). O da buraya, digerlerinin yanina geldi.
          */}
          <Badge variant="outline">
            {number(record.earnedPoints)} / {number(record.questionPoints)} puan
          </Badge>
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          {record.examTitle} · {record.questionNumber}. soru ·{" "}
          {formatDateTime(record.completedAt)}
        </p>
      </div>

      {/*
        TEK KAYDIRMA ALANI: onceki surumde cozumun kendi ic kaydirmasi
        vardi; sayfa da kaydiginda ic ice iki kaydirma olusuyor ve fare
        tekerlegi hangisini surdugu belirsizlesiyordu. Artik sayfanin
        govdesi tek basina kayiyor.
      */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Soru
          </h3>
          <p className="mt-2 text-[15px] font-medium leading-relaxed">
            {record.questionText}
          </p>
          {record.visual ? (
            <QuestionVisual visual={record.visual} className="mt-3" />
          ) : null}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Senin cevabın
          </h3>
          <p
            className={cn(
              "mt-2 whitespace-pre-wrap rounded-lg border bg-background/60 p-3 text-sm leading-relaxed",
              record.status === "bos" && "italic text-muted-foreground",
            )}
          >
            {record.answerDisplay}
          </p>
        </section>

        {/*
          COZUM KAPALI BASLIYOR: kural + adimlar + her sik icin ayri gerekce
          + sonuc uzun bir metin. Kapali olmasi ayrica bir esik - cozumu
          gormek bilincli bir tiklama, ogrenci once kendi cevabina baksin.

          Cozumu olmayan soruda hicbir sey cizilmiyor; uretim toplu betikle
          yapildigi icin "henuz uretilmedi" normal bir durum.
        */}
        {record.solution ? (
          <details className="group/cozum rounded-xl border bg-background/75">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
              <BookOpenCheck className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1">Çözümü gör</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/cozum:rotate-180" />
            </summary>
            <QuestionSolution
              solution={record.solution}
              studentAnswer={record.answerText}
              className="rounded-none border-0 border-t bg-transparent"
            />
          </details>
        ) : null}
      </div>
    </div>
  );
}

/**
 * SAG SAYFA - "kac aldim, hangi kazanim, simdi ne yapayim".
 *
 * Eylem dugmeleri (AI ile calis / planima ekle) kayma alaninin DISINDA,
 * sayfanin dibinde sabit: uzun bir geri bildirimden sonra ogrencinin
 * eylemi bulmak icin asagi kaydirmasi gerekmesin.
 */
function MistakePageRight({ record }: { record: StudentMistakeRecord }) {
  const meta = STATUS_META[record.status];
  const planAction =
    record.status === "bos"
      ? "Soruyu yeniden oku, ilgili kazanımın kısa özetini çıkar ve benzer iki soru çöz."
      : record.status === "yanlis"
        ? "Geri bildirimi incele, hatalı adımı kendi cümlelerinle düzelt ve benzer üç soru çöz."
        : "Eksik kalan adımı tamamla, ardından aynı kazanımdan iki uygulama sorusu çöz.";

  return (
    <div className="exam-paper defter-kagit flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <section className="rounded-xl border border-primary/20 bg-primary/[0.045] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Kazanım odağı
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed">
            {record.outcomeLabel}
          </p>
          {/*
            Kazanim etiketi yoksa konu adina dusuyor; o zaman iki satir da
            AYNI metni yaziyordu. Ayni seyi tekrar etmek bilgi vermiyor.
          */}
          {record.topic && record.topic !== record.outcomeLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">{record.topic}</p>
          ) : null}
        </section>

        {record.aiFeedback ? (
          <FeedbackBlock
            title="Değerlendirme geri bildirimi"
            text={record.aiFeedback}
          />
        ) : null}
        {record.instructorNote ? (
          <FeedbackBlock
            title="Eğitmen notu"
            text={record.instructorNote}
            instructor
          />
        ) : null}
      </div>

      {/*
        EYLEM SERIDI.

        KONUM: sayfanin dibi. Once oradaydi, sonra metne yapistirildi,
        sonra kullanici cizerek yerini gosterdi - yeniden dibe alindi.
        Alt alta durduklari icin artik "bosluga asilmis iki kucuk dugme"
        gibi degil, sayfayi kapatan bir eylem alani gibi okunuyorlar.

        ALT ALTA, yan yana degil: sayfa dar (420px) ve iki dugme yan yana
        sikisinca yazilar daraliyordu. Alt alta olunca ikisi de tam
        genislikte.

        Dugmeler `variant="outline"` ile geliyordu: saydam zemin + soluk
        kenarlik. Krem kagit uzerinde bu, dugme gibi degil metin gibi
        duruyordu - ogrenci tiklanabilir olduklarini fark etmiyordu.

        Renkler BURADA veriliyor, paylasilan bilesenlerde degil: ayni iki
        bilesen baska ekranlarda da kullaniliyor ve oralarda mevcut gorunum
        dogru. Degisiklik yalnizca deftere ait olmali.

        Renkler `globals.css`te adlandirilmis siniflarda: saydam zeminli
        kirmizi ve mavi. Yazi renkleri kagit uzerinde 6.6:1 ve 6.9:1
        kontrast veriyor (WCAG AA esigi 4.5:1).
      */}
      {/*
        SAYFANIN DIBINDE, kaydirma alaninin DISINDA: icerik ne kadar kisa
        olursa olsun eylemler hep ayni yerde durur, uzun geri bildirimde de
        gozden kaybolmaz. Kullanici konumu boyle istedi.
      */}
      <div className="grid shrink-0 gap-2 p-5 pt-0">
        <div className="defter-eylem defter-eylem-kirmizi">
          <MistakeCoachDialog
            examId={record.examId}
            questionId={record.questionId}
            subject={record.subject}
          />
        </div>
        <div className="defter-eylem defter-eylem-mavi">
          <StudentRecommendationActions
            id={`mistake:${record.examId}:${record.questionId}`}
            title={record.outcomeLabel}
            context={`${record.subject} · ${record.examTitle} · ${record.questionNumber}. soru`}
            action={planAction}
            evidence={`${number(record.approvedScore)}/100 onaylı puan · ${meta.label}`}
            outcomeId={record.outcomeId}
            latestExamId={record.examId}
          />
        </div>
      </div>
    </div>
  );
}

function FeedbackBlock({
  title,
  text,
  instructor = false,
}: {
  title: string;
  text: string;
  instructor?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        instructor ? "border-primary/20 bg-primary/[0.045]" : "bg-background/75",
      )}
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquareQuote className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </section>
  );
}

function number(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}
