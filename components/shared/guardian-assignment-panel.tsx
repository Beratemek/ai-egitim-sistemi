"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Search,
  Unlink,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { setStudentGuardian } from "@/app/actions/admin";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grantedRoles } from "@/lib/roles";
import type { GuardianStudentLink, UserProfile } from "@/lib/types";

const NO_GUARDIAN = "__no_guardian__";
const PAGE_SIZE = 12;
type AssignmentFilter = "all" | "assigned" | "unassigned";

export interface GuardianAssignmentPanelProps {
  users: readonly UserProfile[];
  links: readonly GuardianStudentLink[];
  loadError?: string | null;
}

export function GuardianAssignmentPanel({
  users,
  links,
  loadError = null,
}: GuardianAssignmentPanelProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<AssignmentFilter>("all");
  const [page, setPage] = React.useState(1);
  const [pendingStudentId, setPendingStudentId] = React.useState<string | null>(
    null,
  );
  const [isRefreshing, startRefresh] = React.useTransition();

  const students = React.useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.role_status === "onayli" &&
            grantedRoles(user).includes("ogrenci"),
        )
        .sort(compareUsers),
    [users],
  );
  const guardians = React.useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.role_status === "onayli" && grantedRoles(user).includes("veli"),
        )
        .sort(compareUsers),
    [users],
  );

  const guardianById = React.useMemo(
    () => new Map(guardians.map((guardian) => [guardian.id, guardian])),
    [guardians],
  );
  const guardianIdByStudent = React.useMemo(
    () => new Map(links.map((link) => [link.student_id, link.guardian_id])),
    [links],
  );
  const studentCountByGuardian = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const guardianId of guardianIdByStudent.values()) {
      counts.set(guardianId, (counts.get(guardianId) ?? 0) + 1);
    }
    return counts;
  }, [guardianIdByStudent]);

  const assignedCount = students.reduce(
    (count, student) => count + Number(guardianIdByStudent.has(student.id)),
    0,
  );

  const visibleStudents = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");

    return students.filter((student) => {
      const guardianId = guardianIdByStudent.get(student.id);
      const guardian = guardianId ? guardianById.get(guardianId) : undefined;
      const isAssigned = Boolean(guardianId);
      if (filter === "assigned" && !isAssigned) return false;
      if (filter === "unassigned" && isAssigned) return false;
      if (!needle) return true;

      return [
        student.full_name,
        student.email,
        student.classroom,
        guardian?.full_name,
        guardian?.email,
      ]
        .filter(Boolean)
        .some((value) =>
          (value as string).toLocaleLowerCase("tr").includes(needle),
        );
    });
  }, [filter, guardianById, guardianIdByStudent, search, students]);
  const totalPages = Math.max(1, Math.ceil(visibleStudents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStudents = visibleStudents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  async function persistAssignment(
    student: UserProfile,
    guardianId: string | null,
  ): Promise<void> {
    if (loadError || pendingStudentId || isRefreshing) return;

    setPendingStudentId(student.id);
    try {
      const result = await setStudentGuardian(student.id, guardianId);
      if (!result.ok) throw new Error(result.error);

      const guardian = guardianId ? guardianById.get(guardianId) : undefined;
      toast.success(guardianId ? "Veli atandı" : "Veli bağlantısı kaldırıldı", {
        description: guardianId
          ? `${displayName(student)} → ${displayName(guardian)}`
          : displayName(student),
      });

      startRefresh(() => router.refresh());
    } catch (caught) {
      toast.error("Veli ataması güncellenemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingStudentId(null);
    }
  }

  const controlsDisabled =
    Boolean(loadError) || guardians.length === 0 || isRefreshing;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="h-4.5 w-4.5 text-primary" />
            Veli–öğrenci eşleştirmeleri
          </CardTitle>
          <CardDescription className="max-w-3xl">
            Her öğrenci en fazla bir veliye bağlanır; aynı veli birden fazla
            öğrenciyi takip edebilir. Yalnızca onaylı Veli ve Öğrenci rolüne
            sahip hesaplar listelenir.
          </CardDescription>
        </div>
        <Badge
          variant={
            students.length > 0 && assignedCount === students.length
              ? "success"
              : "soft"
          }
        >
          {assignedCount}/{students.length} öğrenci eşleşti
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {loadError ? (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Bağlantılar yüklenemedi</p>
              <p className="mt-0.5 text-muted-foreground">{loadError}</p>
            </div>
          </div>
        ) : null}

        {guardians.length === 0 ? (
          <div className="flex gap-3 rounded-xl border border-dashed bg-muted/25 p-4 text-sm">
            <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Henüz atanabilir bir veli hesabı yok</p>
              <p className="mt-1 text-muted-foreground">
                Önce yukarıdaki kullanıcı tablosundan ilgili hesaba Veli rolü
                verin. Rol onaylı hale geldiğinde hesap burada seçilebilir.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Öğrenci, sınıf veya veli ara..."
              aria-label="Veli eşleştirmelerinde ara"
              className="pl-9"
            />
          </div>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as AssignmentFilter);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Atama durumuna göre filtrele">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm öğrenciler ({students.length})</SelectItem>
              <SelectItem value="assigned">Atanmış ({assignedCount})</SelectItem>
              <SelectItem value="unassigned">
                Atanmamış ({students.length - assignedCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Onaylı öğrenci hesabı bulunamadı"
            description="Öğrenci rolü verilen hesaplar burada otomatik olarak görünür."
          />
        ) : visibleStudents.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Eşleşen öğrenci bulunamadı"
            description="Arama ifadenizi veya atama filtresini değiştirmeyi deneyin."
          />
        ) : (
          <>
            <div className="grid gap-3 xl:grid-cols-2">
              {pageStudents.map((student) => {
                const guardianId = guardianIdByStudent.get(student.id) ?? null;
                return (
                  <GuardianAssignmentItem
                    key={`${student.id}:${guardianId ?? "none"}`}
                    student={student}
                    guardians={guardians}
                    currentGuardianId={guardianId}
                    currentGuardian={
                      guardianId ? guardianById.get(guardianId) : undefined
                    }
                    studentCountByGuardian={studentCountByGuardian}
                    disabled={controlsDisabled}
                    busy={pendingStudentId === student.id}
                    onPersist={persistAssignment}
                  />
                );
              })}
            </div>

            {totalPages > 1 ? (
              <nav
                className="flex flex-col items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row"
                aria-label="Veli eşleştirme sayfaları"
              >
                <span>
                  {visibleStudents.length} öğrenciden {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, visibleStudents.length)} arası
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Önceki
                  </Button>
                  <span className="min-w-16 text-center tabular-nums">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Sonraki
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface GuardianAssignmentItemProps {
  student: UserProfile;
  guardians: readonly UserProfile[];
  currentGuardianId: string | null;
  currentGuardian: UserProfile | undefined;
  studentCountByGuardian: ReadonlyMap<string, number>;
  disabled: boolean;
  busy: boolean;
  onPersist: (student: UserProfile, guardianId: string | null) => Promise<void>;
}

function GuardianAssignmentItem({
  student,
  guardians,
  currentGuardianId,
  currentGuardian,
  studentCountByGuardian,
  disabled,
  busy,
  onPersist,
}: GuardianAssignmentItemProps) {
  const [draftGuardianId, setDraftGuardianId] = React.useState(
    currentGuardianId ?? NO_GUARDIAN,
  );
  const changed = draftGuardianId !== (currentGuardianId ?? NO_GUARDIAN);

  return (
    <article className="rounded-xl border bg-background p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(displayName(student))}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName(student)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {student.email ?? "E-posta yok"}
            </p>
          </div>
        </div>
        <Badge variant={currentGuardianId ? "success" : "warning"}>
          {currentGuardianId ? "Atandı" : "Atanmadı"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
          <GraduationCap className="h-3.5 w-3.5" />
          {student.classroom || "Sınıf atanmamış"}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1">
          <UserRound className="h-3.5 w-3.5" />
          <span className="truncate">
            {currentGuardian ? displayName(currentGuardian) : "Veli bekliyor"}
          </span>
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Select
          value={draftGuardianId}
          onValueChange={setDraftGuardianId}
          disabled={disabled || busy}
        >
          <SelectTrigger aria-label={`${displayName(student)} için veli seç`}>
            <SelectValue placeholder="Veli seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GUARDIAN}>Veli seçilmedi</SelectItem>
            {guardians
              .filter((guardian) => guardian.id !== student.id)
              .map((guardian) => {
                const count = studentCountByGuardian.get(guardian.id) ?? 0;
                return (
                  <SelectItem key={guardian.id} value={guardian.id}>
                    {displayName(guardian)}{count > 0 ? ` · ${count} öğrenci` : ""}
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={disabled || busy || !changed}
          onClick={() =>
            onPersist(
              student,
              draftGuardianId === NO_GUARDIAN ? null : draftGuardianId,
            )
          }
        >
          {busy ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Kaydet
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || busy || !currentGuardianId}
          onClick={() => onPersist(student, null)}
          aria-label={`${displayName(student)} için veli bağlantısını kaldır`}
        >
          <Unlink className="h-4 w-4" />
          Kaldır
        </Button>
      </div>
    </article>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
      <Icon className="mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-lg text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function compareUsers(left: UserProfile, right: UserProfile): number {
  return displayName(left).localeCompare(displayName(right), "tr");
}

function displayName(user: UserProfile | undefined): string {
  if (!user) return "İsimsiz kullanıcı";
  return user.full_name?.trim() || user.email?.trim() || "İsimsiz kullanıcı";
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr"))
    .join("");
}
