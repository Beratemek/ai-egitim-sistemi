import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/env";
import {
  MOCK_EXAMS,
  MOCK_OUTCOMES,
  MOCK_QUESTIONS,
  MOCK_SUBMISSIONS,
  MOCK_USERS,
} from "@/lib/mock-data";
import {
  buildManagerAnalytics,
  type ManagerAnalytics,
  type ManagerAnalyticsScope,
  type ManagerAnalyticsSource,
} from "@/lib/manager-analytics";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const getManagerAnalyticsSource = cache(
  async function getManagerAnalyticsSource(): Promise<ManagerAnalyticsSource> {
    if (!isSupabaseConfigured) {
      return {
        users: [...MOCK_USERS],
        exams: [...MOCK_EXAMS],
        assignments: [],
        attempts: [],
        submissions: [...MOCK_SUBMISSIONS],
        questions: [...MOCK_QUESTIONS],
        outcomes: [...MOCK_OUTCOMES],
        examQuestions: [],
      };
    }

    const supabase = await createServerSupabaseClient();
    const [users, exams, assignments, attempts, submissions, questions, outcomes, links] =
      await Promise.all([
        supabase.from("users").select("*").order("full_name"),
        supabase.from("exams").select("*").order("created_at", { ascending: false }),
        supabase.from("exam_assignments").select("*"),
        supabase.from("exam_attempts").select("*"),
        supabase.from("submissions").select("*"),
        supabase.from("questions").select("*"),
        supabase.from("learning_outcomes").select("*"),
        supabase.from("exam_questions").select("*"),
      ]);

    return {
      users: users.data ?? [],
      exams: exams.data ?? [],
      assignments: assignments.data ?? [],
      attempts: attempts.data ?? [],
      submissions: submissions.data ?? [],
      questions: questions.data ?? [],
      outcomes: outcomes.data ?? [],
      examQuestions: links.data ?? [],
    };
  },
);

export async function getManagerAnalytics(
  scope: ManagerAnalyticsScope = {},
): Promise<ManagerAnalytics> {
  return buildManagerAnalytics(await getManagerAnalyticsSource(), scope);
}
