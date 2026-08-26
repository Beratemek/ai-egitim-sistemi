import { Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GuardianExamView } from "@/lib/guardian-analytics";
import { formatDateTime } from "@/lib/utils";

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export function GuardianExamStatusTable({ exams }: { exams: GuardianExamView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Güncel sınav durumu</CardTitle>
        <CardDescription>
          Yaklaşan, devam eden ve değerlendirmesi tamamlanan sınavların salt okunur özeti.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 sm:px-6">
        <Table>
          <TableCaption className="sr-only">
            Atanan sınavların durumu, son tarihi, son hareketi ve varsa nihai
            puanı
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-48">Sınav</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="min-w-36">Son tarih</TableHead>
              <TableHead className="min-w-36">Son hareket</TableHead>
              <TableHead className="text-right">Puan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Clock3 className="mx-auto h-7 w-7 text-muted-foreground/45" />
                  <p className="mt-3 text-sm font-medium">Atanmış sınav bulunmuyor</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Yeni bir sınav atandığında ilerleme durumu burada görünecek.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              exams.map((exam) => (
                <TableRow key={exam.exam_id}>
                  <TableCell>
                    <p className="font-medium">{exam.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exam.subject || "Ders belirtilmemiş"}
                    </p>
                  </TableCell>
                  <TableCell>{examStatusBadge(exam)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(exam.due_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(
                      exam.completed_at ?? exam.submitted_at ?? exam.started_at,
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {exam.final_score === null
                      ? "—"
                      : `${scoreFormatter.format(exam.final_score)} / 100`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function examStatusBadge(exam: GuardianExamView) {
  if (exam.isOverdue) return <Badge variant="danger">Süresi geçti</Badge>;
  if (exam.progress_status === "sonuclandi") {
    return <Badge variant="success">Sonuçlandı</Badge>;
  }
  if (exam.progress_status === "degerlendiriliyor") {
    return <Badge variant="warning">Değerlendiriliyor</Badge>;
  }
  if (exam.progress_status === "devam_ediyor") {
    return <Badge variant="highlight">Devam ediyor</Badge>;
  }
  return <Badge variant="soft">Başlanmadı</Badge>;
}
