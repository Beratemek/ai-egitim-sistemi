import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function StudentExamNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <FileQuestion className="h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-5 text-xl font-semibold">Sinav bulunamadi</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Bu sinav size atanmamis, yayindan kaldirilmis veya baglanti gecersiz olabilir.
        </p>
        <Button asChild variant="outline" className="mt-6 gap-2">
          <Link href="/dashboard/ogrenci">
            <ArrowLeft className="h-4 w-4" />
            Sinavlarima don
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
