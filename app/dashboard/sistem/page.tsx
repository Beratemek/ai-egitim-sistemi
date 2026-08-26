import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, UserCog } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { RoleRequestList } from "@/components/shared/role-request-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRoleRequests } from "@/lib/queries";

export const metadata: Metadata = { title: "Rol Onayları" };

/**
 * Sistem yoneticisi - ROL ONAYLARI.
 *
 * Bu ekran tek bir isi yapar: bekleyen talepleri karara baglamak. Kullanici
 * duzenleme (rol kumesi, sinif, ders yetkisi) ayri bir sayfada - ikisi ayni
 * sayfadayken onay kuyrugu devasa kullanici tablosunun ustunde eziliyor,
 * "bugun karara baglanacak is" ile "ara sira yapilan duzenleme" ayni gorsel
 * agirligi tasiyordu.
 */
export default async function SistemPage() {
  const roleRequests = await getRoleRequests();

  return (
    <>
      <PageHeader
        title="Rol Onayları"
        description="Yeni kullanıcıların rol taleplerini karara bağlayın. Onaylanan rol, kişinin varsayılan rolü olur ve ilk girişte o panelde açılır."
        actions={
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/dashboard/sistem/kullanicilar">
              Kullanıcılar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-4.5 w-4.5 text-primary" />
            Bekleyen talepler
            {roleRequests.length > 0 ? (
              <Badge variant="warning" className="font-semibold">
                {roleRequests.length}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Kayıt olan her kullanıcı onayınızı bekler. Onaylanana kadar
            panellere giremez; reddedilen kullanıcı yeni bir talep açabilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleRequestList requests={roleRequests} />
        </CardContent>
      </Card>
    </>
  );
}
