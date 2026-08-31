import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, GraduationCap, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { GuardianAssignmentPanel } from "@/components/shared/guardian-assignment-panel";
import { StatCard } from "@/components/shared/stat-card";
import { UserAdminTable } from "@/components/shared/user-admin-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getClassrooms,
  getInstructorSubjectMap,
  getRoleRequests,
  getSubjectOptions,
  getUsers,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";
import { grantedRoles } from "@/lib/roles";
import { getGuardianAdminData } from "@/lib/guardian-admin-data";

export const metadata: Metadata = { title: "Kullanıcılar" };

/**
 * Sistem yoneticisi - KULLANICI DUZENLEME.
 *
 * Rol kumesi, sinif ve ders yetkisi burada duzenlenir. Onay kuyrugu ayri
 * sayfada (`/dashboard/sistem`); bkz. oradaki not.
 */
export default async function KullanicilarPage() {
  const [
    users,
    roleRequests,
    classrooms,
    current,
    subjectOptions,
    subjectsByUser,
    guardianAdminData,
  ] =
    await Promise.all([
      getUsers(),
      getRoleRequests(),
      getClassrooms(),
      getCurrentUser(),
      getSubjectOptions(),
      getInstructorSubjectMap(),
      getGuardianAdminData(),
    ]);

  /*
    Ogrenci sayimi VERILMIS role bakar, aktif role degil.

    Onceden `user.role === "ogrenci"` yaziyordu; coklu rolde aktif rol yalnizca
    kisinin o an hangi panelde oldugunu soyler. Hem ogrenci hem egitmen olan
    biri egitmen panelindeyken sayimdan dusuyor, "sinifsiz ogrenci" rakami
    oldugundan kucuk gorunuyordu.
  */
  const students = users.filter((user) => grantedRoles(user).includes("ogrenci"));
  const withoutClassroom = students.filter((user) => !user.classroom).length;

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Rolü talep beklemeden değiştirin, öğrencileri sınıfa yerleştirin, eğitmenlere ders yetkisi verin."
        actions={
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/dashboard/sistem">
              <ArrowLeft className="h-4 w-4" />
              Rol onayları
              {roleRequests.length > 0 ? ` (${roleRequests.length})` : ""}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Kullanıcı" value={users.length} icon={Users} accent="primary" />
        <StatCard label="Sınıf" value={classrooms.length} icon={GraduationCap} />
        <StatCard
          label="Sınıfsız öğrenci"
          value={withoutClassroom}
          hint="Sınava atanamaz"
          icon={ShieldCheck}
          accent={withoutClassroom > 0 ? "warning" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-primary" />
            Kullanıcılar ve sınıflar
          </CardTitle>
          <CardDescription>
            Rol kutucuklarını işaretlediğiniz <strong>sıra</strong> önemlidir:
            ilk verdiğiniz rol kişinin varsayılan rolü olur ve girişte o panelde
            açılır. Sınıf yalnızca öğrencilere atanır; eğitmen sınavı bu
            sınıflara atar.
            {classrooms.length > 0 ? (
              <>
                {" "}
                Tanımlı sınıflar:{" "}
                <span className="font-medium text-foreground">
                  {classrooms.join(", ")}
                </span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAdminTable
            users={users}
            currentUserId={current?.user.id ?? ""}
            subjectOptions={subjectOptions}
            subjectsByUser={subjectsByUser}
            canDelete={
              current ? grantedRoles(current.profile).includes("admin") : false
            }
          />
        </CardContent>
      </Card>

      <GuardianAssignmentPanel
        users={users}
        links={guardianAdminData.links}
        loadError={guardianAdminData.loadError}
      />
    </>
  );
}
