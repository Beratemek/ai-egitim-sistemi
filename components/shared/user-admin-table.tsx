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
import { RoleBadge, RoleCountBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserDeleteButton } from "@/components/shared/user-delete-button";
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
import { grantedRoles, ROLE_DEFINITIONS, ROLE_LIST } from "@/lib/roles";
import { ALL_SUBJECTS, hasAllSubjects, subjectLabel } from "@/lib/subjects";
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
 * Ozette RENK yalnizca VARSAYILAN role ayrildi; geri kalan roller notr bir
 * sayacla ("+3") gosteriliyor. Boylece tabloda goz bir yere odaklaniyor.
 *
 * Varsayilan rol = `roles[0]`, yani kisiye ATANAN ILK rol. Aktif rol degil:
 * aktif rol kullanicinin o an hangi panelde oldugunu soyler ve rol
 * degistiriciyle degisir, yonetim tablosunda dalgali bir deger olurdu.
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
  /**
   * Silme sunulsun mu?
   *
   * Yalnizca sistem yoneticisi silebilir. Bu bayrak sunucudan gelir; dugmeyi
   * gizlemek bir GUVENLIK onlemi degil, arayuzu dogru tutmak icin - yetki
   * kontrolu her halukarda `deleteUser` aksiyonunun icinde yapilir.
   */
  canDelete?: boolean;
}

export function UserAdminTable({
  users,
  currentUserId,
  subjectOptions = [],
  subjectsByUser = {},
  canDelete = false,
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

      // Varsayilani ayrica soyluyoruz: kullanici girişte o panelde acilacak,
      // duz bir rol listesi bunu gostermiyordu.
      const [ilk, ...digerleri] = result.data.roles;
      toast.success("Roller güncellendi", {
        description: [
          user.full_name || user.email,
          ": ",
          ilk ? `${ROLE_DEFINITIONS[ilk].label} (varsayılan)` : "",
          digerleri.length > 0
            ? `, ${digerleri.map((item) => ROLE_DEFINITIONS[item].label).join(", ")}`
            : "",
        ].join(""),
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

    let next: string[];
    if (current.includes(subject)) {
      next = current.filter((item) => item !== subject);
    } else if (subject === ALL_SUBJECTS) {
      // "Tum dersler" secilince tek tek dersler anlamsiz kalir; ikisini
      // birlikte tutmak "hem hepsi hem bazilari" gibi tutarsiz olurdu.
      next = [ALL_SUBJECTS];
    } else {
      // Tek bir ders secilince joker dusurulur - kapsam daraltiliyor demektir.
      next = [...current.filter((item) => item !== ALL_SUBJECTS), subject];
    }

    setPendingId(user.id);
    setSubjectDraft((draft) => ({ ...draft, [user.id]: next }));

    try {
      const result = await setInstructorSubjects(user.id, next);
      if (!result.ok) throw new Error(result.error);

      setSubjectDraft((draft) => ({ ...draft, [user.id]: result.data.subjects }));

      toast.success(
        result.data.subjects.length === 0
          ? "Ders yetkisi kaldırıldı"
          : `Ders yetkisi: ${result.data.subjects.map(subjectLabel).join(", ")}`,
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
              {/*
                Sinif ve Alan AYRI kolonlar.

                Ikisi tek bir "Atamalar" kolonunda birlikteyken satirdan satira
                farkli anlamda rozetler yan yana geliyordu: ogrencide derslik,
                egitmende ders. Goz kolonu asagi tarayinca "Derslik-3" ile "Tum
                dersler" ayni sutunda alt alta dusuyor ve kolon hicbir sey
                anlatmiyordu. Ayirinca her kolon tek bir soruyu yanitliyor;
                ilgisiz hucre "—" ile bos birakiliyor.
              */}
              <TableHead className="w-[150px]">Sınıf</TableHead>
              <TableHead className="min-w-[170px]">Alan</TableHead>
              <TableHead className="w-[170px] text-right">Düzenle</TableHead>
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
              /* Varsayilan rol: kumenin ilk elemani. Taslak bir sekilde bos
                 kalirsa (toggleRole buna izin vermez) aktif role duselim. */
              const varsayilan = roles[0] ?? user.role;

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
                    {/*
                      Gosterilen rol VARSAYILAN rol (roles[0]), aktif rol degil.

                      Aktif rol kullanicinin o an hangi panelde oldugunu soyler
                      ve rol degistiriciyle degisir - yonetim tablosunda dalgali
                      bir deger. Yoneticinin gormek istedigi, kisinin ATANMIS
                      kimligi: girişte hangi panelde acilacagi.
                    */}
                    <TableCell className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <RoleBadge role={varsayilan} />
                        {roles.length > 1 ? (
                          <RoleCountBadge
                            count={roles.length - 1}
                            title={`Diğer roller: ${roles
                              .slice(1)
                              .map((role) => ROLE_DEFINITIONS[role].label)
                              .join(", ")}`}
                          />
                        ) : null}
                        {user.role_status === "beklemede" ? (
                          <Badge variant="warning" className="font-normal">
                            talep
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* ---------- Sinif (yalnizca ogrenci) ---------- */}
                    <TableCell className="py-2.5">
                      <ClassroomCell
                        classroom={user.classroom}
                        isStudent={isStudent}
                      />
                    </TableCell>

                    {/* ---------- Alan (yalnizca egitmen) ---------- */}
                    <TableCell className="py-2.5">
                      <SubjectCell
                        subjects={subjects}
                        isInstructor={isInstructor}
                      />
                    </TableCell>

                    {/* ---------- Duzenle ---------- */}
                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
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

                      {/*
                        Kendi satirinda silme sunulmaz: aksiyon zaten
                        reddediyor, ama tiklanabilir bir dugme gostermek
                        yapilabilir bir sey vaat etmek olurdu.
                      */}
                      {canDelete && !isSelf ? (
                        <UserDeleteButton
                          userId={user.id}
                          displayName={
                            user.full_name?.trim() || user.email || "Bu kullanıcı"
                          }
                        />
                      ) : null}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* ---------- Duzenleme paneli ---------- */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-0">
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
                                  badge={
                                    varsayilan === definition.role ? (
                                      <Badge
                                        variant="soft"
                                        className="shrink-0 font-normal"
                                      >
                                        varsayılan
                                      </Badge>
                                    ) : null
                                  }
                                  onToggle={() =>
                                    void toggleRole(user, definition.role)
                                  }
                                />
                              ))}
                            </div>

                            {/*
                              Sira gorunmez bir kural olmasin: isaretleme
                              sirasinin varsayilani belirledigini kullaniciya
                              burada soyluyoruz, yoksa "neden hep bu rol
                              yaziyor" sorusu geri geliyor.
                            */}
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              İlk işaretlediğiniz rol{" "}
                              <strong className="font-medium text-foreground">
                                varsayılan
                              </strong>{" "}
                              olur; kullanıcı girişte o panelde açılır.
                              Varsayılanı değiştirmek için önce mevcut
                              varsayılanın işaretini kaldırın, sonra istediğiniz
                              rolü işaretleyin.
                            </p>

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
                              <>
                                <OptionRow
                                  id={`ders-${user.id}-tumu`}
                                  label="Tüm dersler"
                                  hint="Sonradan eklenen dersler de kapsanır"
                                  checked={hasAllSubjects(subjects)}
                                  disabled={busy}
                                  onToggle={() =>
                                    void toggleSubject(user, ALL_SUBJECTS)
                                  }
                                />
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  Soru havuzunda henüz ders yok. İçerik uzmanı
                                  ders adı belirterek soru ürettiğinde tek tek
                                  seçilebilir hale gelir.
                                </p>
                              </>
                            ) : (
                              <>
                                <OptionRow
                                  id={`ders-${user.id}-tumu`}
                                  label="Tüm dersler"
                                  hint="Sonradan eklenen dersler de kapsanır"
                                  checked={hasAllSubjects(subjects)}
                                  disabled={busy}
                                  onToggle={() =>
                                    void toggleSubject(user, ALL_SUBJECTS)
                                  }
                                />

                                <div
                                  className={cn(
                                    "max-h-52 space-y-1 overflow-y-auto border-t pt-2 pr-1",
                                    // Joker secilinken tek tek dersler zaten
                                    // kapsam disi degil - ama secilmeleri de
                                    // bir sey degistirmez; soluk gosterip
                                    // karisikligi onluyoruz.
                                    hasAllSubjects(subjects) && "opacity-50",
                                  )}
                                >
                                  {subjectOptions.map((subject) => (
                                    <OptionRow
                                      key={subject}
                                      id={`ders-${user.id}-${subject}`}
                                      label={subject}
                                      checked={
                                        hasAllSubjects(subjects) ||
                                        subjects.includes(subject)
                                      }
                                      disabled={busy}
                                      onToggle={() =>
                                        void toggleSubject(user, subject)
                                      }
                                    />
                                  ))}
                                </div>

                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {hasAllSubjects(subjects)
                                    ? "Eğitmen her dersteki sınavı görür. Tek bir ders seçerseniz kapsam ona daralır."
                                    : "Eğitmen yalnızca bu derslerdeki sınavları ve öğrenci cevaplarını görür."}
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
                  colSpan={5}
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
  badge,
  onToggle,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  /** Etiketin sagina konan isaret (or. "varsayilan"). */
  badge?: React.ReactNode;
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
        <span className="flex items-center gap-1.5">
          <span className="text-sm">{label}</span>
          {badge}
        </span>
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
 * Bos hucre isareti.
 *
 * Ogrencinin alani, egitmenin sinifi yok. Hucreyi tumuyle bos birakmak
 * "veri girilmemis" gibi okunurdu; "—" bunun BEKLENEN bir bosluk oldugunu
 * soyluyor.
 */
function Bos() {
  return <span className="text-sm text-muted-foreground">—</span>;
}

/**
 * Sinif hucresi. Yalnizca OGRENCI icin doludur.
 *
 * Sinifsiz ogrenci sinava atanamaz, o yuzden uyari rengiyle isaretlenir -
 * yoneticinin tabloyu tararken gormesi gereken tek eksik bu.
 */
function ClassroomCell({
  classroom,
  isStudent,
}: {
  classroom: string | null;
  isStudent: boolean;
}) {
  if (!isStudent) return <Bos />;

  // Kolon basligi zaten "Sinif" diyor; hucrede kavrami tekrar etmiyoruz.
  if (!classroom) {
    return <span className="text-xs font-medium text-warning">atanmadı</span>;
  }

  return (
    <Badge variant="soft" className="gap-1 font-normal">
      <GraduationCap className="h-3 w-3" />
      {classroom}
    </Badge>
  );
}

/**
 * Alan (ders yetkisi) hucresi. Yalnizca EGITMEN icin doludur.
 *
 * Ilk iki alan gosterilir, gerisi sayaca duser - satir yuksekligi
 * kullanicidan kullaniciya degismesin diye.
 */
function SubjectCell({
  subjects,
  isInstructor,
}: {
  subjects: readonly string[];
  isInstructor: boolean;
}) {
  if (!isInstructor) return <Bos />;

  if (subjects.length === 0) {
    return <span className="text-xs font-medium text-warning">atanmadı</span>;
  }

  // Joker tek rozet: yaninda ayrica ders adi listelemek yaniltir.
  // Etiket `subjectLabel`'dan geliyor ki uygulamanin geri kalaniyla ayni
  // kelimeyi kullansin - burada elle "Tum alanlar" yazmak iki ayri terim
  // uretirdi (duzenleme panelinde hala "Tum dersler" yaziyor).
  if (hasAllSubjects(subjects)) {
    return (
      <Badge variant="soft" className="gap-1 font-normal">
        <BookMarked className="h-3 w-3" />
        {subjectLabel(ALL_SUBJECTS)}
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {subjects.slice(0, 2).map((subject) => (
        <Badge key={subject} variant="soft" className="gap-1 font-normal">
          <BookMarked className="h-3 w-3" />
          {subject}
        </Badge>
      ))}
      {subjects.length > 2 ? (
        <span
          className="text-xs font-medium text-muted-foreground"
          title={subjects.join(", ")}
        >
          +{subjects.length - 2}
        </span>
      ) : null}
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

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
}
