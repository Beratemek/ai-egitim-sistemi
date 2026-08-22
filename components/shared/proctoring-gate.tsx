"use client";

import * as React from "react";
import {
  Camera,
  CameraOff,
  Loader2,
  Mic,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Kamera zorunlu sinavlarin denetim katmani.
 *
 * Iki is yapar:
 *   1. KAPI: sinav baslamadan once kamera ve mikrofon izni alinir, ogrenci
 *      kendini gorur ve mikrofonunun ses aldigini dogrular.
 *   2. NOBET: sinav suresince akis acik kalmali. Ogrenci sekmeden izni geri
 *      alirsa ya da kamerayi kapatirsa akis "ended" olur; o an cevaplama
 *      kilitlenir ve tekrar izin verilene kadar acilmaz.
 *
 * KAYIT YOK. Goruntu ve ses yalnizca tarayicida kalir, hicbir yere
 * gonderilmez - kayit; depolama kovasi, saklama suresi ve acik riza
 * gerektirdigi icin ayri bir is. Ogrenciye de bu acikca soyleniyor, cunku
 * "kamera aciliyor" deyip ne yapildigini soylememek guven kirar.
 */

export interface ProctoringGateProps {
  /** Kapi acildiginda gosterilecek sinav ekrani. */
  children: React.ReactNode;
}

type Durum = "hazir_degil" | "isteniyor" | "acik" | "reddedildi" | "koptu";

export function ProctoringGate({ children }: ProctoringGateProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [durum, setDurum] = React.useState<Durum>("hazir_degil");
  const [hata, setHata] = React.useState<string | null>(null);
  const [sesSeviyesi, setSesSeviyesi] = React.useState(0);

  /** Akisi ve ona bagli her seyi kapatir. */
  const kapat = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  React.useEffect(() => kapat, [kapat]);

  async function izinIste() {
    setDurum("isteniyor");
    setHata(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setDurum("reddedildi");
      setHata(
        "Tarayıcınız kamera erişimini desteklemiyor. Güncel bir tarayıcı ile deneyin.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Akis KOPARSA nobet devreye girer: ogrenci kamerayi kapatip
      // sinava devam edemesin.
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", () => {
          setDurum("koptu");
          setHata(
            "Kamera veya mikrofon erişimi kesildi. Sınava devam etmek için yeniden izin verin.",
          );
        });
      }

      olcSes(stream);
      setDurum("acik");
    } catch (caught) {
      setDurum("reddedildi");
      setHata(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Kamera ve mikrofon izni verilmedi. Bu sınav kamera açıkken çözülmek zorunda."
          : caught instanceof DOMException && caught.name === "NotFoundError"
            ? "Kamera veya mikrofon bulunamadı. Cihazınızın bağlı olduğundan emin olun."
            : "Kamera açılamadı. Başka bir uygulama kamerayı kullanıyor olabilir.",
      );
    }
  }

  /**
   * Mikrofon seviyesini olcer.
   *
   * Amac ses KAYDETMEK degil, ogrenciye mikrofonun gercekten calistigini
   * gostermek: izin verilmis ama susturulmus bir mikrofon sinav sirasinda
   * fark edilmezdi.
   */
  function olcSes(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const kaynak = ctx.createMediaStreamSource(stream);
      const analiz = ctx.createAnalyser();
      analiz.fftSize = 512;
      kaynak.connect(analiz);

      const veri = new Uint8Array(analiz.frequencyBinCount);

      const tik = () => {
        if (!streamRef.current) {
          void ctx.close();
          return;
        }
        analiz.getByteFrequencyData(veri);
        const ortalama = veri.reduce((sum, v) => sum + v, 0) / veri.length;
        setSesSeviyesi(Math.min(100, Math.round((ortalama / 128) * 100)));
        requestAnimationFrame(tik);
      };

      tik();
    } catch {
      // Ses olcumu sadece geri bildirim; basarisiz olursa sinav yine calisir.
    }
  }

  const acik = durum === "acik";

  return (
    <div className="space-y-4">
      {/* ---------- Denetim paneli ---------- */}
      <Card
        className={cn(
          "border-2",
          acik
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-amber-500/40 bg-amber-500/5",
        )}
      >
        <CardContent className="flex flex-wrap items-center gap-3 py-3 sm:gap-4 sm:py-4">
          {/* Kendini gorme penceresi */}
          <div className="relative h-[84px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-slate-900 ring-1 ring-border sm:h-[120px] sm:w-[160px]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn("h-full w-full object-cover", !acik && "opacity-0")}
            />
            {!acik ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <CameraOff className="h-6 w-6 text-slate-500" />
              </span>
            ) : (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                CANLI
              </span>
            )}
          </div>

          <div className="min-w-[220px] flex-1 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              {acik ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                  Kamera ve mikrofon açık
                </>
              ) : (
                <>
                  <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  Bu sınav kamera açıkken çözülür
                </>
              )}
            </p>

            {acik ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-100"
                      style={{ width: `${sesSeviyesi}%` }}
                    />
                  </div>
                </div>
                {/*
                  Izin ALINDIKTAN sonra uzun aciklama yok: canli goruntu ve
                  hareket eden mikrofon cubugu zaten durumu soyluyor. Kayit
                  yapilmadigi bilgisi izin ISTENIRKEN veriliyor - bilgilendirmenin
                  anlamli oldugu an orasi.
                */}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Görüntü ve ses{" "}
                <span className="font-medium text-foreground">kaydedilmez</span> ve
                hiçbir yere gönderilmez; yalnızca sınav süresince açık kalması
                gerekir.
              </p>
            )}

            {hata ? (
              <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-500">
                {hata}
              </p>
            ) : null}
          </div>

          {!acik ? (
            <Button
              onClick={() => void izinIste()}
              disabled={durum === "isteniyor"}
              className="gap-2"
            >
              {durum === "isteniyor" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {durum === "hazir_degil" ? "Kamerayı aç" : "Yeniden dene"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------- Sinav ---------- */}
      {acik ? (
        children
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CameraOff className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Sorular kamera açılınca görünür</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Eğitmeniniz bu sınav için kamera zorunluluğu koydu. Yukarıdaki
                düğmeyle izin verdiğinizde sorular tek tek açılır.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
