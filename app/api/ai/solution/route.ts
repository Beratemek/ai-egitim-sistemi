import { createClient } from "@supabase/supabase-js";

import { describeAiError, generateSolution } from "@/lib/ai";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import { requireSupabaseEnv } from "@/lib/env";
import { grantedRoles } from "@/lib/roles";
import type { QuestionSolution } from "@/lib/solution";
import type { Database } from "@/lib/types";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SolutionRequest {
  questionId?: unknown;
  /** Yeniden üretim: çözümü olan soruyu da işle. */
  force?: unknown;
  /** Bu çağrı için model adı; kota yönlendirmesi içindir. */
  model?: unknown;
}

/**
 * Betik için Bearer token ile kimlik.
 *
 * Tarayıcı bu uç noktaya ÇEREZLE gelir; toplu üretim betiği
 * (`npm run cozum:uret`) ise bir tarayıcı değil, çerezi yok. Bunun yerine
 * Supabase'den aldığı gerçek kullanıcı tokenını `Authorization` başlığında
 * gönderiyor.
 *
 * GÜVENLİK: bu bir arka kapı DEĞİL. Token gerçek bir kullanıcıya ait ve
 * oluşturulan istemci `anon` anahtarıyla çalışıyor - yani RLS aynen
 * geçerli, service_role bypass'ı yok. Rol kontrolü de burada tekrar
 * yapılıyor: yalnızca içerik uzmanı ve eğitmen geçebiliyor.
 *
 * Token yoksa `null` döner ve çağıran çerez yoluna düşer.
 */
async function tokenIleYetki(request: Request) {
  const baslik = request.headers.get("authorization");
  if (!baslik?.startsWith("Bearer ")) return null;

  const token = baslik.slice(7).trim();
  if (!token) return null;

  const { url, anonKey } = requireSupabaseEnv();
  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, roles")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const roles = grantedRoles(profile);
  const izinli = roles.some((role) =>
    ["icerik_uzmani", "egitmen", "admin"].includes(role),
  );
  if (!izinli) return null;

  return supabase;
}

/**
 * Bir sorunun adım adım çözümünü üretir ve `questions.solution_json` alanına
 * yazar.
 *
 * ÇÖZÜM SORUYA AİT, ÖĞRENCİYE DEĞİL: aynı sorunun çözümü herkes için aynıdır.
 * Bu yüzden soru başına BİR KEZ üretilip saklanıyor. Bu uç nokta öğrenci
 * tarafından çağrılmaz - toplu üretim betiği (`npm run cozum:uret`) ve
 * ileride onay ekranındaki "yeniden üret" düğmesi kullanır.
 *
 * YETKİ: içerik uzmanı ve eğitmen. Öğrenci ve veli buraya erişemez; çünkü
 * girdide doğru cevap ve rubrik var. Çıktı öğrenciye ancak sınav
 * SONUÇLANDIKTAN sonra, ayrı bir okuma yolundan gösterilir.
 *
 * VARSAYILAN OLARAK ÜZERİNE YAZMAZ: çözümü olan soru atlanır. Kota israfını
 * ve elle düzeltilmiş bir çözümün sessizce ezilmesini engelliyor. Bilerek
 * yenilemek için `force: true`.
 */
export async function POST(request: Request) {
  /*
    İki kimlik yolu: tarayıcı çerezle, toplu üretim betiği Bearer token ile.
    Token yolu önce deneniyor çünkü betikte çerez hiç yok; başarısız olursa
    normal çerez kapısına düşülüyor.
  */
  const tokenIstemcisi = await tokenIleYetki(request);

  if (!tokenIstemcisi) {
    const guard = await requireRole(["icerik_uzmani", "egitmen"]);
    if (!guard.ok) return guard.response;
    if (!guard.user) return jsonError("Bu özellik tanıtım modunda kullanılamaz.", 503);
  }

  try {
    const body = await readJson<SolutionRequest>(request);
    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";
    if (!questionId) return jsonError("Çözümü üretilecek soru seçilmedi.");

    const supabase = tokenIstemcisi ?? (await createServerSupabaseClient());

    const { data: question, error } = await supabase
      .from("questions")
      .select(
        "id, subject, topic, text, type, options_json, correct_answer, rubric, outcome_id, solution_json",
      )
      .eq("id", questionId)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!question) return jsonError("Soru bulunamadı.", 404);

    if (question.solution_json && body.force !== true) {
      return jsonError(
        "Bu sorunun çözümü zaten var. Yenilemek için force gönderin.",
        409,
      );
    }

    /*
      Kazanım metni AYRI okunuyor, join ile değil.

      Kazanım çözümün "hangi hedefi ölçüyoruz" bağlamını veriyor ve modelin
      konu dışına sapmasını engelliyor. Soruların bir kısmında `outcome_id`
      null olduğu için zorunlu bir join yanlış olurdu.
    */
    let outcomeText: string | null = null;
    if (question.outcome_id) {
      const { data: outcome } = await supabase
        .from("learning_outcomes")
        .select("outcome_text")
        .eq("id", question.outcome_id)
        .maybeSingle();
      outcomeText = outcome?.outcome_text ?? null;
    }

    const solution = await generateSolution({
      subject: question.subject ?? "",
      topic: question.topic ?? "",
      outcomeText,
      questionText: question.text,
      questionType: question.type,
      options: (question.options_json ?? []).map((option) => ({
        key: option.key,
        text: option.text,
      })),
      correctAnswer: question.correct_answer,
      rubric: question.rubric,
    },
    typeof body.model === "string" ? body.model : null);

    const { error: yazmaHatasi } = await supabase
      .from("questions")
      .update({ solution_json: solution })
      .eq("id", questionId);

    if (yazmaHatasi) return jsonError(yazmaHatasi.message, 500);

    return jsonOk<QuestionSolution>(solution);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}
