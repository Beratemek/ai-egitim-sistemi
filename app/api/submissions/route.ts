import { approveSubmission, submitAnswer } from "@/app/actions/submissions";
import { errorMessage, jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import { MOCK_SUBMISSIONS } from "@/lib/mock-data";
import { getSubmissions } from "@/lib/queries";
import type { Submission } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/submissions?examId=...
 * Egitmen/yonetici yetkili cevaplari, ogrenci ise sonuc gorunurluk kurallariyla
 * maskelenmis kendi cevaplarini gorur.
 */
export async function GET(request: Request) {
  const guard = await requireRole(["ogrenci", "egitmen", "egitim_yoneticisi"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonOk<Submission[]>([...MOCK_SUBMISSIONS]);
  }

  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId");

    const data = await getSubmissions({ examId: examId ?? undefined });
    return jsonOk<Submission[]>(data);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}

interface CreateSubmissionBody {
  examId: string;
  questionId: string;
  /** Coktan secmelide secenek anahtari ("B"), acik ucluda serbest metin. */
  answerText: string;
}

/**
 * POST /api/submissions
 *
 * Ogrenci cevabini taslak olarak kaydeder. AI degerlendirmesi ancak sinav
 * butun olarak teslim edildiginde calisir; UI ve REST ayni kurali kullanir.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["ogrenci"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonError("Supabase yapilandirilmadigi icin kayit yapilamiyor.", 503);
  }

  try {
    const body = await readJson<CreateSubmissionBody>(request);

    if (!body.examId || !body.questionId) {
      return jsonError("examId ve questionId zorunludur.");
    }

    if (typeof body.answerText !== "string" || body.answerText.trim().length === 0) {
      return jsonError("Bos cevap gonderilemez.");
    }

    const result = await submitAnswer({
      examId: body.examId,
      questionId: body.questionId,
      answerText: body.answerText,
    });
    return result.ok ? jsonOk(result.data, 201) : jsonError(result.error);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}

interface ApproveSubmissionBody {
  id: string;
  /** Egitmenin belirledigi nihai puan (0-100). */
  score: number;
  note?: string;
}

/**
 * PATCH /api/submissions
 * Egitmenin AI puanini onaylamasi veya duzeltmesi.
 */
export async function PATCH(request: Request) {
  const guard = await requireRole(["egitmen"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonError("Supabase yapilandirilmadigi icin guncelleme yapilamiyor.", 503);
  }

  try {
    const body = await readJson<ApproveSubmissionBody>(request);

    if (!body.id) return jsonError("Cevap id'si zorunludur.");

    if (typeof body.score !== "number" || body.score < 0 || body.score > 100) {
      return jsonError("Puan 0 ile 100 arasinda olmalidir.");
    }

    const result = await approveSubmission({
      submissionId: body.id,
      score: body.score,
      note: body.note,
    });
    return result.ok ? jsonOk({ approved: true }) : jsonError(result.error);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}
