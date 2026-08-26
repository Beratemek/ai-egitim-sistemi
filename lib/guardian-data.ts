import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  GuardianStudentExamRow,
  GuardianStudentOutcomeRow,
  GuardianStudentSummary,
} from "@/lib/types";

export interface GuardianStudentDetailData {
  student: GuardianStudentSummary;
  exams: GuardianStudentExamRow[];
  outcomes: GuardianStudentOutcomeRow[];
}

/**
 * Veli panelinin tek veri kaynağı güvenli RPC'dir. Ham users, submissions,
 * questions veya learning_outcomes tablolarına buradan sorgu yapılmaz.
 */
export const getGuardianStudents = cache(
  async function getGuardianStudents(): Promise<GuardianStudentSummary[]> {
    if (!isSupabaseConfigured) return [];

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_guardian_students", {});

    if (error) {
      throw new Error(`Veli öğrenci özeti alınamadı: ${error.message}`);
    }

    return data ?? [];
  },
);

/**
 * Önce oturum sahibinin görebildiği öğrenci listesinden sahipliği doğrular.
 * Eşleşme yoksa ayrıntı RPC'leri hiç çağrılmaz; sayfa bunu `notFound()` ile
 * kapatır. RPC'ler de aynı bağlantıyı veritabanında ikinci kez doğrular.
 */
export const getGuardianStudentDetail = cache(
  async function getGuardianStudentDetail(
    studentId: string,
  ): Promise<GuardianStudentDetailData | null> {
    const students = await getGuardianStudents();
    const student = students.find((row) => row.student_id === studentId);

    if (!student || !isSupabaseConfigured) return null;

    const supabase = await createServerSupabaseClient();
    const [examResult, outcomeResult] = await Promise.all([
      supabase.rpc("get_guardian_student_exams", {
        target_student: studentId,
      }),
      supabase.rpc("get_guardian_student_outcomes", {
        target_student: studentId,
      }),
    ]);

    if (examResult.error) {
      throw new Error(`Öğrencinin sınav özeti alınamadı: ${examResult.error.message}`);
    }
    if (outcomeResult.error) {
      throw new Error(
        `Öğrencinin kazanım özeti alınamadı: ${outcomeResult.error.message}`,
      );
    }

    return {
      student,
      exams: examResult.data ?? [],
      outcomes: outcomeResult.data ?? [],
    };
  },
);
