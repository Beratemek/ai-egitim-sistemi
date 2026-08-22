import {
  REVISION_PRESETS,
  isRevisionPreset,
  reviseQuestion,
  type RevisionPreset,
} from "@/lib/ai";
import { describeAiError } from "@/lib/ai";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import type { GeneratedQuestion, ReviseQuestionRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Serbest talimat icin ust sinir - cok uzun metin baglami sisirir. */
const MAX_INSTRUCTION = 500;

/**
 * POST /api/ai/revise-question
 *
 * Govde: { question, preset? | instruction?, kazanim?, context? }
 * Yanit: { ok: true, data: GeneratedQuestion }
 *
 * `preset` hazir talimatlardan birini (zorlastir, kolaylastir, kisalt,
 * celdirici) secer; `instruction` serbest metin gonderir. Ikisi birlikte
 * gelirse hazir talimat once, serbest metin sonra eklenir - uzman hem
 * "zorlastir" der hem "sadece ilk sikki degistir" diye ekleyebilir.
 *
 * Yetki: icerik uzmani ve egitmen.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["icerik_uzmani", "egitmen"]);
  if (!guard.ok) return guard.response;

  try {
    const body = await readJson<ReviseQuestionRequest>(request);

    const question = body.question;
    if (!question || typeof question.text !== "string" || !question.text.trim()) {
      return jsonError("Revize edilecek soru gonderilmedi.");
    }

    if (question.type !== "test" && question.type !== "acik_uclu") {
      return jsonError("Soru tipi gecersiz.");
    }

    const parts: string[] = [];

    if (body.preset !== undefined) {
      if (!isRevisionPreset(body.preset)) {
        return jsonError(
          `Gecersiz revizyon istegi: ${String(body.preset)}. Gecerli olanlar: ${Object.keys(
            REVISION_PRESETS,
          ).join(", ")}`,
        );
      }
      parts.push(REVISION_PRESETS[body.preset as RevisionPreset]);
    }

    if (typeof body.instruction === "string" && body.instruction.trim()) {
      parts.push(body.instruction.trim().slice(0, MAX_INSTRUCTION));
    }

    if (parts.length === 0) {
      return jsonError("Ne yapilmasini istediginizi secin ya da yazin.");
    }

    const revised: GeneratedQuestion = await reviseQuestion(
      question,
      parts.join(" "),
      {
        ...(body.kazanim ? { kazanim: body.kazanim } : {}),
        ...(body.context ? { context: body.context } : {}),
      },
    );

    return jsonOk<GeneratedQuestion>(revised);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}
