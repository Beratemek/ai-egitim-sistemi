import { errorMessage, jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";
import { MOCK_QUESTIONS } from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  QUESTION_STATUSES,
  type GeneratedQuestion,
  type Question,
  type QuestionStatus,
} from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/questions?status=taslak&topic=Fotosentez
 * Soru havuzunu dondurur.
 */
export async function GET(request: Request) {
  const guard = await requireRole(["egitmen", "icerik_uzmani", "egitim_yoneticisi"]);
  if (!guard.ok) return guard.response;

  // Demo modu: mock veriyi dondur.
  if (!isSupabaseConfigured) {
    return jsonOk<Question[]>([...MOCK_QUESTIONS]);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const topic = searchParams.get("topic");

    const supabase = await createServerSupabaseClient();
    let query = supabase.from("questions").select("*").order("created_at", {
      ascending: false,
    });

    if (status && (QUESTION_STATUSES as readonly string[]).includes(status)) {
      query = query.eq("status", status as QuestionStatus);
    }

    if (topic) query = query.eq("topic", topic);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return jsonOk<Question[]>(data ?? []);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}

interface CreateQuestionsBody {
  /** AI'dan gelen taslaklar. */
  questions: GeneratedQuestion[];
  /** Hangi kazanimdan uretildigi. */
  outcomeId?: string;
}

/**
 * POST /api/questions
 * AI taslaklarini havuza "taslak" durumunda kaydeder.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["icerik_uzmani", "egitmen"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonError("Supabase yapilandirilmadigi icin kayit yapilamiyor.", 503);
  }

  try {
    const body = await readJson<CreateQuestionsBody>(request);

    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return jsonError("En az bir soru gonderilmelidir.");
    }

    const supabase = await createServerSupabaseClient();
    const createdBy = guard.user?.user.id ?? null;

    const rows = body.questions.map((question) => ({
      topic: question.topic,
      text: question.text,
      type: question.type,
      options_json: question.options,
      correct_answer: question.correct_answer,
      rubric: question.rubric,
      status: "taslak" as const,
      outcome_id: body.outcomeId ?? null,
      created_by: createdBy,
      ai_generated: true,
    }));

    const { data, error } = await supabase.from("questions").insert(rows).select();
    if (error) throw new Error(error.message);

    return jsonOk<Question[]>(data ?? [], 201);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}

interface UpdateQuestionBody {
  id: string;
  status: QuestionStatus;
}

/**
 * PATCH /api/questions
 * Egitmenin bir taslagi onaylamasi / reddetmesi.
 */
export async function PATCH(request: Request) {
  const guard = await requireRole(["egitmen"]);
  if (!guard.ok) return guard.response;

  if (!isSupabaseConfigured) {
    return jsonError("Supabase yapilandirilmadigi icin guncelleme yapilamiyor.", 503);
  }

  try {
    const body = await readJson<UpdateQuestionBody>(request);

    if (!body.id) return jsonError("Soru id'si zorunludur.");

    if (!(QUESTION_STATUSES as readonly string[]).includes(body.status)) {
      return jsonError(`Gecersiz durum: ${String(body.status)}`);
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("questions")
      .update({
        status: body.status,
        reviewed_by: guard.user?.user.id ?? null,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return jsonOk<Question>(data);
  } catch (caught) {
    return jsonError(errorMessage(caught), 500);
  }
}
