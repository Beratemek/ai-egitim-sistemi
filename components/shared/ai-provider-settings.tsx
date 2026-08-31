"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  clearProviderKey,
  saveAiDefaults,
  saveProviderKey,
  testProviderKey,
} from "@/app/actions/ai-settings";
import { OpenRouterModelPicker } from "@/components/shared/openrouter-model-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AI_PROVIDER_LIST,
  detectProvider,
  providerInfo,
  type AiProvider,
} from "@/lib/ai-providers";
import type { AiProviderKeyView, AiSettingsView } from "@/lib/ai-settings";
import type { OpenRouterModel } from "@/lib/openrouter-models";
import { cn } from "@/lib/utils";

/**
 * Sistem yoneticisinin YAPAY ZEKA ANAHTARLARI ekrani.
 *
 * Amac: musterinin kendi saglayici hesaplarini uygulamaya baglamasi. Onceden bu
 * yalnizca sunucudaki `.env` dosyasindan yapilabiliyordu - musteri kendi
 * anahtarini giremiyor, her degisiklik icin gelistirici + sunucu yeniden
 * baslatma gerekiyordu.
 *
 * COKLU ANAHTAR: her saglayicinin kendi anahtari vardir ve hepsi ayni anda
 * tanimli kalabilir. Ust kisimda saglayici kartlari (hangisini duzenledigini
 * secersin), altta o saglayicinin anahtari, en altta ise butun sistemi
 * ilgilendiren tercihler durur: hangi saglayici VARSAYILAN, puanlama modeli ve
 * simulasyon anahtari.
 *
 * KAYITLI ANAHTAR GERI OKUNMAZ. Ekran yalnizca maskesini gosterir
 * (`sk-p••••••a91F`); ham anahtar tarayiciya hicbir zaman inmez. Bu yuzden
 * anahtar kutusu her acilista BOS gelir ve bos birakilirsa kayitli anahtar
 * DEGISMEZ - yonetici yalnizca model degistirmek istediginde anahtari panosuna
 * kopyalamak zorunda kalmaz.
 */

export interface AiProviderSettingsProps {
  settings: AiSettingsView;
  openRouterModels: readonly OpenRouterModel[];
  openRouterError: string | null;
}

export function AiProviderSettings({
  settings,
  openRouterModels,
  openRouterError,
}: AiProviderSettingsProps) {
  /** Su an hangi saglayicinin anahtari duzenleniyor. */
  const [editing, setEditing] = React.useState<AiProvider>(settings.provider);

  const view =
    settings.providers.find((entry) => entry.provider === editing) ??
    emptyView(editing);

  return (
    <div className="space-y-4">
      <StatusCard settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-4.5 w-4.5 text-primary" />
            Sağlayıcılar
          </CardTitle>
          <CardDescription>
            Her sağlayıcının kendi anahtarı vardır ve hepsi aynı anda tanımlı
            kalabilir. Düzenlemek istediğiniz sağlayıcıyı seçin; içerik uzmanı
            üretim sırasında anahtarı tanımlı olan tüm sağlayıcıların modellerini
            bir arada görür.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {AI_PROVIDER_LIST.map((item) => {
            const entry = settings.providers.find(
              (candidate) => candidate.provider === item.id,
            );

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setEditing(item.id)}
                aria-pressed={item.id === editing}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  item.id === editing
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  {item.id === editing ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {entry?.hasKey ? (
                    <Badge variant="success" className="text-[0.65rem]">
                      Anahtar kayıtlı
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[0.65rem]">
                      Anahtar yok
                    </Badge>
                  )}
                  {item.id === settings.provider ? (
                    <Badge variant="soft" className="text-[0.65rem]">
                      Varsayılan
                    </Badge>
                  ) : null}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/*
        `key` ONEMLI: saglayici degistiginde bilesen yeniden kuruluyor ve
        anahtar/model kutulari o saglayicinin kendi degerleriyle sifirlaniyor.
        Aksi halde Gemini icin yazilan model adi OpenRouter kutusunda kalirdi.
      */}
      <ProviderKeyCard
        key={editing}
        view={view}
        openRouterModels={openRouterModels}
        openRouterError={openRouterError}
        onProviderDetected={setEditing}
      />

      <DefaultsCard settings={settings} />
    </div>
  );
}

function emptyView(provider: AiProvider): AiProviderKeyView {
  return {
    provider,
    hasKey: false,
    keyHint: "",
    baseUrl: "",
    modelGeneration: "",
    updatedAt: null,
    updatedBy: null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Tek saglayicinin anahtari                                                 */
/* -------------------------------------------------------------------------- */

interface ProviderKeyCardProps {
  view: AiProviderKeyView;
  openRouterModels: readonly OpenRouterModel[];
  openRouterError: string | null;
  /** Yapistirilan anahtar baska bir saglayiciya aitse ust bilesene haber verir. */
  onProviderDetected: (provider: AiProvider) => void;
}

function ProviderKeyCard({
  view,
  openRouterModels,
  openRouterError,
  onProviderDetected,
}: ProviderKeyCardProps) {
  const router = useRouter();
  const info = providerInfo(view.provider);

  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState(view.baseUrl || info.baseUrl);
  const [model, setModel] = React.useState(
    view.modelGeneration || info.defaultModel,
  );

  const [isSaving, startSave] = React.useTransition();
  const [isClearing, startClear] = React.useTransition();
  const [isTesting, setIsTesting] = React.useState(false);

  const busy = isSaving || isClearing || isTesting;

  function currentInput() {
    return { provider: view.provider, apiKey, baseUrl, modelGeneration: model };
  }

  /**
   * Anahtar yazildikca saglayiciyi tanir.
   *
   * "sk-ant-..." anahtarini Gemini kutusuna yapistirmak en sik yapilan hata ve
   * sonucu anlamsiz bir 401. Onek tanindiginda duzenlenen kart kendiliginden
   * degisir; kullanici isterse sonrasinda baska bir kart secebilir.
   */
  function changeApiKey(next: string): void {
    setApiKey(next);
    const detected = detectProvider(next);
    if (detected && detected !== view.provider) onProviderDetected(detected);
  }

  function handleSave(): void {
    startSave(async () => {
      const result = await saveProviderKey(currentInput());

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setApiKey("");
      setShowKey(false);
      toast.success(`${info.label} anahtarı kaydedildi.`);
      router.refresh();
    });
  }

  function handleClear(): void {
    startClear(async () => {
      const result = await clearProviderKey(view.provider);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${info.label} anahtarı silindi.`);
      router.refresh();
    });
  }

  async function handleTest(): Promise<void> {
    setIsTesting(true);
    const result = await testProviderKey(currentInput());
    setIsTesting(false);

    if (!result.ok) {
      toast.error(result.error, { duration: 9000 });
      return;
    }

    toast.success(
      `Bağlantı çalışıyor: ${providerInfo(result.data.provider).label} / ${result.data.model}`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4.5 w-4.5 text-primary" />
          {info.label} API anahtarı
        </CardTitle>
        <CardDescription>
          {info.note}
          {info.consoleUrl ? (
            <>
              {" "}
              Anahtarı{" "}
              <a
                href={info.consoleUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                {info.consoleLabel}
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              adresinden alırsınız.
            </>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ai-api-key">API anahtarı</Label>
          <div className="flex gap-2">
            <Input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => changeApiKey(event.target.value)}
              placeholder={
                view.hasKey
                  ? "Değiştirmek istemiyorsanız boş bırakın"
                  : info.keyPlaceholder
              }
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey((current) => !current)}
              aria-label={showKey ? "Anahtarı gizle" : "Anahtarı göster"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>

          {view.hasKey ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Kayıtlı anahtar:{" "}
                <span className="font-mono text-foreground">{view.keyHint}</span>
              </span>
              {view.updatedBy ? <span>· {view.updatedBy}</span> : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                onClick={handleClear}
                disabled={busy}
              >
                {isClearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Anahtarı sil
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Bu sağlayıcı için kayıtlı anahtar yok.
            </p>
          )}
        </div>

        {info.requiresBaseUrl || view.provider === "openrouter" ? (
          <div className="space-y-2">
            <Label htmlFor="ai-base-url">Taban adres (base URL)</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={info.baseUrl || "https://api.ornek.com/v1"}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {view.provider === "openrouter"
                ? "Boş bırakırsanız OpenRouter'ın kendi adresi kullanılır."
                : "OpenAI ile aynı arayüzü sunan servisin adresi. Örnek: https://api.groq.com/openai/v1"}
            </p>
          </div>
        ) : null}

        {view.provider === "openrouter" ? (
          <OpenRouterModelPicker
            id="ai-model-generation"
            label="Varsayılan model"
            description="Bu sağlayıcı seçildiğinde kullanılacak model. İçerik uzmanı üretim sırasında başka bir model seçebilir."
            models={openRouterModels}
            loadError={openRouterError}
            value={model}
            onChange={setModel}
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="ai-model-generation">Varsayılan model</Label>
            <Input
              id="ai-model-generation"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={info.defaultModel}
              className="font-mono text-sm"
              spellCheck={false}
            />
            {info.suggestedModels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {info.suggestedModels.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 font-mono text-xs"
                    onClick={() => setModel(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={handleSave} disabled={busy} className="gap-1.5">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {info.label} anahtarını kaydet
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={busy}
            className="gap-1.5"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Bağlantıyı test et
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Test kaydetmeden önce de çalışır ve gerçek bir istek gönderir: anahtarı,
          modeli ve JSON şema desteğini tek seferde doğrular.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Genel tercihler                                                           */
/* -------------------------------------------------------------------------- */

function DefaultsCard({ settings }: { settings: AiSettingsView }) {
  const router = useRouter();

  const withKey = settings.providers.filter((entry) => entry.hasKey);
  const [provider, setProvider] = React.useState<AiProvider>(settings.provider);
  const [modelGrading, setModelGrading] = React.useState(settings.modelGrading);
  const [mockMode, setMockMode] = React.useState(settings.mockMode);
  const [isSaving, startSave] = React.useTransition();

  /** Varsayilan saglayicinin kendi modeli; genel kayda da yaziliyor. */
  const generationModel =
    settings.providers.find((entry) => entry.provider === provider)
      ?.modelGeneration ?? "";

  function handleSave(): void {
    startSave(async () => {
      const result = await saveAiDefaults({
        provider,
        modelGeneration: generationModel,
        modelGrading,
        mockMode,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Varsayılan ayarlar kaydedildi.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Varsayılan ayarlar</CardTitle>
        <CardDescription>
          Model seçilmeden yapılan işler bu ayarları kullanır: cevap puanlaması ve
          içerik uzmanının seçim yapmadığı üretimler.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="ai-default-provider">Varsayılan sağlayıcı</Label>
          {withKey.length > 0 ? (
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as AiProvider)}
            >
              <SelectTrigger id="ai-default-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" avoidCollisions={false}>
                {withKey.map((entry) => (
                  <SelectItem key={entry.provider} value={entry.provider}>
                    {providerInfo(entry.provider).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Henüz anahtarı kayıtlı bir sağlayıcı yok.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-model-grading">Puanlama modeli</Label>
          <Input
            id="ai-model-grading"
            value={modelGrading}
            onChange={(event) => setModelGrading(event.target.value)}
            placeholder={generationModel || "Üretim modeliyle aynı"}
            className="font-mono text-sm"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Boş bırakılırsa varsayılan sağlayıcının üretim modeli kullanılır.
            Puanlama kısa istemlerle çalışır; burada ucuz bir model seçmek toplam
            maliyeti belirgin düşürür.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={mockMode}
            onChange={(event) => setMockMode(event.target.checked)}
          />
          <span>
            Simülasyon modunu aç
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Hiçbir API çağrısı yapılmaz; sorular ve puanlar şablondan üretilir.
              Tanıtım ve eğitim oturumlarında fatura oluşmasın diye kullanılır.
              Öğrenci ekranlarında bunun temsilî olduğu açıkça yazar.
            </span>
          </span>
        </label>

        <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Varsayılanları kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Durum karti                                                               */
/* -------------------------------------------------------------------------- */

function StatusCard({ settings }: { settings: AiSettingsView }) {
  const active = providerInfo(settings.provider);
  const keyCount = settings.providers.filter((entry) => entry.hasKey).length;

  const tone =
    settings.source === "yok"
      ? "warning"
      : settings.source === "panel"
        ? "success"
        : "secondary";

  const sourceLabel =
    settings.source === "panel"
      ? "Bu paneldeki anahtarlar"
      : settings.source === "env"
        ? "Sunucudaki .env dosyası"
        : "Anahtar yok — simülasyon";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          Şu an geçerli ayar
          <Badge variant={tone}>{sourceLabel}</Badge>
          {keyCount > 0 ? (
            <Badge variant="soft">{keyCount} sağlayıcı tanımlı</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {settings.source === "panel" ? (
            <>
              Varsayılan sağlayıcı <strong>{active.label}</strong>.
              {settings.updatedBy ? ` Son değiştiren: ${settings.updatedBy}.` : ""}
              {settings.updatedAt
                ? ` (${new Date(settings.updatedAt).toLocaleString("tr-TR")})`
                : ""}
            </>
          ) : settings.source === "env" ? (
            <>
              Panelde kayıtlı anahtar yok; sunucudaki <code>.env</code> dosyasındaki
              anahtar kullanılıyor. Buraya anahtar kaydettiğinizde panel öncelikli
              olur.
            </>
          ) : (
            <>
              Hiçbir yerde geçerli bir anahtar yok. Sorular ve puanlar şablondan
              üretiliyor; öğrenciye giden sonuç gerçek değil.
            </>
          )}
        </CardDescription>
      </CardHeader>

      {settings.storageError ? (
        <CardContent>
          <p className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Kurulum eksik.</strong>{" "}
              {settings.storageError}
            </span>
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
