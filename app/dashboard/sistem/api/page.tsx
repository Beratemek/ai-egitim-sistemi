import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AiProviderSettings } from "@/components/shared/ai-provider-settings";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getAiSettingsView } from "@/lib/ai-settings";
import { fetchOpenRouterModels } from "@/lib/openrouter-models";

export const metadata: Metadata = { title: "API Anahtarları" };

/**
 * Sistem yoneticisi - API ANAHTARLARI.
 *
 * Musteri kendi yapay zeka saglayicisini buradan baglar. Ayni bilgiyi
 * `.env` dosyasindan da vermek mumkun ama o yol sunucuya erisim ve yeniden
 * baslatma istiyor; bu ekran musterinin kendi basina halledebilmesi icin var.
 *
 * Ham anahtar bu sayfaya HIC GELMEZ: `getAiSettingsView()` yalnizca maskeli
 * ozet dondurur (bkz. lib/ai-settings.ts). OpenRouter model listesi ise gizli
 * olmayan, saatlik onbelleklenen genel bir listedir.
 */
export default async function ApiAnahtarlariPage() {
  const [settings, openRouter] = await Promise.all([
    getAiSettingsView(),
    fetchOpenRouterModels(),
  ]);

  return (
    <>
      <PageHeader
        title="API Anahtarları"
        description="Soru üretimi ve cevap puanlaması için kullanılacak yapay zeka sağlayıcısını, anahtarı ve modeli buradan yönetin. Kaydettiğiniz an geçerli olur; sunucuyu yeniden başlatmak gerekmez."
        actions={
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/dashboard/sistem">
              <ArrowLeft className="h-4 w-4" />
              Rol onayları
            </Link>
          </Button>
        }
      />

      <AiProviderSettings
        settings={settings}
        openRouterModels={openRouter.models}
        openRouterError={openRouter.error}
      />
    </>
  );
}
