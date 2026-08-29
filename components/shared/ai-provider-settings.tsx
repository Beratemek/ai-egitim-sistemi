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
  clearAiApiKey,
  saveAiSettings,
  testAiConnection,
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
  AI_PROVIDER_LIST,
  detectProvider,
  providerInfo,
  type AiProvider,
} from "@/lib/ai-providers";
import type { AiSettingsView } from "@/lib/ai-settings";
import type { OpenRouterModel } from "@/lib/openrouter-models";
import { cn } from "@/lib/utils";

/**
 * Sistem yoneticisinin YAPAY ZEKA ANAHTARI ekrani.
 *
 * Amac: musterinin kendi saglayici hesabini uygulamaya baglamasi. Onceden bu
 * yalnizca sunucudaki `.env` dosyasindan yapilabiliyordu - yani musteri kendi
 * anahtarini giremiyor, her degisiklik icin gelistirici + sunucu yeniden
 * baslatma gerekiyordu.
 *
 * KAYITLI ANAHTAR GERI OKUNMAZ. Ekran yalnizca maskesini gosterir
 * (`sk-p••••••a91F`); ham anahtar tarayiciya hicbir zaman inmez. Bu yuzden
 * anahtar kutusu her acilista BOS gelir ve bos birakilirsa kayitli anahtar
 * DEGISMEZ - yonetici yalnizca model degistirmek istediginde anahtari
 * panosuna kopyalamak zorunda kalmaz.
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
  const router = useRouter();

  const [provider, setProvider] = React.useState<AiProvider>(settings.provider);
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState(settings.baseUrl);
  const [modelGeneration, setModelGeneration] = React.useState(
    settings.modelGeneration || providerInfo(settings.provider).defaultModel,
  );
  const [modelGrading, setModelGrading] = React.useState(settings.modelGrading);
  const [separateGrading, setSeparateGrading] = React.useState(
    Boolean(settings.modelGrading) &&
      settings.modelGrading !== settings.modelGeneration,
  );
  const [mockMode, setMockMode] = React.useState(settings.mockMode);

  const [isSaving, startSave] = React.useTransition();
  const [isTesting, setIsTesting] = React.useState(false);
  const [isClearing, startClear] = React.useTransition();

  const info = providerInfo(provider);

  /**
   * Saglayici degistiginde model ve taban adres o saglayiciya ait degerlere
   * doner. Aksi halde "gemini-3.6-flash" adi OpenAI'a gonderilir ve kullanici
   * anlamsiz bir 404 alir.
   */
  function changeProvider(next: AiProvider): void {
    if (next === provider) return;
    const nextInfo = providerInfo(next);

    setProvider(next);
    setBaseUrl(next === settings.provider ? settings.baseUrl : nextInfo.baseUrl);
    setModelGeneration(
      next === settings.provider
        ? settings.modelGeneration || nextInfo.defaultModel
        : nextInfo.defaultModel,
    );
    setModelGrading(next === settings.provider ? settings.modelGrading : "");
    setSeparateGrading(false);
  }

  /**
   * Anahtar yazildikca saglayiciyi tanir.
   *
   * "sk-ant-..." anahtarini OpenAI kartina yapistirmak en sik yapilan hata ve
   * sonucu anlamsiz bir 401. Onek tanindiginda dogru kart kendiliginden
   * isaretlenir; kullanici isterse sonrasinda baska bir kart secebilir.
   */
  function changeApiKey(next: string): void {
    setApiKey(next);
    const detected = detectProvider(next);
    if (detected && detected !== provider) changeProvider(detected);
  }

  function currentInput() {
    return {
      provider,
      apiKey,
      baseUrl,
      modelGeneration,
      modelGrading: separateGrading ? modelGrading : "",
      mockMode,
    };
  }

  function handleSave(): void {
    startSave(async () => {
      const result = await saveAiSettings(currentInput());

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setApiKey("");
      setShowKey(false);
      toast.success("Ayarlar kaydedildi. Yeni istekler bu anahtarla gider.");
      router.refresh();
    });
  }

  async function handleTest(): Promise<void> {
    setIsTesting(true);
    const result = await testAiConnection(currentInput());
    setIsTesting(false);

    if (!result.ok) {
      toast.error(result.error, { duration: 9000 });
      return;
    }

    toast.success(
      `Bağlantı çalışıyor: ${providerInfo(result.data.provider).label} / ${result.data.model}`,
    );
  }

  function handleClear(): void {
    startClear(async () => {
      const result = await clearAiApiKey();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Kayıtlı anahtar silindi.");
      router.refresh();
    });
  }

  const busy = isSaving || isTesting || isClearing;

  return (
    <div className="space-y-4">
      <StatusCard settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-4.5 w-4.5 text-primary" />
            Sağlayıcı
          </CardTitle>
          <CardDescription>
            Anahtarı hangi firmadan aldıysanız onu seçin. Anahtarı yapıştırdığınızda
            biçiminden tanınıp doğru kart kendiliğinden işaretlenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {AI_PROVIDER_LIST.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeProvider(item.id)}
              aria-pressed={item.id === provider}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                item.id === provider
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.label}</span>
                {item.id === provider ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {item.tagline}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-api-key">API anahtarı</Label>
            <div className="flex gap-2">
              <Input
                id="ai-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => changeApiKey(event.target.value)}
                placeholder={
                  settings.hasKey
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

            {settings.hasKey ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Kayıtlı anahtar:{" "}
                  <span className="font-mono text-foreground">{settings.keyHint}</span>
                </span>
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
                Kayıtlı anahtar yok. Anahtar girilene kadar sorular ve puanlar
                simülasyondan üretilir.
              </p>
            )}
          </div>

          {info.requiresBaseUrl || provider === "openrouter" ? (
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
                {provider === "openrouter"
                  ? "Boş bırakırsanız OpenRouter'ın kendi adresi kullanılır."
                  : "OpenAI ile aynı arayüzü sunan servisin adresi. Örnek: https://api.groq.com/openai/v1"}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modeller</CardTitle>
          <CardDescription>
            Soru üretimi ve cevap puanlaması için kullanılacak modeller. Boş
            bırakılırsa {info.label} için varsayılan model
            {info.defaultModel ? (
              <>
                {" "}
                (<span className="font-mono">{info.defaultModel}</span>)
              </>
            ) : null}{" "}
            kullanılır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {provider === "openrouter" ? (
            <OpenRouterModelPicker
              id="ai-model-generation"
              label="Soru üretimi modeli"
              description="Sağdaki tutarlar OpenRouter'ın güncel fiyat listesinden hesaplanır."
              models={openRouterModels}
              loadError={openRouterError}
              value={modelGeneration}
              onChange={setModelGeneration}
            />
          ) : (
            <ModelField
              id="ai-model-generation"
              label="Soru üretimi modeli"
              value={modelGeneration}
              onChange={setModelGeneration}
              suggestions={info.suggestedModels}
              placeholder={info.defaultModel}
            />
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={separateGrading}
              onChange={(event) => {
                setSeparateGrading(event.target.checked);
                if (event.target.checked && !modelGrading) {
                  setModelGrading(modelGeneration);
                }
              }}
            />
            Puanlama için ayrı bir model kullan
          </label>

          {separateGrading ? (
            provider === "openrouter" ? (
              <OpenRouterModelPicker
                id="ai-model-grading"
                label="Puanlama modeli"
                description="Puanlama daha kısa istemlerle çalışır; burada ucuz bir model seçmek toplam maliyeti belirgin düşürür."
                models={openRouterModels}
                loadError={openRouterError}
                value={modelGrading}
                onChange={setModelGrading}
              />
            ) : (
              <ModelField
                id="ai-model-grading"
                label="Puanlama modeli"
                value={modelGrading}
                onChange={setModelGrading}
                suggestions={info.suggestedModels}
                placeholder={info.defaultModel}
              />
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Puanlama da soru üretimiyle aynı modeli kullanır.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simülasyon modu</CardTitle>
          <CardDescription>
            Açıkken hiçbir API çağrısı yapılmaz; sorular ve puanlar şablondan
            üretilir. Tanıtım ve eğitim oturumlarında fatura oluşmasın diye
            kullanılır. Öğrenci ekranlarında bunun temsilî olduğu açıkça yazar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={mockMode}
              onChange={(event) => setMockMode(event.target.checked)}
            />
            <span>
              Simülasyon modunu aç
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Anahtar kayıtlı olsa bile gerçek model çağrılmaz.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button onClick={handleSave} disabled={busy} className="gap-1.5">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Kaydet
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
        <p className="text-xs text-muted-foreground">
          Test, kaydetmeden önce de çalışır ve gerçek bir istek gönderir: anahtarı,
          modeli ve JSON şema desteğini tek seferde doğrular.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Durum karti                                                               */
/* -------------------------------------------------------------------------- */

function StatusCard({ settings }: { settings: AiSettingsView }) {
  const active = providerInfo(settings.provider);

  const tone =
    settings.source === "yok"
      ? "warning"
      : settings.source === "panel"
        ? "success"
        : "secondary";

  const sourceLabel =
    settings.source === "panel"
      ? "Bu paneldeki anahtar"
      : settings.source === "env"
        ? "Sunucudaki .env dosyası"
        : "Anahtar yok — simülasyon";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          Şu an geçerli ayar
          <Badge variant={tone}>{sourceLabel}</Badge>
        </CardTitle>
        <CardDescription>
          {settings.source === "panel" ? (
            <>
              İstekler <strong>{active.label}</strong> üzerinden gidiyor.
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

/* -------------------------------------------------------------------------- */
/*  Duz model kutusu (OpenRouter disindaki saglayicilar)                      */
/* -------------------------------------------------------------------------- */

interface ModelFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder: string;
}

function ModelField({
  id,
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: ModelFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm"
        spellCheck={false}
      />
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 font-mono text-xs"
              onClick={() => onChange(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
