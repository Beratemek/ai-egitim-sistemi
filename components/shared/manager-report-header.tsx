import type {
  ManagerAnalytics,
  ManagerAnalyticsScope,
} from "@/lib/manager-analytics";

export function ManagerReportHeader({
  reportType,
  entityName,
  scope,
  masteryThreshold,
  exams,
}: {
  reportType: string;
  entityName: string;
  scope: ManagerAnalyticsScope;
  masteryThreshold: number;
  exams: ManagerAnalytics["filterOptions"]["exams"];
}) {
  const selectedExam = exams.find((exam) => exam.id === scope.examId);
  const generatedAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date());

  const filters = [
    { label: "Ders", value: scope.subject ?? "Tüm dersler" },
    {
      label: "Sınav",
      value: selectedExam
        ? `${selectedExam.title} · ${selectedExam.subject}`
        : scope.examId
          ? "Seçili sınav"
          : "Tüm sınavlar",
    },
    { label: "Tarih aralığı", value: dateRangeLabel(scope.dateFrom, scope.dateTo) },
    { label: "Başarı eşiği", value: `%${masteryThreshold}` },
  ];

  return (
    <header className="manager-report-header hidden print:block">
      <div className="manager-report-heading-row">
        <div>
          <p className="manager-report-brand">İZOMETRİ · EĞİTİM ANALİTİĞİ</p>
          <p className="manager-report-type">{reportType}</p>
        </div>
        <p className="manager-report-date">
          <span>Rapor tarihi</span>
          <strong>{generatedAt}</strong>
        </p>
      </div>

      <h1>{entityName}</h1>

      <dl className="manager-report-filters" aria-label="Rapor kapsamı">
        {filters.map((filter) => (
          <div key={filter.label}>
            <dt>{filter.label}</dt>
            <dd>{filter.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function dateRangeLabel(dateFrom?: string, dateTo?: string) {
  if (dateFrom && dateTo) return `${formatFilterDate(dateFrom)} – ${formatFilterDate(dateTo)}`;
  if (dateFrom) return `${formatFilterDate(dateFrom)} ve sonrası`;
  if (dateTo) return `${formatFilterDate(dateTo)} ve öncesi`;
  return "Tüm tarihler";
}

function formatFilterDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
