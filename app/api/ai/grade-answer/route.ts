import { gradeAnswer } from "@/lib/ai";
import { errorMessage, jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import type { GradeAnswerRequest, GradingResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/grade-answer
 *
 * Govde: { studentAnswer, rubric, questionText?, maxScore? }
 * Yanit: { ok: true, data: GradingResult }
 *
 * Yetki: ogrenci (kendi cevabi icin on izleme) ve egitmen.
 * Nihai puan her zaman egitmen onayiyla kesinlesir.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["ogrenci", "egitmen"]);
  if (!guard.ok) return guard.response;

  try {
    const body = await readJson<GradeAnswerRequest>(request);

    if (typeof body.studentAnswer !== "string") {
      return jsonError("studentAnswer alani zorunludur.");
    }

    if (typeof body.rubric !== "string" || body.rubric.trim().length === 0) {
      return jsonError("rubric alani zorunludur.");
    }

    const maxScore = Math.min(Math.max(body.maxScore ?? 100, 1), 100);

    const result: GradingResult = await gradeAnswer(body.studentAnswer, body.rubric, {
      maxScore,
      ...(body.questionText ? { questionText: body.questionText } : {}),
    });

    return jsonOk(result);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}
