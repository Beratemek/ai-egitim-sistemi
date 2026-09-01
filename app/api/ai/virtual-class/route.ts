import { describeAiError, runVirtualClass } from "@/lib/ai";
import { isAiProvider, providerInfo } from "@/lib/ai-providers";
import { resolveAiConfigFor } from "@/lib/ai-settings";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import type { VirtualClassReport } from "@/lib/student-agents";
import type { VirtualClassRequest } from "@/lib/types";

// AI SDK Node.js ortamini gerektirir.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/virtual-class
 *
 * Govde: { question, kazanim?, subject?, model?, provider? }
 * Yanit: { ok: true, data: VirtualClassReport }
 *
 * Yetki: icerik uzmani ve egitmen.
 *
 * Taslak soruyu -henuz veritabaninda degil- simule ogrencilerle pilot
 * uygulamaya sokar ve madde analizi raporu dondurur.
 *
 * ONARIM BURADA DEGIL: bulgulara gore duzeltme, raporun `repairInstruction`
 * alanlarindan uretilen talimatla var olan `/api/ai/revise-question` ucundan
 * yapiliyor. Ayni isi burada tekrarlamak, onarim istendiginde pilotun bastan
 * calistirilmasi demekti - elde duran rapor icin iki model cagrisi bosa
 * giderdi.
 *
 * SORU GOVDEDEN GELIYOR, VERITABANINDAN DEGIL: pilot uygulama uretim
 * ekraninda, soru havuza gonderilmeden ONCE calisiyor. Bu yuzden burada
 * sahiplik kontrolu yok - kullanici zaten kendi urettigi taslagi gonderiyor
 * ve yanit yalnizca kendisine donuyor.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["icerik_uzmani", "egitmen"]);
  if (!guard.ok) return guard.response;

  try {
    const body = await readJson<VirtualClassRequest>(request);
    const question = body.question;

    if (!question || typeof question !== "object") {
      return jsonError("Pilot uygulamaya sokulacak soru gonderilmedi.");
    }

    if (typeof question.text !== "string" || question.text.trim().length === 0) {
      return jsonError("Soru metni bos olamaz.");
    }

    if (question.type !== "test" && question.type !== "acik_uclu") {
      return jsonError("Soru tipi gecersiz.");
    }

    /*
      Test sorusunda cevap anahtari ZORUNLU: rapordaki her metrik (p degeri,
      ayirt edicilik, celdirici dagilimi) ogrenci cevaplarinin anahtarla
      karsilastirilmasindan cikiyor. Anahtar yoksa dondurulecek rapor bos
      olurdu; bunu sessizce yapmak yerine acikca reddediyoruz.
    */
    if (question.type === "test" && !question.correct_answer) {
      return jsonError("Çoktan seçmeli soruda doğru cevap işaretli olmalıdır.");
    }

    if (question.type === "acik_uclu" && !question.rubric) {
      return jsonError("Açık uçlu soruda rubrik olmadan pilot uygulama yapılamaz.");
    }

    // Model adi bicim olarak dogrulaniyor; bkz. generate-questions/route.ts.
    const model =
      typeof body.model === "string" && /^[A-Za-z0-9._:\/-]{1,120}$/.test(body.model.trim())
        ? body.model.trim()
        : undefined;

    const provider = isAiProvider(body.provider) ? body.provider : undefined;

    if (provider && !(await resolveAiConfigFor(provider))) {
      return jsonError(
        `${providerInfo(provider).label} için kayıtlı bir API anahtarı yok. Sistem yöneticisi bu sağlayıcıyı tanımlamalı.`,
      );
    }

    const options = {
      ...(typeof body.kazanim === "string" && body.kazanim.trim()
        ? { kazanim: body.kazanim.trim() }
        : {}),
      ...(typeof body.subject === "string" && body.subject.trim()
        ? { subject: body.subject.trim() }
        : {}),
      ...(model ? { modelId: model } : {}),
      ...(provider ? { providerId: provider } : {}),
    };

    const report = await runVirtualClass(question, options);

    return jsonOk<VirtualClassReport>(report);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}
