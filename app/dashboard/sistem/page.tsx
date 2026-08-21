import type { Metadata } from "next";
import { GraduationCap, ShieldCheck, UserCog, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { RoleRequestList } from "@/components/shared/role-request-list";
import { StatCard } from "@/components/shared/stat-card";
import { UserAdminTable } from "@/components/shared/user-admin-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getClassrooms, getRoleRequests, getUsers } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Sistem Yönetimi" };

/**
 * Sistem yöneticisi paneli.
 *
 * Rol dağıtmak ve öğrencileri sınıflara yerleştirmek bir SİSTEM işidir;
 * eğitim yöneticisi sınav ve başarı istatistiklerinden sorumludur. Bu yüzden
 * rol onayları bu ekrana taşındı.
 */
export default async function SistemPage() {
  const [users, roleRequests, classrooms, current] = await Promise.all([
    getUsers(),
    getRoleRequests(),
    getClassrooms(),
    getCurrentUser(),
  ]);

  const students = users.filter((user) => user.role === "ogrenci");
  const withoutClassroom = students.filter((user) => !user.classroom).length;

  return (
    <>
      <PageHeader
        title="Sistem Yönetimi"
        description="Rol taleplerini karara bağlayın, kullanıcıların rolünü belirleyin ve öğrencileri sınıflara yerleştirin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kullanıcı" value={users.length} icon={Users} accent="primary" />
        <StatCard
          label="Rol onayı bekleyen"
          value={roleRequests.length}
          hint="Yeni kullanıcı talebi"
          icon={UserCog}
          accent={roleRequests.length > 0 ? "warning" : undefined}
        />
        <StatCard label="Sınıf" value={classrooms.length} icon={GraduationCap} />
        <StatCard
          label="Sınıfsız öğrenci"
          value={withoutClassroom}
          hint="Sınava atanamaz"
          icon={ShieldCheck}
          accent={withoutClassroom > 0 ? "warning" : "success"}
        />
      </div>

      {/* ---------- Rol onayları ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-4.5 w-4.5 text-primary" />
            Rol onayları
          </CardTitle>
          <CardDescription>
            Öğrenci dışında bir rol talep eden kullanıcılar onayınızı bekler.
            Onaylanana kadar yalnızca öğrenci yetkisiyle dolaşabilirler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleRequestList requests={roleRequests} />
        </CardContent>
      </Card>

      {/* ---------- Kullanıcılar ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-primary" />
            Kullanıcılar ve sınıflar
          </CardTitle>
          <CardDescription>
            Rolü talep beklemeden değiştirebilirsiniz. Sınıf yalnızca
            öğrencilere atanır; eğitmen sınavı bu sınıflara atar.
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
          <UserAdminTable users={users} currentUserId={current?.user.id ?? ""} />
        </CardContent>
      </Card>
    </>
  );
}
