import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @param {string} phase */
const createNextConfig = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    typescript: { ignoreBuildErrors: false },
    eslint: { ignoreDuringBuilds: false },

  /**
   * Dosya izlemesinin KOKU: bu proje klasoru.
   *
   * Next.js kokü kendisi tahmin eder ve tahmini "en ustteki lockfile"dir.
   * Bu makinede `C:\Users\emexb\package-lock.json` diye kazara olusmus bir
   * dosya var (icinde tek bir paket); Next onu gorup KULLANICI KLASORUNUN
   * TAMAMINI kok sayiyordu. Sonuc: her build, izleme agacini OneDrive,
   * Belgeler, Indirilenler ve AppData uzerinden yurumeye calisiyordu -
   * uyari olarak da soyluyordu:
   *
   *   "Next.js inferred your workspace root, but it may not be correct.
   *    We detected multiple lockfiles and selected the directory of
   *    C:\Users\emexb\package-lock.json as the root directory."
   *
   * Kok acikca yazilinca tahmin devre disi kalir; disaridaki lockfile
   * durmaya devam etse bile bu projeyi etkilemez.
   */
    outputFileTracingRoot: projectRoot,

  /**
   * `next dev` ve `next build` varsayilan olarak ayni `.next` klasorunu kullanir.
   * Dev sunucusu acikken build alinirsa dev'in chunk'lari ezilir ve tarayici
   * "ChunkLoadError: Loading chunk ... failed" verir.
   *
   * Next.js 15'te dev ve build ciktilari kendiliginden ayrilmaz. Bu nedenle
   * gelistirme sunucusu `.next`, build/start ise `.next-prod` kullanir.
   * NEXT_DIST_DIR yalnizca ozel bir dogrulama klasoru gerektiginde bu secimi
   * gecersiz kilabilir.
   */
    distDir:
      process.env.NEXT_DIST_DIR ||
      (phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-prod"),
  };

  return nextConfig;
};

export default createNextConfig;
