import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_LIST } from "@/lib/roles";
import { cn } from "@/lib/utils";

const PIPELINE_STEPS: readonly { title: string; body: string }[] = [
  {
    title: "1. Icerik yuklenir",
    body: "Icerik uzmani kaynak metni ve kazanimi sisteme girer.",
  },
  {
    title: "2. AI soru uretir",
    body: "Model kazanima uygun test ve acik uclu soru taslaklarini JSON olarak dondurur.",
  },
  {
    title: "3. Egitmen onaylar",
    body: "Taslaklar incelenir; onaylananlar soru havuzuna girer, digerleri reddedilir.",
  },
  {
    title: "4. Ogrenci cevaplar",
    body: "Sinav sirasinda acik uclu cevaplar toplanir.",
  },
  {
    title: "5. AI puanlar, egitmen dogrular",
    body: "Cevap rubrige gore puanlanir; nihai puani egitmen onaylar.",
  },
  {
    title: "6. Yonetici raporlar",
    body: "Sinav bazli ortalama, katilim ve onay oranlari izlenir.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <section className="space-y-4">
        <p className="text-sm font-medium text-primary">Hackathon MVP</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Yapay Zeka Destekli Egitim Sistemi
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Kazanimdan soruya, cevaptan puana kadar tum degerlendirme surecini
          yapay zeka ile hizlandiran; ancak son sozu her zaman egitmene birakan
          bir olcme-degerlendirme platformu.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
            Giris yap
          </Link>
          <Link
            href="/dashboard/egitmen/soru-havuzu"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Soru havuzunu incele
          </Link>
        </div>
      </section>

      <section className="mt-16 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Roller</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLE_LIST.map((definition) => (
            <Link key={definition.role} href={definition.path} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{definition.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{definition.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Akis</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STEPS.map((step) => (
            <li key={step.title} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
