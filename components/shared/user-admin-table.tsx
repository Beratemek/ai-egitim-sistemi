"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { setUserClassroom, setUserRole } from "@/app/actions/admin";
import { RoleBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LIST } from "@/lib/roles";
import { isUserRole, type UserProfile, type UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Sistem yoneticisinin kullanici yonetimi.
 *
 * Rol dagitmak ve ogrenciyi bir sinifa yerlestirmek buradan yapilir. Her iki
 * islem de veritabanindaki SECURITY DEFINER fonksiyonlarina gider; yetki
 * kontrolu orada, bu ekran yalnizca arayuz.
 *
 * Yonetici KENDI rolunu degistiremez - aksi halde sistemde hic yonetici
 * kalmayabilirdi. Veritabani da bunu ayrica reddeder.
 */

export interface UserAdminTableProps {
  users: readonly UserProfile[];
  /** Oturumdaki yoneticinin kimligi; kendi satiri kilitlenir. */
  currentUserId: string;
}

export function UserAdminTable({ users, currentUserId }: UserAdminTableProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const visible = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    if (!needle) return users;

    return users.filter((user) =>
      [user.full_name, user.email, user.classroom]
        .filter(Boolean)
        .some((field) => (field as string).toLocaleLowerCase("tr").includes(needle)),
    );
  }, [users, search]);

  async function changeRole(user: UserProfile, role: UserRole) {
    if (role === user.role) return;

    setPendingId(user.id);
    try {
      const result = await setUserRole(user.id, role);
      if (!result.ok) throw new Error(result.error);

      toast.success("Rol güncellendi", {
        description: user.full_name || user.email || undefined,
      });
      router.refresh();
    } catch (caught) {
      toast.error("Rol değiştirilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function changeClassroom(user: UserProfile, classroom: string) {
    if ((user.classroom ?? "") === classroom.trim()) return;

    setPendingId(user.id);
    try {
      const result = await setUserClassroom(user.id, classroom);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.classroom
          ? `Sınıf atandı: ${result.data.classroom}`
          : "Sınıf kaldırıldı",
        { description: user.full_name || user.email || undefined },
      );
      router.refresh();
    } catch (caught) {
      toast.error("Sınıf atanamadı", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="İsim, e-posta veya sınıf ara..."
          aria-label="Kullanıcı ara"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Kullanıcı</TableHead>
              <TableHead>Mevcut rol</TableHead>
              <TableHead className="w-[190px]">Rolü değiştir</TableHead>
              <TableHead className="w-[200px]">Sınıf</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visible.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = pendingId === user.id;

              return (
                <TableRow key={user.id} className={cn(isSelf && "bg-muted/40")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initials(user.full_name || user.email || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.full_name || "İsimsiz"}
                          {isSelf ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (siz)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email ?? "-"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={user.role} />
                      {user.role_status === "beklemede" ? (
                        <Badge variant="warning" className="font-normal">
                          talep bekliyor
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    {isSelf ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Kendi rolünüzü değiştiremezsiniz
                      </span>
                    ) : (
                      <Select
                        value={user.role}
                        disabled={busy}
                        onValueChange={(value) => {
                          if (isUserRole(value)) void changeRole(user, value);
                        }}
                      >
                        <SelectTrigger aria-label="Rol seç">
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_LIST.map((definition) => (
                            <SelectItem key={definition.role} value={definition.role}>
                              {definition.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>

                  <TableCell>
                    {user.role === "ogrenci" ? (
                      <ClassroomField
                        value={user.classroom ?? ""}
                        disabled={busy}
                        onSave={(value) => void changeClassroom(user, value)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Yalnızca öğrencilere atanır
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Aramaya uyan kullanıcı bulunamadı.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} / {users.length} kullanıcı gösteriliyor
      </p>
    </div>
  );
}

/**
 * Sinif alani.
 *
 * Her tus vurusunda kaydetmek gereksiz istek uretirdi; kaydetme dugmesi
 * yalnizca deger degistiginde etkinlesir ve Enter da calisir.
 */
function ClassroomField({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const dirty = draft.trim() !== value;

  return (
    <div className="flex gap-1.5">
      <Input
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && dirty) onSave(draft);
        }}
        placeholder="Derslik-3"
        aria-label="Sınıf"
        className="h-9"
      />
      <Button
        size="icon"
        variant={dirty ? "default" : "ghost"}
        className="h-9 w-9 shrink-0"
        disabled={disabled || !dirty}
        onClick={() => onSave(draft)}
        aria-label="Sınıfı kaydet"
      >
        <Check className="h-4 w-4" />
      </Button>
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
