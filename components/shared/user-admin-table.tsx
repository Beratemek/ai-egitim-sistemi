"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  ChevronDown,
  Check,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  setInstructorSubjects,
  setUserClassroom,
  setUserRoles,
} from "@/app/actions/admin";
import { RoleBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_DEFINITIONS, ROLE_LIST } from "@/lib/roles";
import type { UserProfile, UserRole } from "@/lib/types";
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
  /** Secilebilir ders adlari; soru havuzundan turetilir. */
  subjectOptions?: readonly string[];
  /** Kullanici kimligi -> yetkili oldugu dersler. */
  subjectsByUser?: Record<string, string[]>;
}

export function UserAdminTable({
  users,
  currentUserId,
  subjectOptions = [],
  subjectsByUser = {},
}: UserAdminTableProps) {
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

  /** Bir rolu kumeye ekler ya da kumeden cikarir. */
  async function toggleRole(user: UserProfile, role: UserRole) {
    const mevcut = grantedRoles(user);
    const next = mevcut.includes(role)
      ? mevcut.filter((item) => item !== role)
      : [...mevcut, role];

    if (next.length === 0) {
      toast.error("En az bir rol kalmalı", {
        description: "Kullanıcının tüm rollerini kaldıramazsınız.",
      });
      return;
    }

    setPendingId(user.id);
    try {
      const result = await setUserRoles(user.id, next);
      if (!result.ok) throw new Error(result.error);

      toast.success("Roller güncellendi", {
        description: `${user.full_name || user.email}: ${result.data.roles
          .map((item) => ROLE_DEFINITIONS[item].label)
          .join(", ")}`,
      });
      router.refresh();
    } catch (caught) {
      toast.error("Roller değiştirilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function toggleSubject(user: UserProfile, subject: string) {
    const current = subjectsByUser[user.id] ?? [];
    const next = current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject];

    setPendingId(user.id);

    try {
      const result = await setInstructorSubjects(user.id, next);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.subjects.length === 0
          ? "Ders yetkisi kaldırıldı"
          : `Ders yetkisi: ${result.data.subjects.join(", ")}`,
      );
      router.refresh();
    } catch (caught) {
      toast.error("Ders yetkisi güncellenemedi", {
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
              <TableHead className="w-[210px]">Ders yetkisi</TableHead>
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
                      {grantedRoles(user).map((role) => (
                        <RoleBadge key={role} role={role} />
                      ))}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between gap-2 font-normal"
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className="truncate">
                                {grantedRoles(user).length} rol seçili
                              </span>
                            )}
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuLabel>
                            Roller (birden fazla seçilebilir)
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {ROLE_LIST.map((definition) => (
                            <DropdownMenuCheckboxItem
                              key={definition.role}
                              checked={grantedRoles(user).includes(definition.role)}
                              onSelect={(event) => {
                                // Menu her tikta kapanmasin; birden fazla rol
                                // secmek tek tek acip kapamayi gerektirmesin.
                                event.preventDefault();
                                void toggleRole(user, definition.role);
                              }}
                            >
                              {definition.label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>

                  <TableCell>
                    {grantedRoles(user).includes("ogrenci") ? (
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

                  <TableCell>
                    {!grantedRoles(user).includes("egitmen") ? (
                      <span className="text-xs text-muted-foreground">
                        Yalnızca eğitmenlere atanır
                      </span>
                    ) : subjectOptions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Havuzda ders yok
                      </span>
                    ) : (
                      <SubjectField
                        selected={subjectsByUser[user.id] ?? []}
                        options={subjectOptions}
                        disabled={busy}
                        onToggle={(subject) => void toggleSubject(user, subject)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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

/**
 * Kullaniciya verilmis roller.
 *
 * `roles` kolonu eklenmeden once olusmus kayitlarda kume bos olabilir; o
 * durumda aktif rol tek eleman olarak kabul edilir ki tablo bos gorunmesin.
 */
function grantedRoles(user: UserProfile): UserRole[] {
  return user.roles && user.roles.length > 0 ? user.roles : [user.role];
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
}

/**
 * Bir egitmenin ders yetkileri.
 *
 * Bir hocaya BIRDEN FAZLA ders atanabilir, bu yuzden tek secimli bir kutu
 * degil isaretlemeli liste. Secili dersler rozet olarak altta gorunur ki
 * yonetici menuyu acmadan kimin neye yetkili oldugunu gorebilsin.
 */
function SubjectField({
  selected,
  options,
  disabled,
  onToggle,
}: {
  selected: readonly string[];
  options: readonly string[];
  disabled: boolean;
  onToggle: (subject: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between gap-2 font-normal"
            disabled={disabled}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <BookMarked className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">
                {selected.length === 0
                  ? "Ders atanmadı"
                  : `${selected.length} ders`}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
          <DropdownMenuLabel>Ders yetkisi</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((subject) => (
            <DropdownMenuCheckboxItem
              key={subject}
              checked={selected.includes(subject)}
              onSelect={(event) => {
                // Menu her tikta kapanmasin; birden fazla ders secilebilmeli.
                event.preventDefault();
                onToggle(subject);
              }}
            >
              {subject}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((subject) => (
            <Badge key={subject} variant="soft" className="font-normal">
              {subject}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
