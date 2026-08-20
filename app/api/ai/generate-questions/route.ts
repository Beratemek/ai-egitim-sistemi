import { generateQuestions } from "@/lib/ai";
import { errorMessage, jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { categoryLabel, isDeneyapCategory } from "@/lib/deneyap";
import { getStyleGuide } from "@/lib/queries";
import type { GenerateQuestionsRequest, GeneratedQuestion } from "@/lib/types";

// AI SDK Node.js ortamini gerektirir.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/generate-questions
 *
 * Govde: { context, kazanim, topic?, count?, type? }
 * Yanit: { ok: true, data: GeneratedQuestion[] }
 *
 * Yetki: icerik uzmani ve egitmen.
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

    // Icerik uzmaninin gecmis begeni/red kayitlari modele ornek olarak verilir.
    const styleGuide = await getStyleGuide();

    const questions: GeneratedQuestion[] = await generateQuestions(
      body.context,
      body.kazanim,
      {
        count,
        type: body.type ?? "karisik",
        styleGuide,
        ...(body.topic ? { topic: body.topic } : {}),
        // Atolye dali modele alan baglami olarak verilir; gecersiz deger atlanir.
        ...(isDeneyapCategory(body.category)
          ? { categoryLabel: categoryLabel(body.category) }
          : {}),
      },
    );

    return jsonOk(questions);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}
