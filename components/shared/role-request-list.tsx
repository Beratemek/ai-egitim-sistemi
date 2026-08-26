"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { reviewRoleRequest } from "@/app/actions/admin";
import { RoleBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/roles";
import type { UserProfile } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/**
 * Sistem yöneticisinin rol onay kuyruğu.
 *
 * Karar veritabanındaki `review_role_request` fonksiyonuna gider; orada rol
 * yeniden dogrulanir, yani bu ekrani atlayip doğrudan istek atmak da ise
 * yaramaz.
 */

export interface RoleRequestListProps {
  requests: readonly UserProfile[];
}

export function RoleRequestList({ requests }: RoleRequestListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function review(user: UserProfile, approve: boolean) {
    setPendingId(user.id);

    try {
      const result = await reviewRoleRequest(user.id, approve);
      if (!result.ok) throw new Error(result.error);

      const wanted = user.requested_role ? roleLabel(user.requested_role) : "rol";

      toast.success(approve ? `${wanted} onaylandı` : "Talep reddedildi", {
        description: user.full_name || user.email || undefined,
      });

      router.refresh();
    } catch (caught) {
      toast.error("İşlem kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lutfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <ShieldCheck className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Bekleyen rol talebi yok</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Yeni kullanıcıların seçtiği roller burada onayınızı bekler.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((user) => {
        const busy = pendingId === user.id;
        const name = user.full_name || user.email || "Bilinmiyor";

        return (
          <div
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email ?? "-"} · {formatDateTime(user.updated_at)}
              </p>
            </div>

            {user.requested_role ? <RoleBadge role={user.requested_role} /> : null}

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void review(user, true)}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Onayla
              </Button>

              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void review(user, false)}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Reddet
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
}
