"use client";

import * as React from "react";
import { BookOpenText, FileCheck2, ShieldCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LegalDocumentKey = "kvkk" | "terms" | "consent";

const LEGAL_DOCUMENTS: Record<
  LegalDocumentKey,
  {
    title: string;
    description: string;
    sections: readonly { heading: string; body: string }[];
  }
> = {
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    description: "Kişisel verilerinizin hangi kapsamda işlendiğine ilişkin taslak bilgilendirme.",
    sections: [
      {
        heading: "Veri sorumlusu",
        body: "Bu prototipte veri sorumlusu İzometri Eğitim Teknolojileri olarak gösterilmiştir. Ticari unvan, adres, MERSİS ve iletişim bilgileri yayın öncesinde gerçek bilgilerle doldurulmalıdır.",
      },
      {
        heading: "İşlenen veriler ve amaç",
        body: "Ad-soyad, e-posta, rol, sınıf bilgisi, sınav ve öğrenme etkinlikleri; hesap yönetimi, eğitim süreçlerinin yürütülmesi, ölçme-değerlendirme ve güvenliğin sağlanması amaçlarıyla işlenebilir.",
      },
      {
        heading: "Hukuki sebepler ve aktarım",
        body: "Veriler sözleşmenin kurulması veya ifası, hukuki yükümlülükler ve meşru menfaat gibi uygun işleme şartlarına dayanılarak işlenir. Barındırma, e-posta ve altyapı sağlayıcılarına yalnızca gerekli ölçüde aktarım yapılabilir. Gerçek sağlayıcı ve yurt dışı aktarım envanteri ayrıca yazılmalıdır.",
      },
      {
        heading: "Saklama ve haklarınız",
        body: "Saklama süreleri veri kategorisi bazında üretim politikasında belirlenecektir. KVKK'nın 11. maddesi kapsamındaki talepler için başvuru kanalı ve iletişim adresi gerçek şirket bilgileriyle ayrıca yayınlanmalıdır.",
      },
    ],
  },
  terms: {
    title: "Kullanım Koşulları",
    description: "İzometri çalışma alanının kullanımına ilişkin taslak kurallar.",
    sections: [
      {
        heading: "Hizmetin kapsamı",
        body: "İzometri; soru hazırlama, sınav, değerlendirme, raporlama ve rol tabanlı eğitim yönetimi araçları sunar. Özellikler kurumun yetkilendirmesine göre değişebilir.",
      },
      {
        heading: "Hesap güvenliği",
        body: "Kullanıcı, hesap bilgilerini doğru tutmak ve parolasını paylaşmamakla sorumludur. Yetkisiz erişim şüphesinde kurum yöneticisine gecikmeden bildirim yapılmalıdır.",
      },
      {
        heading: "Eğitim ve sınav dürüstlüğü",
        body: "Sınav bütünlüğünü bozan, başka kullanıcı adına işlem yapan veya sistem güvenliğini aşmaya çalışan kullanımlar yasaktır. Kurum, gerekli durumlarda erişimi inceleyebilir veya sınırlandırabilir.",
      },
      {
        heading: "Yapay zekâ destekli çıktılar",
        body: "Yapay zekâ tarafından hazırlanan soru, puan ve geri bildirimler destekleyici taslaktır. Eğitimsel ve idari nihai karar yetkili insan kullanıcı tarafından verilmelidir.",
      },
    ],
  },
  consent: {
    title: "İsteğe Bağlı Açık Rıza Metni",
    description: "Temel hizmet için zorunlu olmayan ürün geliştirme analizine ilişkin taslak rıza.",
    sections: [
      {
        heading: "Rızanın konusu",
        body: "Kullanım sıklığı, ekran etkileşimleri ve özellik tercihleri gibi kullanım verilerimin, eğitim deneyimini kişiselleştirmek ve İzometri özelliklerini geliştirmek amacıyla analiz edilmesine rıza veriyorum.",
      },
      {
        heading: "Seçim özgürlüğü",
        body: "Bu rızayı vermemek hesap açılmasını veya temel eğitim hizmetlerinden yararlanmayı engellemez. Üretim sürümünde rızayı sonradan geri çekme mekanizması ve bunun sonuçları ayrıca sunulmalıdır.",
      },
    ],
  },
};

export interface LegalConsentValue {
  kvkkAcknowledged: boolean;
  termsAccepted: boolean;
  optionalAnalyticsConsent: boolean;
}

interface LegalConsentProps {
  value: LegalConsentValue;
  onChange: (value: LegalConsentValue) => void;
  disabled?: boolean;
}

export const MOCK_LEGAL_VERSION = "mock-2026-08-25-v1";

/** Kayıt ekranındaki birbirinden ayrılmış yasal bilgilendirme ve tercihler. */
export function LegalConsent({ value, onChange, disabled = false }: LegalConsentProps) {
  const [activeDocument, setActiveDocument] = React.useState<LegalDocumentKey | null>(null);
  const document = activeDocument ? LEGAL_DOCUMENTS[activeDocument] : null;

  function update(key: keyof LegalConsentValue, checked: boolean) {
    onChange({ ...value, [key]: checked });
  }

  return (
    <>
      <div className="space-y-3 rounded-xl border bg-muted/25 p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Kayıt ve veri tercihleri</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Zorunlu bilgilendirmeler ile isteğe bağlı rıza ayrı tutulur.
            </p>
          </div>
        </div>

        <ConsentRow
          id="kvkk-acknowledged"
          checked={value.kvkkAcknowledged}
          required
          disabled={disabled}
          icon={BookOpenText}
          label="KVKK Aydınlatma Metni'ni okudum ve bilgi edindim."
          documentLabel="Metni görüntüle"
          onCheckedChange={(checked) => update("kvkkAcknowledged", checked)}
          onOpenDocument={() => setActiveDocument("kvkk")}
        />
        <ConsentRow
          id="terms-accepted"
          checked={value.termsAccepted}
          required
          disabled={disabled}
          icon={FileCheck2}
          label="Kullanım Koşulları'nı kabul ediyorum."
          documentLabel="Koşulları görüntüle"
          onCheckedChange={(checked) => update("termsAccepted", checked)}
          onOpenDocument={() => setActiveDocument("terms")}
        />
        <ConsentRow
          id="optional-analytics-consent"
          checked={value.optionalAnalyticsConsent}
          disabled={disabled}
          icon={ShieldCheck}
          label="Kullanım verilerimin ürün geliştirme amacıyla analiz edilmesine açık rıza veriyorum."
          documentLabel="Rıza kapsamı"
          optional
          onCheckedChange={(checked) => update("optionalAnalyticsConsent", checked)}
          onOpenDocument={() => setActiveDocument("consent")}
        />

      </div>

      <Dialog
        open={activeDocument !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDocument(null);
        }}
      >
        {document ? (
          <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{document.title}</DialogTitle>
              <DialogDescription>{document.description}</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
              Bu içerik yalnızca arayüz ve akış prototipidir; hukuki metin değildir.
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
              {document.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="mb-1 font-semibold text-foreground">{section.heading}</h3>
                  <p>{section.body}</p>
                </section>
              ))}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

interface ConsentRowProps {
  id: string;
  checked: boolean;
  label: string;
  documentLabel: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onCheckedChange: (checked: boolean) => void;
  onOpenDocument: () => void;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
}

function ConsentRow({
  id,
  checked,
  label,
  documentLabel,
  icon: Icon,
  onCheckedChange,
  onOpenDocument,
  required = false,
  optional = false,
  disabled = false,
}: ConsentRowProps) {
  return (
    <div className="grid grid-cols-[18px_1fr] gap-x-2.5 rounded-lg border border-transparent p-1.5 transition-colors focus-within:border-primary/30 focus-within:bg-background/70 hover:bg-background/55">
      <Checkbox
        id={id}
        checked={checked}
        required={required}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-xs leading-relaxed text-foreground">
          {label}
          {optional ? (
            <span className="ml-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              İsteğe bağlı
            </span>
          ) : null}
        </label>
        <button
          type="button"
          className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
          disabled={disabled}
          onClick={onOpenDocument}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {documentLabel}
        </button>
      </div>
    </div>
  );
}
