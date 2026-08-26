import { PageSkeleton } from "@/components/shared/page-skeleton";

/**
 * Gecis sirasinda gosterilen iskelet.
 *
 * Bu dosya OLMADAN Next.js sunucu bilesenini beklerken ekranda ONCEKI sayfa
 * donmus gibi durur: kullanici tikladigini sanmaz, tekrar tiklar. Buradaki
 * iskelet aninda cizilir ve icerik hazir olunca yerini alir.
 */
export default function Loading() {
  return <PageSkeleton stats={3} blocks={2} />;
}
