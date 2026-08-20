import { PageSkeleton } from "@/components/shared/page-skeleton";

export default function Loading() {
  return <PageSkeleton stats={3} blocks={2} />;
}
