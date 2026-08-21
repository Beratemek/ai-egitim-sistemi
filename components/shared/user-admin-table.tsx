"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Check,
  ChevronDown,
  GraduationCap,
  Loader2,
  Search,
  ShieldAlert,
  SlidersHorizontal,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * Tasarim: satirlar TEK SATIR yuksekliginde ve yalnizca OZET tasir; duzenleme
 * satirin altinda acilan panelde yapilir. Onceki surumde her satirda bes
 * renkli rol rozeti, ayrica "5 rol secili" yazan bir menu ve altina yigilan
 * ders rozetleri vardi - ayni bilgi iki kez, satir yuksekligi kullanicidan
 * kullaniciya degisiyordu. Coklu rol ve coklu ders geldikten sonra bu duzen
 * tasinamaz hale geldi.
 *
 * Ozette RENK yalnizca ETKIN role ayrildi; geri kalan roller notr bir sayacla
 * ("+3") gosteriliyor. Boylece tabloda goz bir yere odaklaniyor.
 *
 * Yetki kontrolu veritabanindaki SECURITY DEFINER fonksiyonlarindadir; bu
 * ekran yalnizca arayuz. Yonetici KENDI rolunu degistiremez - aksi halde
 * sistemde hic yonetici kalmayabilirdi.
 */

export interface UserAdminTableProps {
  users: readonly UserProfile[];
  /** Oturumdaki yoneticinin kimligi; kendi rol satiri kilitlenir. */
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
  const [openId, setOpenId] = React.useState<string | null>(null);

  /**
   * Sunucudan gelen veriyi bekleyen yerel degisiklikler.
   *
   * Bir secim kaydedildikten sonra `router.refresh()` tamamlanana kadar
   * prop'lar ESKI degeri tasir. Bir sonraki tik o eski degerden hesaplasaydi
   * bir onceki secimi geri alirdi (iki dersi pes pese isaretlemek imkansiz
   * olurdu). Bu yuzden okuma once taslaga bakar.
   *
   * Taze prop geldiginde taslak sifirlanir: `users` her sunucu render'inda
   * yeni bir dizi oldugu icin effect o an tetiklenir.
   */
  const [roleDraft, setRoleDraft] = React.useState<Record<string, UserRole[]>>({});
  const [subjectDraft, setSubjectDraft] = React.useState<Record<string, string[]>>(
    {},
  );

  React.useEffect(() => {
    setRoleDraft({});
  }, [users]);

  React.useEffect(() => {
    setSubjectDraft({});
  }, [subjectsByUser]);

  const rolesOf = React.useCallback(
    (user: UserProfile): UserRole[] => roleDraft[user.id] ?? grantedRoles(user),
    [roleDraft],
  );

  const subjectsOf = React.useCallback(
    (user: UserProfile): string[] =>
      subjectDraft[user.id] ?? subjectsByUser[user.id] ?? [],
    [subjectDraft, subjectsByUser],
  );

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
    const current = rolesOf(user);
    const next = current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role];

    if (next.length === 0) {
      toast.error("En az bir rol kalmalı", {
        description: "Kullanıcının tüm rollerini kaldıramazsınız.",
      });
      return;
    }

    setPendingId(user.id);
    setRoleDraft((draft) => ({ ...draft, [user.id]: next }));

    try {
      const result = await setUserRoles(user.id, next);
      if (!result.ok) throw new Error(result.error);

      setRoleDraft((draft) => ({ ...draft, [user.id]: result.data.roles }));

      toast.success("Roller güncellendi", {
        description: `${user.full_name || user.email}: ${result.data.roles
          .map((item) => ROLE_DEFINITIONS[item].label)
          .join(", ")}`,
      });
      router.refresh();
    } catch (caught) {
      // Basarisiz yazma taslakta kalmamali; ekran sunucu gercegine donsun.
      setRoleDraft((draft) => {
        const next = { ...draft };
        delete next[user.id];
        return next;
      });
      toast.error("Roller değiştirilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function toggleSubject(user: UserProfile, subject: string) {
    const current = subjectsOf(user);
    const next = current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject];

    setPendingId(user.id);
    setSubjectDraft((draft) => ({ ...draft, [user.id]: next }));

    try {
      const result = await setInstructorSubjects(user.id, next);
      if (!result.ok) throw new Error(result.error);

      setSubjectDraft((draft) => ({ ...draft, [user.id]: result.data.subjects }));

      toast.success(
        result.data.subjects.length === 0
          ? "Ders yetkisi kaldırıldı"
          : `Ders yetkisi: ${result.data.subjects.join(", ")}`,
        { description: user.full_name || user.email || undefined },
      );
      router.refresh();
    } catch (caught) {
      setSubjectDraft((draft) => {
        const next = { ...draft };
        delete next[user.id];
        return next;
      });
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
              <TableHead className="min-w-[220px]">Kullanıcı</TableHead>
              <TableHead className="w-[180px]">Rol</TableHead>
              <TableHead className="min-w-[200px]">Atamalar</TableHead>
              <TableHead className="w-[130px] text-right">Düzenle</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visible.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = pendingId === user.id;
              const open = openId === user.id;

              const roles = rolesOf(user);
              const subjects = subjectsOf(user);
              const isStudent = roles.includes("ogrenci");
              const isInstructor = roles.includes("egitmen");

              return (
                <React.Fragment key={user.id}>
                  <TableRow
                    className={cn(
                      "border-b-0",
                      isSelf && "bg-muted/40",
                      open && "bg-accent/30",
                    )}
                  >
                    {/* ---------- Kullanici ---------- */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {initials(user.full_name || user.email || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {user.full_name || "İsimsiz"}
                            {isSelf ? (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (siz)
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs leading-tight text-muted-foreground">
                            {user.email ?? "-"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* ---------- Rol ozeti ---------- */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <RoleBadge role={user.role} />
                        {roles.length > 1 ? (
                          <span
                            className="text-xs font-medium text-muted-foreground"
                            title={roles
                              .map((role) => ROLE_DEFINITIONS[role].label)
                              .join(", ")}
                          >
                            +{roles.length - 1}
                          </span>
                        ) : null}
                        {user.role_status === "beklemede" ? (
                          <Badge variant="warning" className="font-normal">
                            talep
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* ---------- Atama ozeti ---------- */}
                    <TableCell className="py-2.5">
                      <AssignmentSummary
                        classroom={user.classroom}
                        subjects={subjects}
                        isStudent={isStudent}
                        isInstructor={isInstructor}
                      />
                    </TableCell>

                    {/* ---------- Duzenle ---------- */}
                    <TableCell className="py-2.5 text-right">
                      <Button
                        variant={open ? "secondary" : "ghost"}
                        size="sm"
                        className="gap-1.5"
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : user.id)}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        )}
                        Düzenle
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* ---------- Duzenleme paneli ---------- */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      {open ? (
                        <div className="grid gap-6 border-t bg-muted/30 p-4 md:grid-cols-3">
                          {/* Roller */}
                          <section className="space-y-2.5">
                            <SectionTitle icon={ShieldAlert} label="Roller" />

                            <div className="space-y-1">
                              {ROLE_LIST.map((definition) => (
                                <OptionRow
                                  key={definition.role}
                                  id={`rol-${user.id}-${definition.role}`}
                                  label={definition.label}
                                  hint={definition.description}
                                  checked={roles.includes(definition.role)}
                                  disabled={busy}
                                  onToggle={() =>
                                    void toggleRole(user, definition.role)
                                  }
                                />
                              ))}
                            </div>

                            {isSelf ? (
                              <p className="rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                Kendi satırınız. Sistemdeki tek yönetici sizseniz
                                yönetici rolünüzü bırakamazsınız — rol atayabilecek
                                kimse kalmazdı.
                              </p>
                            ) : null}
                          </section>

                          {/* Sinif */}
                          <section className="space-y-2.5">
                            <SectionTitle icon={GraduationCap} label="Sınıf" />

                            {isStudent ? (
                              <ClassroomField
                                value={user.classroom ?? ""}
                                disabled={busy}
                                onSave={(value) =>
                                  void changeClassroom(user, value)
                                }
                              />
                            ) : (
                              <p className="rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                Sınıf yalnızca öğrenci rolü olan kullanıcılara
                                atanır.
                              </p>
                            )}
                          </section>

                          {/* Ders yetkisi */}
                          <section className="space-y-2.5">
                            <SectionTitle icon={BookMarked} label="Ders yetkisi" />

                            {!isInstructor ? (
                              <p className="rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                Ders yetkisi yalnızca eğitmen rolü olan
                                kullanıcılara atanır.
                              </p>
                            ) : subjectOptions.length === 0 ? (
                              <p className="rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                Soru havuzunda ders yok. İçerik uzmanı ders adı
                                belirterek soru ürettiğinde burada listelenir.
                              </p>
                            ) : (
                              <>
                                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                  {subjectOptions.map((subject) => (
                                    <OptionRow
                                      key={subject}
                                      id={`ders-${user.id}-${subject}`}
                                      label={subject}
                                      checked={subjects.includes(subject)}
                                      disabled={busy}
                                      onToggle={() =>
                                        void toggleSubject(user, subject)
                                      }
                                    />
                                  ))}
                                </div>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  Eğitmen yalnızca bu derslerdeki sınavları ve
                                  öğrenci cevaplarını görür.
                                </p>
                              </>
                            )}
                          </section>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}

            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
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

/* -------------------------------------------------------------------------- */

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
  );
}

/**
 * Isaretlenebilir tek satir.
 *
 * Dropdown yerine acik liste: yonetici hangi rollerin/derslerin var oldugunu
 * menuyu acmadan gorur ve pes pese secim yaparken menu kapanmasiyla ugrasmaz.
 */
function OptionRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors",
        !disabled && "hover:bg-accent/60",
        checked && "bg-primary/5",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="min-w-0 cursor-pointer font-normal leading-tight">
        <span className="block text-sm">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </Label>
    </div>
  );
}

/**
 * Satirdaki atama ozeti.
 *
 * Iki farkli atama turu (sinif ve ders) tek sutunda toplandi; ayri sutunlar
 * cogu satirda bos kalip tabloyu genisletiyordu. Ilk iki ders gosterilir,
 * gerisi sayaca duser - satir yuksekligi sabit kalsin diye.
 */
function AssignmentSummary({
  classroom,
  subjects,
  isStudent,
  isInstructor,
}: {
  classroom: string | null;
  subjects: readonly string[];
  isStudent: boolean;
  isInstructor: boolean;
}) {
  const chips: React.ReactNode[] = [];

  if (isStudent) {
    chips.push(
      classroom ? (
        <Badge key="sinif" variant="soft" className="gap-1 font-normal">
          <GraduationCap className="h-3 w-3" />
          {classroom}
        </Badge>
      ) : (
        <span
          key="sinif-yok"
          className="text-xs text-amber-600 dark:text-amber-500"
        >
          sınıf atanmadı
        </span>
      ),
    );
  }

  if (isInstructor) {
    if (subjects.length === 0) {
      chips.push(
        <span
          key="ders-yok"
          className="text-xs text-amber-600 dark:text-amber-500"
        >
          ders atanmadı
        </span>,
      );
    } else {
      for (const subject of subjects.slice(0, 2)) {
        chips.push(
          <Badge key={subject} variant="soft" className="gap-1 font-normal">
            <BookMarked className="h-3 w-3" />
            {subject}
          </Badge>,
        );
      }
      if (subjects.length > 2) {
        chips.push(
          <span
            key="ders-fazla"
            className="text-xs font-medium text-muted-foreground"
            title={subjects.join(", ")}
          >
            +{subjects.length - 2}
          </span>,
        );
      }
    }
  }

  if (chips.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return <div className="flex flex-wrap items-center gap-1.5">{chips}</div>;
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
    <div className="space-y-2">
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
      <p className="text-xs leading-relaxed text-muted-foreground">
        Eğitmen sınavları bu sınıflara atar. Boş bırakıp kaydederseniz sınıf
        kaldırılır.
      </p>
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
