import { generateQuestions } from "@/lib/ai";
import { describeAiError } from "@/lib/ai";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { getStyleGuide } from "@/lib/queries";
import type { GenerateQuestionsRequest, GeneratedQuestion } from "@/lib/types";

// AI SDK Node.js ortamini gerektirir.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/generate-questions
 *
 * Govde: { context, kazanim, subject?, topic?, count?, type?, difficulty? }
 * Yanit: { ok: true, data: GeneratedQuestion[] }
 *
 * Yetki: icerik uzmani ve egitmen.
 *
 * GORSEL ICIN SECIM YOK: model her soruda gorsele ihtiyac olup olmadigina
 * ve turune (chart/svg/referans) kendisi karar verir - bkz. lib/ai.ts
 * icindeki VISUAL_INSTRUCTION. Once bir "gorsel modu" secimi vardi, kullanici
 * her uretimde bunu elle secmek zorundaydi; kaldirildi.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["icerik_uzmani", "egitmen"]);
  if (!guard.ok) return guard.response;

  try {
    const body = await readJson<GenerateQuestionsRequest>(request);

    if (typeof body.context !== "string" || body.context.trim().length < 20) {
      return jsonError("Kaynak metin en az 20 karakter olmalidir.");
    }

    if (typeof body.kazanim !== "string" || body.kazanim.trim().length === 0) {
      return jsonError("Kazanim alani zorunludur.");
    }

    const count = Math.min(Math.max(body.count ?? 5, 1), 20);

    /*
      Tarz hafizasi KAPSAMLI okunuyor: once bu ders + bu konu, yeterli ornek
      yoksa bu ders, o da yoksa genel. Onceden kapsam yoktu ve baska bir
      dersteki geri bildirim buraya karisiyordu.
    */
    const styleGuide = await getStyleGuide({
      ...(body.subject ? { subject: body.subject } : {}),
      ...(body.topic ? { topic: body.topic } : {}),
    });

    const questions: GeneratedQuestion[] = await generateQuestions(
      body.context,
      body.kazanim,
      {
        count,
        type: body.type ?? "karisik",
        difficulty: body.difficulty ?? "karisik",
        styleGuide,
        ...(body.topic ? { topic: body.topic } : {}),
      },
    );

    return jsonOk(questions);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}
