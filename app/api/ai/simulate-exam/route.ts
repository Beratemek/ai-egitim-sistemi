import { describeAiError, simulateExam, SIMULATION_LIMITS } from "@/lib/ai";
import { isAiProvider, providerInfo } from "@/lib/ai-providers";
import { resolveAiConfigFor } from "@/lib/ai-settings";
import { jsonError, jsonOk, readJson, requireRole } from "@/lib/api";
import type { ExamSimulationReport } from "@/lib/exam-simulation";
import { loadExamQualityBundle } from "@/lib/exam-quality-data";
import { loadClassroomTwin, toSimulationQuestions } from "@/lib/exam-simulation-data";
import {
  createProfile,
  presetCohort,
  type CohortMember,
} from "@/lib/student-profiles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SimulateExamRequest, ManualProfileInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/simulate-exam
 *
 * Govde: { examId, cohort, model?, provider? }
 * Yanit: { ok: true, data: ExamSimulationReport }
 *
 * Yetki: egitmen (kendi sinavi) ve admin.
 *
 * Sinavi -yayina almadan once- simule bir sinifa cozdurur ve puan dagilimi,
 * soru bazinda tahmin, kazanim kirilimi ve sure uyumu dondurur.
 *
 * KADRO UC YOLDAN GELIR:
 *   hazir - soru kalitesi panelindeki zit takim; hizli bir "aklibasinda sinif"
 *           kestirimi icin.
 *   elle  - egitmenin kurdugu profiller: "matematikte iyi, fizikte zayif 12
 *           ogrenci". Yetkinlik ve dikkat degerleri 0-1 arasi gelir.
 *   ikiz  - gercek bir sinifin gecmis basarisindan turetilen kadro. Ogrenci
 *           kimligi ve adi modele GITMEZ; yalnizca yetkinlik dilimleri.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["egitmen"]);
  if (!guard.ok) return guard.response;
  if (!guard.user) return jsonError("Bu özellik tanıtım modunda kullanılamaz.", 503);

  try {
    const body = await readJson<SimulateExamRequest>(request);
    const examId = typeof body.examId === "string" ? body.examId.trim() : "";
    if (!examId) return jsonError("Simüle edilecek sınav seçilmedi.");

    const supabase = await createServerSupabaseClient();
    const bundle = await loadExamQualityBundle(supabase, examId);
    if (!bundle) return jsonError("Sınav bulunamadı.", 404);

    const isAdmin =
      guard.user.actualRole === "admin" || guard.user.profile.roles.includes("admin");
    if (bundle.exam.instructor_id !== guard.user.user.id && !isAdmin) {
      return jsonError("Yalnızca kendi sınavınızı simüle edebilirsiniz.", 403);
    }

    const questions = toSimulationQuestions(bundle);
    if (questions.length === 0) {
      return jsonError("Kestirim için önce sınava soru ekleyin.", 409);
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

    const cohort = await resolveCohort(body, supabase);
    if ("error" in cohort) return jsonError(cohort.error, cohort.status);

    const report = await simulateExam({
      cohort: cohort.members,
      questions,
      durationMinutes: bundle.exam.duration_minutes,
      cohortLabel: cohort.label,
      ...(model ? { modelId: model } : {}),
      ...(provider ? { providerId: provider } : {}),
    });

    return jsonOk<ExamSimulationReport>(report);
  } catch (caught) {
    return jsonError(describeAiError(caught), 500);
  }
}

type CohortResolution =
  | { members: CohortMember[]; label: string }
  | { error: string; status: number };

async function resolveCohort(
  body: SimulateExamRequest,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<CohortResolution> {
  const cohort = body.cohort;

  if (!cohort || typeof cohort !== "object") {
    return { error: "Kadro seçilmedi.", status: 400 };
  }

  if (cohort.kind === "hazir") {
    return { members: presetCohort(), label: "Hazır karma sınıf" };
  }

  if (cohort.kind === "ikiz") {
    const classroom = typeof cohort.classroom === "string" ? cohort.classroom.trim() : "";
    if (!classroom) return { error: "Sınıf seçilmedi.", status: 400 };

    const twin = await loadClassroomTwin(supabase, classroom);
    if (twin.cohort.length === 0) {
      return {
        error:
          `${classroom} sınıfında yeterli geçmiş sonuç yok. Bu sınıfın en az bir sınavı ` +
          "eğitmen onayından geçmeden dijital ikiz kurulamaz; şimdilik hazır kadroyu ya da " +
          "elle kurduğunuz sınıfı kullanın.",
        status: 409,
      };
    }

    return {
      members: twin.cohort,
      label: `${classroom} dijital ikizi (${twin.studentCount} öğrenci)`,
    };
  }

  if (cohort.kind === "elle") {
    return resolveManualCohort(cohort.profiles);
  }

  return { error: "Bilinmeyen kadro türü.", status: 400 };
}

/**
 * Egitmenin kurdugu profilleri kadroya cevirir.
 *
 * Yetkinlik ve dikkat 0-1 arasi geliyor; grup atamasi `groupFromAbility()`
 * icinde yapiliyor - egitmen "ust grup/alt grup" kavramini bilmek zorunda
 * kalmasin diye.
 */
function resolveManualCohort(profiles: unknown): CohortResolution {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return { error: "En az bir öğrenci profili tanımlayın.", status: 400 };
  }

  if (profiles.length > SIMULATION_LIMITS.maxProfiles) {
    return {
      error: `En fazla ${SIMULATION_LIMITS.maxProfiles} profil tanımlayabilirsiniz.`,
      status: 400,
    };
  }

  const members: CohortMember[] = [];

  for (const [index, raw] of profiles.entries()) {
    const input = raw as ManualProfileInput;

    if (typeof input?.label !== "string" || !input.label.trim()) {
      return { error: `${index + 1}. profilin adı boş olamaz.`, status: 400 };
    }
    if (!isRatio(input.ability) || !isRatio(input.diligence)) {
      return {
        error: `${input.label}: yetkinlik ve dikkat 0 ile 1 arasında olmalı.`,
        status: 400,
      };
    }

    const count = Math.round(Number(input.count));
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      return {
        error: `${input.label}: öğrenci sayısı 1 ile 200 arasında olmalı.`,
        status: 400,
      };
    }

    const subjectAbility = normalizeSubjectAbility(input.subjectAbility);

    members.push({
      weight: count,
      profile: createProfile({
        id: `elle-${index + 1}`,
        label: input.label.trim().slice(0, 60),
        ability: input.ability,
        diligence: input.diligence,
        misconception: input.misconception?.trim().slice(0, 200) || null,
        ...(subjectAbility ? { subjectAbility } : {}),
      }),
    });
  }

  const toplam = members.reduce((total, member) => total + member.weight, 0);
  return { members, label: `Elle kurulan sınıf (${toplam} öğrenci)` };
}

function isRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Ders bazli yetkinligi temizler; gecersiz girdiler sessizce atilir. */
function normalizeSubjectAbility(
  raw: Record<string, number> | undefined,
): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;

  const result: Record<string, number> = {};
  for (const [subject, value] of Object.entries(raw).slice(0, 12)) {
    if (!subject.trim() || !isRatio(value)) continue;
    result[subject.trim().slice(0, 120)] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}
