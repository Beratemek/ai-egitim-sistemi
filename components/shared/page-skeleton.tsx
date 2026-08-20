import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface PageSkeletonProps {
  /** Ust siradaki istatistik karti sayisi. */
  stats?: number;
  /** Govdedeki icerik blogu sayisi. */
  blocks?: number;
}

/**
 * Sayfa yuklenirken gosterilen iskelet.
 *
 * Amaci algilanan hizi artirmak: sunucu bileseni verisini beklerken kullanici
 * bos ekrana degil, gelecek duzenin taslagina bakar.
 */
export function PageSkeleton({ stats = 4, blocks = 2 }: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {stats > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {Array.from({ length: blocks }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
