import { PageSkeleton } from "@/components/shared/page-skeleton";

/** Gecis sirasinda gosterilen iskelet (bkz. ../loading.tsx). */
export default function Loading() {
  return <PageSkeleton stats={0} blocks={4} />;
}
