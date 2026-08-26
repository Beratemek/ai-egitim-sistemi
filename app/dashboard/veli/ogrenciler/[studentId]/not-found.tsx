import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function GuardianStudentNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-display text-xl">Öğrenci raporu bulunamadı</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Bu öğrenci hesabınıza atanmamış olabilir veya bağlantı sistem yöneticisi
          tarafından kaldırılmış olabilir.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/dashboard/veli">
            <ArrowLeft />
            Öğrencilerime dön
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
