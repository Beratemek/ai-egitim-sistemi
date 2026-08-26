import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { dashboardPathFor } from "@/lib/roles";
import { getCurrentRole } from "@/lib/supabase-server";

/**
 * /dashboard bir dagitim noktasidir: kullaniciyi rolune ait panele yollar.
 * (Middleware de ayni yonlendirmeyi yapar; bu sayfa doğrudan erisim için var.)
 */
export default async function DashboardIndexPage() {
  if (!isSupabaseConfigured) redirect("/login");

  const role = await getCurrentRole();
  if (!role) redirect("/login");

  redirect(dashboardPathFor(role));
}
