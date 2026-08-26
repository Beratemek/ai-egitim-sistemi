import { createClient } from "@/lib/supabase";
import type { StudentStudyPlanRow, StudyPlanStatus } from "@/lib/types";

export const STUDENT_STUDY_PLAN_STORAGE_KEY = "student-study-plan-v1";
export const STUDENT_STUDY_PLAN_CHANGED_EVENT = "student-study-plan-changed";

export type { StudyPlanStatus } from "@/lib/types";

export interface StudyPlanItem {
  /** Gelisim onerisi yeniden olusturulsa da degismeyen anahtar. */
  id: string;
  title: string;
  context: string | null;
  action: string | null;
  evidence: string | null;
  outcomeId: string | null;
  latestExamId: string | null;
  status: StudyPlanStatus;
  savedAt: string;
  updatedAt: string;
}

export interface NewStudyPlanItem {
  id: string;
  title: string;
  context?: string | null;
  action?: string | null;
  evidence?: string | null;
  outcomeId?: string | null;
  latestExamId?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatus(value: unknown): value is StudyPlanStatus {
  return (
    value === "baslanmadi" ||
    value === "calisiliyor" ||
    value === "tamamlandi"
  );
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asIsoDate(value: unknown): string | null {
  const text = asNullableString(value);
  if (!text || Number.isNaN(new Date(text).getTime())) return null;
  return text;
}

/** İlk sürümde kaydedilmiş ASCII Türkçe önerileri düzgün gösterir. */
function repairLegacyTurkishText(value: unknown): string | null {
  const text = asNullableString(value);
  if (!text) return null;

  const replacements: Array<[string, string]> = [
    ["onayli", "onaylı"],
    ["onaylı cevapta", "onaylı cevap üzerinden"],
    ["kavramlari", "kavramları"],
    ["kisa", "kısa"],
    ["anlatimiyla", "anlatımıyla"],
    ["ardindan", "ardından"],
    ["duzey", "düzey"],
    ["cozumunu", "çözümünü"],
    ["coz", "çöz"],
    ["Yanlis", "Yanlış"],
    ["yaptigin", "yaptığın"],
    ["adimlari", "adımları"],
    ["ayni", "aynı"],
    ["kazanimdan", "kazanımdan"],
    ["Basarini", "Başarını"],
    ["icin", "için"],
    ["cumlelerinle", "cümlelerinle"],
    ["acikla", "açıkla"],
  ];

  return replacements.reduce(
    (result, [legacy, corrected]) => result.replaceAll(legacy, corrected),
    text,
  );
}

/** Eski localStorage kayıtlarını kaybetmeden okur. */
function normalizeLegacyItem(value: unknown): StudyPlanItem | null {
  if (!isRecord(value)) return null;

  const id = asNullableString(value.id);
  const title = asNullableString(value.title);
  if (!id || !title) return null;

  const savedAt = asIsoDate(value.savedAt) ?? new Date(0).toISOString();

  return {
    id,
    title,
    context: repairLegacyTurkishText(value.context),
    action: repairLegacyTurkishText(value.action),
    evidence: repairLegacyTurkishText(value.evidence),
    outcomeId: asNullableString(value.outcomeId),
    latestExamId: asNullableString(value.latestExamId),
    status: isStatus(value.status) ? value.status : "baslanmadi",
    savedAt,
    updatedAt: asIsoDate(value.updatedAt) ?? savedAt,
  };
}

function readLegacyStudyPlan(): StudyPlanItem[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STUDENT_STUDY_PLAN_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeLegacyItem)
      .filter((item): item is StudyPlanItem => item !== null);
  } catch {
    return [];
  }
}

function fromRow(row: StudentStudyPlanRow): StudyPlanItem {
  return {
    id: row.recommendation_key,
    title: row.title,
    context: row.context,
    action: row.action,
    evidence: row.evidence,
    outcomeId: row.outcome_id,
    latestExamId: row.latest_exam_id,
    status: row.status,
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  };
}

function notifyStudyPlanChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STUDENT_STUDY_PLAN_CHANGED_EVENT));
  }
}

async function requireAuthenticatedStudentId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Çalışma planını kullanmak için oturum açmalısınız.");
  }

  return user.id;
}

async function fetchRemoteStudyPlan(studentId: string): Promise<StudyPlanItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("student_study_plan_items")
    .select("*")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Çalışma planı yüklenemedi: ${error.message}`);
  }

  return (data ?? []).map(fromRow);
}

/**
 * Tarayıcıda kalan eski planı, uzak plandaki daha yeni kayıtları ezmeden
 * kullanıcı hesabına bir kez taşır.
 */
async function migrateLegacyPlan(studentId: string): Promise<boolean> {
  const legacyItems = readLegacyStudyPlan();
  if (legacyItems.length === 0) return false;

  const supabase = createClient();
  const rows = legacyItems.map((item) => ({
    student_id: studentId,
    recommendation_key: item.id,
    title: item.title,
    context: item.context,
    action: item.action,
    evidence: item.evidence,
    outcome_id: item.outcomeId,
    latest_exam_id: item.latestExamId,
    status: item.status,
    saved_at: item.savedAt,
    updated_at: item.updatedAt,
  }));

  const { error } = await supabase
    .from("student_study_plan_items")
    .upsert(rows, {
      onConflict: "student_id,recommendation_key",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`Eski çalışma planı hesaba aktarılamadı: ${error.message}`);
  }

  window.localStorage.removeItem(STUDENT_STUDY_PLAN_STORAGE_KEY);
  return true;
}

/** Hesaba bağlı güncel çalışma planını getirir. */
export async function getStudyPlan(): Promise<StudyPlanItem[]> {
  const studentId = await requireAuthenticatedStudentId();
  const migrated = await migrateLegacyPlan(studentId);
  const items = await fetchRemoteStudyPlan(studentId);
  if (migrated) notifyStudyPlanChanged();
  return items;
}

/** Öneriyi plana ekler; varsa içeriğini günceller, öğrencinin durumunu korur. */
export async function addStudyPlanItem(
  input: NewStudyPlanItem,
): Promise<StudyPlanItem> {
  const studentId = await requireAuthenticatedStudentId();
  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from("student_study_plan_items")
    .select("*")
    .eq("student_id", studentId)
    .eq("recommendation_key", input.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Çalışma planı kontrol edilemedi: ${existingError.message}`);
  }

  const values = {
    title: input.title,
    context: input.context ?? null,
    action: input.action ?? null,
    evidence: input.evidence ?? null,
    outcome_id: input.outcomeId ?? null,
    latest_exam_id: input.latestExamId ?? null,
  };

  const result = existing
    ? await supabase
        .from("student_study_plan_items")
        .update(values)
        .eq("id", existing.id)
        .eq("student_id", studentId)
        .select("*")
        .single()
    : await supabase
        .from("student_study_plan_items")
        .insert({
          student_id: studentId,
          recommendation_key: input.id,
          ...values,
        })
        .select("*")
        .single();

  if (result.error) {
    throw new Error(`Çalışma plana eklenemedi: ${result.error.message}`);
  }

  notifyStudyPlanChanged();
  return fromRow(result.data);
}

export async function removeStudyPlanItem(id: string): Promise<void> {
  const studentId = await requireAuthenticatedStudentId();
  const supabase = createClient();
  const { error } = await supabase
    .from("student_study_plan_items")
    .delete()
    .eq("student_id", studentId)
    .eq("recommendation_key", id);

  if (error) {
    throw new Error(`Çalışma plandan çıkarılamadı: ${error.message}`);
  }

  notifyStudyPlanChanged();
}

export async function updateStudyPlanStatus(
  id: string,
  status: StudyPlanStatus,
): Promise<StudyPlanItem> {
  const studentId = await requireAuthenticatedStudentId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("student_study_plan_items")
    .update({ status })
    .eq("student_id", studentId)
    .eq("recommendation_key", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Çalışma durumu güncellenemedi: ${error.message}`);
  }

  notifyStudyPlanChanged();
  return fromRow(data);
}
