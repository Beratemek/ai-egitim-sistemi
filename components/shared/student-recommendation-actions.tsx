"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookmarkCheck, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  addStudyPlanItem,
  getStudyPlan,
  STUDENT_STUDY_PLAN_CHANGED_EVENT,
} from "@/lib/student-study-plan";

export interface StudentRecommendationActionsProps {
  id: string;
  title: string;
  context: string;
  action: string;
  evidence: string;
  outcomeId: string | null;
  latestExamId: string | null;
}

export function StudentRecommendationActions({
  id,
  title,
  context,
  action,
  evidence,
  outcomeId,
  latestExamId,
}: StudentRecommendationActionsProps) {
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const syncSavedState = async () => {
      try {
        const existing = (await getStudyPlan()).find((item) => item.id === id);
        if (!active) return;
        setSaved(Boolean(existing));

        // Eski kayıt daha az alan taşıyorsa önerinin güncel açıklamasıyla
        // zenginleştir; öğrencinin durum bilgisi veritabanında korunur.
        if (
          existing &&
          (existing.title !== title ||
            existing.context !== context ||
            existing.action !== action ||
            existing.evidence !== evidence ||
            existing.outcomeId !== outcomeId ||
            existing.latestExamId !== latestExamId)
        ) {
          await addStudyPlanItem({
            id,
            title,
            context,
            action,
            evidence,
            outcomeId,
            latestExamId,
          });
        }
      } catch {
        // Plan tablosu henüz uygulanmadıysa gelişim sayfasının geri kalanı
        // çalışmaya devam eder; kaydetme denemesinde kullanıcıya hata gösterilir.
      }
    };

    const handleChange = () => void syncSavedState();
    void syncSavedState();
    window.addEventListener(STUDENT_STUDY_PLAN_CHANGED_EVENT, handleChange);
    return () => {
      active = false;
      window.removeEventListener(STUDENT_STUDY_PLAN_CHANGED_EVENT, handleChange);
    };
  }, [action, context, evidence, id, latestExamId, outcomeId, title]);

  async function saveToPlan() {
    setSaving(true);
    try {
      await addStudyPlanItem({
        id,
        title,
        context,
        action,
        evidence,
        outcomeId,
        latestExamId,
      });
      setSaved(true);
      toast.success("Çalışma hesabınıza kaydedildi.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Çalışma plana eklenemedi.",
      );
    } finally {
      setSaving(false);
    }
  }

  const reviewHref = latestExamId
    ? `/dashboard/ogrenci/sinav/${latestExamId}`
    : "/dashboard/ogrenci/sonuclar";

  return (
    <div className="grid gap-2 pt-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
      <Button asChild size="sm" className="justify-between">
        <Link href={reviewHref}>
          Geri bildirimi incele
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
      {saved ? (
        <Button asChild size="sm" variant="outline" className="justify-between">
          <Link href="/dashboard/ogrenci/calisma-plani">
            Planımda görüntüle
            <BookmarkCheck className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="justify-between"
          disabled={saving}
          onClick={() => void saveToPlan()}
        >
          {saving ? "Kaydediliyor…" : "Planıma ekle"}
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
