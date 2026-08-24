"use client";

import * as React from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Mic,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Kamera zorunlu sınavların denetim katmanı.
 *
 * `preflight` kipinde sınav oturumu oluşturulmadan önce cihazları doğrular.
 * `exam` kipinde ise sınav boyunca akışı açık tutar; kamera veya mikrofon
 * kesilirse sorular yeniden kilitlenir.
 *
 * Görüntü ve ses kaydedilmez ya da sunucuya gönderilmez. Yalnızca tarayıcıda
 * canlı cihaz kontrolü için kullanılır.
 */

export interface ProctoringGateProps {
  children: React.ReactNode;
  examId?: string;
  mode?: "preflight" | "exam";
}

type Durum = "hazir_degil" | "isteniyor" | "acik" | "reddedildi" | "koptu";
type OrtamSesDurumu = "normal" | "yuksek";

const PREFLIGHT_MAX_AGE_MS = 5 * 60 * 1000;
const HIGH_SOUND_LEVEL = 60;
const WARNING_SOUND_LEVEL = 35;
const HIGH_SOUND_DURATION_MS = 2_000;
const CALM_SOUND_DURATION_MS = 1_200;

function preflightKey(examId: string) {
  return `exam-proctoring-ready:${examId}`;
}

/** Kamera izni tek başına yeterli değildir; gerçek bir video karesi beklenir. */
function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Kamera görüntüsü alınamadı."));
    }, 6_000);

    const handleReady = () => {
      if (video.videoWidth <= 0) return;
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Kamera görüntüsü oynatılamadı."));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("playing", handleReady);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("playing", handleReady);
    video.addEventListener("error", handleError);
    void video.play().catch(handleError);
  });
}

export function ProctoringGate({
  children,
  examId,
  mode = "exam",
}: ProctoringGateProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const autoRequestTriedRef = React.useRef(false);
  const highSoundStartedAtRef = React.useRef<number | null>(null);
  const calmSoundStartedAtRef = React.useRef<number | null>(null);

  const [durum, setDurum] = React.useState<Durum>("hazir_degil");
  const [hata, setHata] = React.useState<string | null>(null);
  const [sesSeviyesi, setSesSeviyesi] = React.useState(0);
  const [ortamSesDurumu, setOrtamSesDurumu] =
    React.useState<OrtamSesDurumu>("normal");
  const [kameraUyarisi, setKameraUyarisi] = React.useState<string | null>(null);

  const clearPreflight = React.useCallback(() => {
    if (examId && typeof window !== "undefined") {
      window.sessionStorage.removeItem(preflightKey(examId));
    }
  }, [examId]);

  /** Akışı, ses analizini ve bunlara bağlı kaynakları kapatır. */
  const kapat = React.useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  React.useEffect(() => kapat, [kapat]);

  /** Mikrofonun canlı sinyal aldığını görsel bir seviye çubuğuyla gösterir. */
  const olcSes = React.useCallback((stream: MediaStream) => {
    try {
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = context;

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (streamRef.current !== stream) {
          void context.close();
          return;
        }

        analyser.getByteTimeDomainData(data);
        const sumOfSquares = data.reduce((sum, value) => {
          const normalized = (value - 128) / 128;
          return sum + normalized * normalized;
        }, 0);
        const rms = Math.sqrt(sumOfSquares / data.length);
        const level = Math.min(100, Math.round(rms * 260));
        const now = performance.now();
        setSesSeviyesi(level);

        // Tek bir öksürük ya da sandalye sesi uyarı üretmez. Yalnızca ses
        // yaklaşık iki saniye boyunca yüksek kalırsa ortam uyarısı gösterilir.
        if (level >= HIGH_SOUND_LEVEL) {
          calmSoundStartedAtRef.current = null;
          highSoundStartedAtRef.current ??= now;
          if (now - highSoundStartedAtRef.current >= HIGH_SOUND_DURATION_MS) {
            setOrtamSesDurumu("yuksek");
          }
        } else if (level <= WARNING_SOUND_LEVEL) {
          highSoundStartedAtRef.current = null;
          calmSoundStartedAtRef.current ??= now;
          if (now - calmSoundStartedAtRef.current >= CALM_SOUND_DURATION_MS) {
            setOrtamSesDurumu("normal");
          }
        } else {
          highSoundStartedAtRef.current = null;
          calmSoundStartedAtRef.current = null;
        }

        animationFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      // Ses ölçümü yalnızca görsel geri bildirimdir. Ses akışının varlığı
      // aşağıda ayrıca doğrulandığı için bu yardımcı gösterge zorunlu değildir.
    }
  }, []);

  const izinIste = React.useCallback(async () => {
    kapat();
    clearPreflight();
    setSesSeviyesi(0);
    setOrtamSesDurumu("normal");
    setKameraUyarisi(null);
    highSoundStartedAtRef.current = null;
    calmSoundStartedAtRef.current = null;
    setDurum("isteniyor");
    setHata(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setDurum("reddedildi");
      setHata(
        "Tarayıcınız kamera ve mikrofon erişimini desteklemiyor. Güncel bir tarayıcı ile deneyin.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });

      const cameraTrack = stream.getVideoTracks()[0];
      const microphoneTrack = stream.getAudioTracks()[0];

      if (!cameraTrack || !microphoneTrack) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException("Gerekli cihaz bulunamadı.", "NotFoundError");
      }

      streamRef.current = stream;
      if (!videoRef.current) {
        throw new Error("Kamera ön izlemesi hazırlanamadı.");
      }
      videoRef.current.srcObject = stream;
      await waitForVideoFrame(videoRef.current);

      const handleEnded = () => {
        if (streamRef.current !== stream) return;
        kapat();
        clearPreflight();
        setSesSeviyesi(0);
        setOrtamSesDurumu("normal");
        setKameraUyarisi(null);
        setDurum("koptu");
        setHata(
          "Kamera veya mikrofon erişimi kesildi. Devam etmek için cihazları yeniden kontrol edin.",
        );
      };

      cameraTrack.addEventListener("ended", handleEnded, { once: true });
      microphoneTrack.addEventListener("ended", handleEnded, { once: true });
      cameraTrack.addEventListener("mute", () => {
        if (streamRef.current === stream) {
          setKameraUyarisi("Kamera görüntüsü geçici olarak alınamıyor.");
        }
      });
      cameraTrack.addEventListener("unmute", () => {
        if (streamRef.current === stream) setKameraUyarisi(null);
      });

      olcSes(stream);
      setDurum("acik");

      if (mode === "preflight" && examId && typeof window !== "undefined") {
        window.sessionStorage.setItem(preflightKey(examId), String(Date.now()));
      }
    } catch (caught) {
      kapat();
      setDurum("reddedildi");
      setHata(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Kamera veya mikrofon izni verilmedi. Tarayıcı izinlerinden her iki cihazı da açın."
          : caught instanceof DOMException && caught.name === "NotFoundError"
            ? "Kamera veya mikrofon bulunamadı. Cihazların bağlı ve kullanılabilir olduğundan emin olun."
            : "Cihazlar açılamadı. Başka bir uygulama kamera veya mikrofonu kullanıyor olabilir.",
      );
    }
  }, [clearPreflight, examId, kapat, mode, olcSes]);

  // Ön kontrolden hemen sonra sınav sayfasına geçildiyse izinleri gerçekten
  // yeniden açmayı dener. Bu işaret hiçbir zaman kontrolü atlatmaz; yalnızca
  // ikinci bir düğme tıklamasını önler. Yeniden açma başarısızsa kapı kilitli kalır.
  React.useEffect(() => {
    if (mode !== "exam" || !examId || autoRequestTriedRef.current) return;

    const checkedAt = Number(window.sessionStorage.getItem(preflightKey(examId)));
    window.sessionStorage.removeItem(preflightKey(examId));

    if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > PREFLIGHT_MAX_AGE_MS) {
      return;
    }

    autoRequestTriedRef.current = true;
    void izinIste();
  }, [examId, izinIste, mode]);

  const acik = durum === "acik";
  const preflight = mode === "preflight";
  const ortamUyarisiVar = ortamSesDurumu === "yuksek" || Boolean(kameraUyarisi);
  const sesRengi =
    sesSeviyesi >= HIGH_SOUND_LEVEL
      ? "bg-destructive"
      : sesSeviyesi >= WARNING_SOUND_LEVEL
        ? "bg-warning"
        : "bg-emerald-500";

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "border-2",
          acik && !ortamUyarisiVar
            ? "border-emerald-500/40 bg-emerald-500/5"
            : ortamUyarisiVar
              ? "border-warning/50 bg-warning/5"
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
                CANLI ÖN İZLEME
              </span>
            )}
          </div>

          <div className="min-w-[220px] flex-1 space-y-2.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              {acik ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                  Kamera ve mikrofon hazır
                </>
              ) : (
                <>
                  <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  {preflight
                    ? "Sınava başlamadan önce cihazları kontrol edin"
                    : "Bu sınav kamera ve mikrofon açıkken çözülür"}
                </>
              )}
            </p>

            {acik ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Kamera hazır
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mikrofon hazır
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width,background-color] duration-100",
                        sesRengi,
                      )}
                      style={{ width: `${Math.max(3, sesSeviyesi)}%` }}
                    />
                  </div>
                </div>
                <p
                  aria-live="polite"
                  className={cn(
                    "text-xs",
                    ortamSesDurumu === "yuksek"
                      ? "font-medium text-warning"
                      : "text-muted-foreground",
                  )}
                >
                  {ortamSesDurumu === "yuksek"
                    ? "Ortam sesi yüksek. Daha sessiz bir alana geçin."
                    : "Ortam sesi normal"}
                </p>
                {kameraUyarisi ? (
                  <p
                    role="status"
                    className="flex items-center gap-1.5 text-xs font-medium text-warning"
                  >
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {kameraUyarisi}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Görüntü ve ses <span className="font-medium text-foreground">kaydedilmez</span>
                {" "}ve hiçbir yere gönderilmez; yalnızca canlı cihaz kontrolü yapılır.
              </p>
            )}

            {hata ? (
              <p role="alert" className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                {hata}
              </p>
            ) : null}
          </div>

          {!acik ? (
            <Button
              type="button"
              onClick={() => void izinIste()}
              disabled={durum === "isteniyor"}
              className="gap-2"
            >
              {durum === "isteniyor" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {durum === "isteniyor"
                ? "Cihazlar kontrol ediliyor..."
                : durum === "hazir_degil"
                  ? "Kamera ve mikrofonu kontrol et"
                  : "Yeniden dene"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {acik ? (
        children
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <CameraOff className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">
                {preflight
                  ? "Cihaz kontrolü tamamlanmadan sınav başlatılamaz"
                  : "Sorular cihazlar hazır olunca görünür"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {preflight
                  ? "Canlı görüntü ve mikrofon bağlantısı doğrulandığında sınava başlama düğmesi açılır."
                  : "Kamera veya mikrofon kesilirse cevaplama alanı yeniden kilitlenir."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
