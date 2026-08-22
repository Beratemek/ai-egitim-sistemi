"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
} from "lucide-react";

import { AnswerForm } from "@/components/shared/answer-form";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StudentQuestion } from "@/lib/queries";
import type { Submission } from "@/lib/types";

export interface StudentExamQuestionsProps {
  examId: string;
  studentId: string;
  questions: StudentQuestion[];
  submissions: Submission[];
  disabledReason: string | null;
  revealResults: boolean;
}

/** Uzun soru listesini tek-soru odakli, önceki/sonraki gezintisine cevirir. */
export function StudentExamQuestions({
  examId,
  studentId,
  questions,
  submissions,
  disabledReason,
  revealResults,
}: StudentExamQuestionsProps) {
  const answerByQuestion = React.useMemo(
    () =>
      new Map(
        submissions
          .filter((submission) => submission.question_id !== null)
          .map((submission) => [submission.question_id as string, submission]),
      ),
    [submissions],
  );
  const firstUnanswered = questions.findIndex(
    (question) => !answerByQuestion.has(question.id),
  );
  /** Gezinti acik mi? Sinav ekraninda oncelik soruda. */
  const [navOpen, setNavOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(
    firstUnanswered >= 0 ? firstUnanswered : 0,
  );

  React.useEffect(() => {
    if (activeIndex >= questions.length)
      setActiveIndex(Math.max(0, questions.length - 1));
  }, [activeIndex, questions.length]);

  const question = questions[activeIndex];
  if (!question) return null;

  const existing = answerByQuestion.get(question.id) ?? null;

  return (
    /*
      Iki sutun: SORU solda, gezinti SAGDA yapiskan bir sutunda.

      Gezinti onceden sorunun USTUNDE duruyordu; 50 soruluk bir sinavda
      dugmeler ekranin yarisini kapliyor ve ogrenci soruyu okumak icin her
      seferinde asagi kaydiriyordu. Yana alinca soru ekranin en ustunde
      basliyor, gezinti de kaybolmadan yaninda duruyor.

      Dar ekranda tek sutuna dusuyor ve gezinti soruNUN ALTINA geciyor -
      telefonda oncelik soruda.
    */
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5">
      <div className="order-1 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                {activeIndex + 1}
              </span>
              <QuestionTypeBadge type={question.type} />
              <Badge variant="soft">{question.topic}</Badge>
              <Badge variant="outline">{question.points} puan</Badge>
            </div>

            <CardTitle className="mt-2 leading-snug">{question.text}</CardTitle>
            <CardDescription>
              {question.type === "test"
                ? "Bir seçenek belirleyip cevabınızı kaydedin."
                : "Cevabınızı kaydedin; sınavı bitirene kadar düzenleyebilirsiniz."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AnswerForm
              key={question.id}
              examId={examId}
              studentId={studentId}
              questionId={question.id}
              type={question.type}
              options={question.options_json}
              existing={existing}
              disabledReason={disabledReason}
              revealResults={revealResults}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            disabled={activeIndex === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            Önceki soru
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setActiveIndex((index) =>
                Math.min(questions.length - 1, index + 1),
              )
            }
            disabled={activeIndex === questions.length - 1}
          >
            Sonraki soru
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ---------- Sağ sütun: soru gezintisi ---------- */}
      <div className="order-2 mt-4 lg:sticky lg:top-24 lg:mt-0">
        <Card>
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setNavOpen((acik) => !acik)}
                aria-expanded={navOpen}
                className="flex items-center gap-1.5 text-sm font-medium hover:text-primary"
              >
                Soru gezintisi
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    navOpen && "rotate-180",
                  )}
                />
              </button>

              <span className="text-xs tabular text-muted-foreground">
                {activeIndex + 1} / {questions.length}
              </span>
            </div>

            <div // Esit genislikte kutucuklar: flex-wrap son satiri seyreltip dagitiyordu.
            className={cn(
              "grid grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1.5",
              !navOpen && "hidden",
            )}>
              {questions.map((item, index) => {
                const submission = answerByQuestion.get(item.id);
                const isAnswered = Boolean(submission);
                const isFinal =
                  submission && submission.status !== "gonderildi";
                const isActive = index === activeIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`${index + 1}. soruya git${isAnswered ? ", cevaplandı" : ""}`}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex h-8 items-center justify-center gap-1 rounded-md border px-1 text-xs font-semibold transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : isFinal
                          ? "border-success/30 bg-success/10 text-success"
                          : isAnswered
                            ? "border-primary/30 bg-primary/5 text-primary"
                            : "bg-background text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {isAnswered ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Daire: cevaplanmadı</span>
              <span>Tık: kaydedildi</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
