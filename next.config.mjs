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
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
