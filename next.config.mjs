/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  /**
   * `next dev` ve `next build` varsayilan olarak ayni `.next` klasorunu kullanir.
   * Dev sunucusu acikken build alinirsa dev'in chunk'lari ezilir ve tarayici
   * "ChunkLoadError: Loading chunk ... failed" verir.
   *
   * NEXT_DIST_DIR ile dogrulama build'i ayri bir klasore alinabilir:
   *   NEXT_DIST_DIR=.next-verify npx next build
   *
   * KURAL: dev sunucusu acikken ALINAN HER BUILD bu degiskeni set etmeli.
   * Aksi halde tarayici stilsiz kalir (CSS 404) ve sayfa devasa bir SVG
   * gibi gorunur - sebebi anlasilmasi zor, belirtisi ise dramatik.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
