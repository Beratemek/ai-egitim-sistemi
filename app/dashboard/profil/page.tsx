import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/shared/profile-form";
import { isSupabaseConfigured } from "@/lib/env";
import { getMySubjects } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";
import type { UserProfile, UserRole } from "@/lib/types";

export const metadata = {
  title: "Profilim",
};

/** Demo modunda gosterilen ornek profil. */
const DEMO_PROFILE = {
  id: "demo",
  role: "egitmen",
  roles: ["egitmen"],
  role_status: "onayli",
  requested_role: null,
  role_reviewed_by: null,
  role_reviewed_at: null,
  classroom: null,
  full_name: "Örnek Kullanıcı",
  email: "demo@t3.com",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} satisfies UserProfile;

export default async function ProfilePage() {
  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Profilim"
          description="Ad soyadınızı güncelleyin; e-posta, rol ve sınıf bilgisi yöneticiden gelir."
        />
        <ProfileForm profile={DEMO_PROFILE} roles={["egitmen"]} activeRole="egitmen" />
      </>
    );
  }

  const [current, subjects] = await Promise.all([getCurrentUser(), getMySubjects()]);
  if (!current) redirect("/login");

  // Profil satirinda e-posta bos kalabilir (eski kayitlar); kimlik
  // hesabindaki adres her zaman dogru kaynaktir.
  const profile: UserProfile = {
    ...current.profile,
    email: current.profile.email ?? current.user.email ?? null,
  };

  const roles: readonly UserRole[] =
    profile.roles && profile.roles.length > 0 ? profile.roles : [profile.role];

  /**
   * Profil ETKIN role gore cizilir.
   *
   * Coklu rolu olan kullanici egitmen panelindeyken egitmen profilini,
   * ogrenci panelindeyken sinifini iceren ogrenci profilini gormeli.
   * `profile.role` ust cubuktaki rol degistiricinin yazdigi etkin roldur -
   * basliktaki "... Paneli" ile ayni kaynak.
   */
  const activeRole: UserRole = profile.role;

  return (
    <>
      <PageHeader
        title="Profilim"
        description="Ad soyadınızı güncelleyin; e-posta, rol ve sınıf bilgisi yöneticiden gelir."
      />
      <div className="max-w-2xl">
        <ProfileForm
          profile={profile}
          roles={roles}
          activeRole={activeRole}
          subjects={subjects}
        />
      </div>
    </>
  );
}
