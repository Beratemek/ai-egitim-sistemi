"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import {
  createServerSupabaseClient,
  getCurrentUser,
} from "@/lib/supabase-server";

export interface CourseFeedbackInput {
  examId: string;
  clarity: number;
  pace: number;
  materials: number;
  assessmentFairness: number;
  helpful?: string;
  improvement?: string;
}

function validRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** İsteğe bağlı ders deneyimi değerlendirmesini anonim olarak kaydeder. */
export async function submitCourseExperienceFeedback(
  input: CourseFeedbackInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!input.examId) return { ok: false, error: "Sınav kimliği zorunludur." };

  const ratings = [
    input.clarity,
    input.pace,
    input.materials,
    input.assessmentFairness,
  ];
  if (!ratings.every(validRating)) {
    return {
      ok: false,
      error: "Lütfen dört başlığın tamamına 1 ile 5 arasında puan verin.",
    };
  }

  const helpful = input.helpful?.trim() ?? "";
  const improvement = input.improvement?.trim() ?? "";
  if (helpful.length > 1500 || improvement.length > 1500) {
    return {
      ok: false,
      error: "Yazılı yanıtlar 1500 karakterden uzun olamaz.",
    };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "submit_course_experience_feedback",
    {
      target_exam: input.examId,
      clarity: input.clarity,
      pace: input.pace,
      materials: input.materials,
      assessment_fairness: input.assessmentFairness,
      helpful: helpful || null,
      improvement: improvement || null,
    },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/ogrenci/sonuclar");
  revalidatePath(`/dashboard/ogrenci/sinav/${input.examId}`);
  revalidatePath("/dashboard/egitmen/geri-bildirimler");
  revalidatePath("/dashboard/yonetici/geri-bildirimler");
  return { ok: true, data: { id: data } };
}
