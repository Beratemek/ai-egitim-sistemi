import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookMarked, Users } from "lucide-react";

import { ClassroomExamReview } from "@/components/shared/classroom-exam-review";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { getClassroomExamDetail, UNASSIGNED_CLASSROOM } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sınav Değerlendirme" };

interface PageProps {
  params: Promise<{ classroom: string; examId: string }>;
}

/**
 * Bir sinifin bir sinavdaki tum cevaplari - tek ekranda.
 *
 * Kutucuk listesinden buraya girilir. Egitmen sinavi BUTUN olarak gorur:
 * kim teslim etmis, AI ne puan vermis, hangi cevap onay bekliyor.
 */
export default async function KontrolDetayPage({ params }: PageProps) {
  const { classroom: rawClassroom, examId } = await params;
  const classroom = decodeURIComponent(rawClassroom);

  const detail = await getClassroomExamDetail(classroom, examId);
  if (!detail) notFound();

  return (
    <>
      <Link
        href="/dashboard/egitmen/kontrol"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 gap-1.5 text-muted-foreground",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Sınav kontrolü
      </Link>

      <PageHeader
        title={detail.exam.title}
        description={
          detail.exam.description ||
          "Sınıfın cevaplarını bütün olarak değerlendirin."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {detail.exam.subject ? (
              <Badge variant="soft" className="gap-1.5 text-sm">
                <BookMarked className="h-3.5 w-3.5" />
                {detail.exam.subject}
              </Badge>
            ) : null}
            <Badge variant="soft" className="gap-1.5 text-sm">
              <Users className="h-3.5 w-3.5" />
              {classroom}
            </Badge>
          </div>
        }
      />

      {classroom === UNASSIGNED_CLASSROOM ? (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
          Bu öğrencilere henüz sınıf atanmamış. Sistem yöneticisi sınıf
          atadığında kendi sınıf kutularına taşınırlar.
        </p>
      ) : null}

      <ClassroomExamReview detail={detail} canPersist={isSupabaseConfigured} />
    </>
  );
}
