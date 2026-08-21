import * as React from "react";

import { cn } from "@/lib/utils";
import { paginate, type NumberedQuestion } from "@/lib/exam-paper";

/**
 * Basilmaya hazir sinav kagidi.
 *
 * Ekranda gercek olcusunde (210x297mm) bir yaprak gibi durur; yazdirmada
 * `print:` varyantlari ile golge/cerceve kalkar ve `@page` kurallari
 * (bkz. app/globals.css) devreye girer. Renkler bilerek sabit: panel koyu
 * temada olsa da kagit her zaman beyaz kalir.
 */

export interface ExamPaperMeta {
  title: string;
  school: string;
  lesson: string;
  /** Sinif / sube bilgisi. `className` React ile cakistigi icin bu ad. */
  grade: string;
  /** ISO tarih (yyyy-aa-gg). Bos ise kagitta noktali bosluk birakilir. */
  date: string;
  /** Sinav suresi, dakika. */
  duration: string;
  instructions: string;
}

export interface ExamPaperProps {
  meta: ExamPaperMeta;
  questions: readonly NumberedQuestion[];
  /** Sona ayri bir yaprak olarak cevap anahtari eklenir. */
  showAnswerKey?: boolean;
}

/** Acik uclu sorularin altina birakilan cizgi sayisi. */
const ANSWER_LINES = 4;

export function ExamPaper({ meta, questions, showAnswerKey = false }: ExamPaperProps) {
  const pages = paginate(questions);
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  const sheetCount = pages.length + (showAnswerKey ? 1 : 0);

  return (
    <div className="exam-preview overflow-x-auto pb-2 print:overflow-visible print:pb-0">
      <div className="mx-auto w-fit space-y-6 print:space-y-0">
        {pages.map((page) => (
          <Sheet key={page.index}>
            {page.index === 0 ? (
              <PaperHead meta={meta} count={questions.length} totalPoints={totalPoints} />
            ) : (
              <ContinuationHead meta={meta} />
            )}

            <div className="grid flex-1 grid-cols-2 content-start">
              {page.columns.map((column, columnIndex) => (
                <ol
                  key={columnIndex}
                  className={cn(
                    "space-y-[5mm]",
                    columnIndex === 0
                      ? "pr-[7mm]"
                      : "border-l border-slate-300 pl-[7mm]",
                  )}
                >
                  {column.map((question) => (
                    <PaperQuestion key={question.id} question={question} />
                  ))}
                </ol>
              ))}
            </div>

            <PaperFoot
              page={page.index + 1}
              total={sheetCount}
              isLastQuestionPage={page.index === pages.length - 1}
            />
          </Sheet>
        ))}

        {showAnswerKey ? (
          <AnswerKeySheet
            meta={meta}
            questions={questions}
            page={sheetCount}
            total={sheetCount}
          />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Yaprak kabugu                                                             */
/* -------------------------------------------------------------------------- */

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <article
      className={cn(
        "exam-sheet flex min-h-[297mm] w-[210mm] flex-col bg-white p-[14mm] text-slate-900",
        "shadow-lg ring-1 ring-slate-300",
        "break-after-page last:break-after-auto",
        "print:m-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none print:ring-0",
      )}
    >
      {children}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Baslik bloklari                                                           */
/* -------------------------------------------------------------------------- */

function PaperHead({
  meta,
  count,
  totalPoints,
}: {
  meta: ExamPaperMeta;
  count: number;
  totalPoints: number;
}) {
  return (
    <header className="mb-[6mm] border-b-2 border-slate-900 pb-[4mm]">
      <div className="flex items-start justify-between gap-[6mm]">
        <div className="min-w-0">
          {meta.school ? (
            <p className="text-[8.5pt] font-medium uppercase tracking-[0.08em] text-slate-500">
              {meta.school}
            </p>
          ) : null}
          <h1 className="text-[14pt] font-bold leading-tight">
            {meta.title || "Sınav"}
          </h1>
          {meta.lesson ? (
            <p className="mt-[0.5mm] text-[10pt] text-slate-600">{meta.lesson}</p>
          ) : null}
        </div>

        <dl className="shrink-0 space-y-[1.5mm] text-right text-[9pt] leading-none">
          <HeadFact label="Tarih" value={formatPaperDate(meta.date)} />
          <HeadFact
            label="Süre"
            value={meta.duration ? `${meta.duration} dakika` : "-"}
          />
          <HeadFact label="Soru" value={`${count} soru / ${totalPoints} puan`} />
        </dl>
      </div>

      <div className="mt-[5mm] flex items-end gap-[5mm]">
        <BlankField label="Ad Soyad" className="flex-[2]" />
        <BlankField label="Sınıf" className="flex-1" value={meta.grade} />
        <BlankField label="Numara" className="flex-1" />

        <div className="w-[24mm] shrink-0 rounded-sm border-2 border-slate-900 text-center">
          <p className="border-b border-slate-900 py-[0.8mm] text-[7.5pt] font-semibold uppercase tracking-[0.08em]">
            Puan
          </p>
          <p className="h-[9mm]" />
        </div>
      </div>

      {meta.instructions ? (
        <p className="mt-[4mm] rounded-sm bg-slate-100 px-[3mm] py-[2mm] text-[8.5pt] leading-[1.4] text-slate-700 print:bg-transparent print:px-0 print:py-0">
          <span className="font-semibold">Yönerge: </span>
          {meta.instructions}
        </p>
      ) : null}
    </header>
  );
}

function ContinuationHead({ meta }: { meta: ExamPaperMeta }) {
  return (
    <header className="mb-[5mm] flex items-baseline justify-between border-b border-slate-400 pb-[2mm] text-[8.5pt] text-slate-500">
      <span className="font-semibold text-slate-700">{meta.title || "Sınav"}</span>
      <span>{meta.lesson}</span>
    </header>
  );
}

function HeadFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-[2mm]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function BlankField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[7.5pt] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-[1mm] h-[6mm] truncate border-b border-dotted border-slate-500 pt-[1mm] text-[10pt]">
        {value ?? ""}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Soru                                                                      */
/* -------------------------------------------------------------------------- */

function PaperQuestion({ question }: { question: NumberedQuestion }) {
  return (
    <li className="flex gap-[2mm] break-inside-avoid">
      <span className="shrink-0 text-[10pt] font-bold tabular">{question.number}.</span>

      <div className="min-w-0 flex-1">
        <p className="text-[10pt] leading-[1.35]">{question.text}</p>

        {question.type === "test" ? (
          <ol className="mt-[1.5mm] space-y-[1mm] text-[9.5pt] leading-[1.25]">
            {(question.options_json ?? []).map((option) => (
              <li key={option.key} className="flex gap-[1.5mm]">
                <span className="shrink-0 font-semibold">{option.key})</span>
                <span className="min-w-0">{option.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-[2.5mm] space-y-[5mm]" aria-hidden>
            {Array.from({ length: ANSWER_LINES }, (_, line) => (
              <div key={line} className="border-b border-dotted border-slate-400" />
            ))}
          </div>
        )}
      </div>

      <span className="shrink-0 pt-[0.5mm] text-[7.5pt] text-slate-500 tabular">
        {question.points}p
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Alt bilgi                                                                 */
/* -------------------------------------------------------------------------- */

function PaperFoot({
  page,
  total,
  isLastQuestionPage,
}: {
  page: number;
  total: number;
  isLastQuestionPage: boolean;
}) {
  return (
    <footer className="mt-[6mm] flex items-baseline justify-between border-t border-slate-300 pt-[2mm] text-[8pt] text-slate-500">
      <span>
        {isLastQuestionPage ? "Başarılar dilerim." : "Arka sayfada devam ediyor."}
      </span>
      <span className="tabular">
        Sayfa {page} / {total}
      </span>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cevap anahtari                                                            */
/* -------------------------------------------------------------------------- */

function AnswerKeySheet({
  meta,
  questions,
  page,
  total,
}: {
  meta: ExamPaperMeta;
  questions: readonly NumberedQuestion[];
  page: number;
  total: number;
}) {
  const multipleChoice = questions.filter((question) => question.type === "test");
  const openEnded = questions.filter((question) => question.type === "acik_uclu");

  return (
    <Sheet>
      <header className="mb-[6mm] border-b-2 border-slate-900 pb-[3mm]">
        <p className="text-[8.5pt] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Cevap Anahtarı
        </p>
        <h2 className="text-[13pt] font-bold leading-tight">{meta.title || "Sınav"}</h2>
      </header>

      <div className="flex-1 space-y-[7mm]">
        {multipleChoice.length > 0 ? (
          <section>
            <h3 className="mb-[3mm] text-[9.5pt] font-semibold uppercase tracking-wide text-slate-600">
              Çoktan seçmeli
            </h3>
            <div className="grid grid-cols-5 gap-[2mm]">
              {multipleChoice.map((question) => (
                <div
                  key={question.id}
                  className="flex items-baseline justify-between rounded-sm border border-slate-300 px-[2.5mm] py-[1.5mm] text-[10pt]"
                >
                  <span className="text-slate-500 tabular">{question.number}.</span>
                  <span className="font-bold">{question.correct_answer ?? "-"}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {openEnded.length > 0 ? (
          <section>
            <h3 className="mb-[3mm] text-[9.5pt] font-semibold uppercase tracking-wide text-slate-600">
              Açık uçlu - puanlama rubriği
            </h3>
            <ol className="space-y-[3mm]">
              {openEnded.map((question) => (
                <li key={question.id} className="break-inside-avoid">
                  <p className="text-[9.5pt] font-semibold">
                    {question.number}. {question.text}{" "}
                    <span className="font-normal text-slate-500">
                      ({question.points} puan)
                    </span>
                  </p>
                  <p className="mt-[1mm] whitespace-pre-wrap text-[9pt] leading-[1.4] text-slate-600">
                    {question.rubric ?? "Rubrik tanımlanmamış."}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <footer className="mt-[6mm] flex items-baseline justify-between border-t border-slate-300 pt-[2mm] text-[8pt] text-slate-500">
        <span>Öğrenciye dağıtılmaz.</span>
        <span className="tabular">
          Sayfa {page} / {total}
        </span>
      </footer>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */

/** ISO tarihi "20.08.2026" yapar; bos ise kagitta doldurulacak bosluk birakir. */
function formatPaperDate(iso: string): string {
  if (!iso) return "...... / ...... / ..........";

  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(date);
}
