import assert from "node:assert/strict";
import test from "node:test";

import { buildPerformanceSamples } from "../lib/exam-simulation-data.ts";
import {
  buildExamSimulationReport,
  estimateSolveMinutes,
  type SimulatedAnswer,
  type SimulationQuestion,
} from "../lib/exam-simulation.ts";
import {
  buildClassroomTwin,
  createProfile,
  describeProfile,
  groupFromAbility,
  type CohortMember,
  type StudentPerformanceSample,
} from "../lib/student-profiles.ts";

/* -------------------------------------------------------------------------- */
/*  Yardimcilar                                                               */
/* -------------------------------------------------------------------------- */

function soru(
  position: number,
  patch: Partial<SimulationQuestion> = {},
): SimulationQuestion {
  return {
    questionId: `q${position}`,
    position,
    text: "Sabit hizla giden bir cisme etki eden net kuvvet nedir?",
    type: "test",
    options: [
      { key: "A", text: "Hiz yonunde" },
      { key: "B", text: "Sifir" },
      { key: "C", text: "Hiza ters" },
      { key: "D", text: "Agirlik kadar" },
    ],
    correctAnswer: "B",
    rubric: null,
    difficulty: "orta",
    subject: "Fizik",
    topic: "Kuvvet",
    outcomeId: "k1",
    outcomeText: "Newton'un birinci yasasini aciklar",
    points: 10,
    ...patch,
  };
}

function uye(
  id: string,
  ability: number,
  weight: number,
  patch: { diligence?: number; group?: "ust" | "alt" | "notr" } = {},
): CohortMember {
  return {
    weight,
    profile: createProfile({
      id,
      label: id,
      ability,
      diligence: patch.diligence ?? 0.7,
      ...(patch.group ? { group: patch.group } : {}),
    }),
  };
}

function cevap(
  profileId: string,
  questionId: string,
  answer: string,
  rubricScore: number | null = null,
): SimulatedAnswer {
  return { profileId, questionId, answer, confidence: 70, rubricScore };
}

/* -------------------------------------------------------------------------- */
/*  Profil modeli                                                             */
/* -------------------------------------------------------------------------- */

test("yetkinlik grup atamasini belirler", () => {
  assert.equal(groupFromAbility(0.9), "ust");
  assert.equal(groupFromAbility(0.6), "notr");
  assert.equal(groupFromAbility(0.3), "alt");
});

test("profil tanimi parametrelerden uretilir", () => {
  const brief = describeProfile({
    ability: 0.3,
    diligence: 0.2,
    misconception: "agir cisim hizli duser",
    subjectAbility: { Matematik: 0.9, Fizik: 0.2 },
  });

  assert.match(brief, /On bilgisi eksik/);
  assert.match(brief, /Aceleci/);
  assert.match(brief, /agir cisim hizli duser/);
  // Ders sirasi yuksekten dusuge: egitmen once guclu yani gorsun.
  assert.match(brief, /Matematik: cok iyi, Fizik: cok zayif/);
});

test("elle kurulan profilde brief ve grup kendiliginden dolar", () => {
  const profile = createProfile({ id: "p1", label: "Test", ability: 0.85, diligence: 0.9 });

  assert.equal(profile.group, "ust");
  assert.ok(profile.brief.length > 0);
  assert.ok(profile.summary.length > 0);
});

/* -------------------------------------------------------------------------- */
/*  Dijital ikiz                                                              */
/* -------------------------------------------------------------------------- */

function ornek(
  studentId: string,
  averageScore: number,
  patch: Partial<StudentPerformanceSample> = {},
): StudentPerformanceSample {
  return {
    studentId,
    averageScore,
    bySubject: {},
    blankRate: 0,
    answerCount: 10,
    ...patch,
  };
}

test("sinif yetkinlik dilimlerine bolunur ve agirliklar korunur", () => {
  const samples = Array.from({ length: 20 }, (_, index) =>
    ornek(`s${index}`, 30 + index * 3),
  );

  const twin = buildClassroomTwin(samples, { size: 5 });

  assert.equal(twin.cohort.length, 5);
  assert.equal(twin.studentCount, 20);
  assert.equal(
    twin.cohort.reduce((total, member) => total + member.weight, 0),
    20,
    "agirliklarin toplami sinif mevcuduna esit olmali",
  );
  // En alt dilim alt gruba, en ust dilim ust gruba girer; ortasi ayrima
  // katilmaz - klasik ust/alt %27 mantigi.
  assert.equal(twin.cohort[0]?.profile.group, "alt");
  assert.equal(twin.cohort[4]?.profile.group, "ust");
  assert.equal(twin.cohort[2]?.profile.group, "notr");
  // Dilimler basariya gore sirali: ust dilimin yetkinligi daha yuksek.
  assert.ok(
    (twin.cohort[4]?.profile.ability ?? 0) > (twin.cohort[0]?.profile.ability ?? 1),
  );
});

test("ikiz profillerinde ogrenci kimligi ya da adi tasinmaz", () => {
  const twin = buildClassroomTwin(
    [ornek("gizli-kimlik-1", 80), ornek("gizli-kimlik-2", 40)],
    { size: 2 },
  );

  const metin = JSON.stringify(twin.cohort);
  assert.ok(!metin.includes("gizli-kimlik"), "profil metinlerinde ogrenci kimligi olmamali");
});

test("yeterli cevabi olmayan ogrenci ikize girmez", () => {
  const twin = buildClassroomTwin(
    [
      ornek("s1", 70),
      ornek("s2", 50),
      ornek("s3", null as unknown as number, { averageScore: null }),
      ornek("s4", 60, { answerCount: 1 }),
    ],
    { size: 2, minAnswers: 3 },
  );

  assert.equal(twin.studentCount, 2);
  assert.equal(twin.skippedCount, 2);
  assert.equal(twin.classAverage, 60);
});

test("ham cevaplar ogrenci basina ozetlenir", () => {
  const samples = buildPerformanceSamples(
    ["s1", "s2"],
    [
      { studentId: "s1", approvedScore: 80, blank: false, subject: "Matematik" },
      { studentId: "s1", approvedScore: 60, blank: false, subject: "Fizik" },
      { studentId: "s1", approvedScore: null, blank: true, subject: "Fizik" },
      { studentId: "s2", approvedScore: 40, blank: false, subject: "Matematik" },
    ],
  );

  const s1 = samples.find((sample) => sample.studentId === "s1");
  assert.ok(s1);
  assert.equal(s1.averageScore, 70);
  assert.equal(s1.answerCount, 2);
  assert.equal(s1.bySubject.Matematik, 80);
  // Bos birakma orani BUTUN cevaplardan: onay beklemeden gozlenebilen bir
  // dikkat sinyali.
  assert.equal(Math.round(s1.blankRate * 100), 33);
});

/* -------------------------------------------------------------------------- */
/*  Kestirim raporu                                                           */
/* -------------------------------------------------------------------------- */

test("puanlar soru agirligina gore hesaplanir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: 60,
    cohort: [uye("iyi", 0.9, 1)],
    questions: [soru(1, { points: 30 }), soru(2, { points: 70 })],
    answers: [cevap("iyi", "q1", "B"), cevap("iyi", "q2", "C")],
  });

  // Yalnizca 30 puanlik soru dogru: 30/100.
  assert.equal(report.students[0]?.score, 30);
  assert.equal(report.totalPoints, 100);
});

test("dagilim ve gecme orani agirliklidir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: null,
    cohort: [uye("iyi", 0.9, 3, { group: "ust" }), uye("zayif", 0.2, 7, { group: "alt" })],
    questions: [soru(1, { points: 100 })],
    answers: [cevap("iyi", "q1", "B"), cevap("zayif", "q1", "A")],
  });

  assert.equal(report.studentCount, 10);
  // Uc ogrenci 100, yedi ogrenci 0 -> agirlikli ortalama 30.
  assert.equal(report.distribution.mean, 30);
  assert.equal(report.distribution.passRate, 0.3);
  assert.equal(report.separation, 100);

  const ustDilim = report.distribution.buckets.find((bucket) => bucket.from === 80);
  assert.equal(ustDilim?.count, 3, "tam puan en ust dilime girmeli");
});

test("soru bazinda p degeri ve ayirt edicilik cikar", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: null,
    cohort: [
      uye("ust1", 0.9, 5, { group: "ust" }),
      uye("alt1", 0.2, 5, { group: "alt" }),
    ],
    questions: [soru(1)],
    answers: [cevap("ust1", "q1", "B"), cevap("alt1", "q1", "C")],
  });

  const sonuc = report.questions[0];
  assert.ok(sonuc);
  assert.equal(sonuc.pDegeri, 0.5);
  assert.equal(sonuc.ayirtEdicilik, 1);
  assert.equal(sonuc.enCokSecilenYanlis?.key, "C");
  assert.equal(sonuc.enCokSecilenYanlis?.rate, 0.5);
});

test("kazanim kestirimi soru puaniyla agirliklanir ve en zayif basa gelir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: null,
    cohort: [uye("tek", 0.6, 1)],
    questions: [
      soru(1, { outcomeId: "kolay", outcomeText: "Kolay kazanim", points: 10 }),
      soru(2, { outcomeId: "zor", outcomeText: "Zor kazanim", points: 90 }),
    ],
    answers: [cevap("tek", "q1", "B"), cevap("tek", "q2", "A")],
  });

  assert.equal(report.outcomes.length, 2);
  assert.equal(report.outcomes[0]?.outcomeId, "zor");
  assert.equal(report.outcomes[0]?.averageScore, 0);
  assert.equal(report.outcomes[1]?.averageScore, 100);
});

test("acik uclu soruda rubrik puani kullanilir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: null,
    cohort: [uye("tek", 0.7, 1)],
    questions: [
      soru(1, {
        type: "acik_uclu",
        options: null,
        correctAnswer: null,
        rubric: "1. madde (100)",
        points: 100,
      }),
    ],
    answers: [cevap("tek", "q1", "Cevap metni", 65)],
  });

  assert.equal(report.students[0]?.score, 65);
  assert.equal(report.questions[0]?.pDegeri, 0.65);
});

test("cevaplanmayan soru sifir sayilir ve cevaplanan sayisina girmez", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: null,
    cohort: [uye("tek", 0.6, 1)],
    questions: [soru(1, { points: 50 }), soru(2, { points: 50 })],
    answers: [cevap("tek", "q1", "B")],
  });

  assert.equal(report.students[0]?.score, 50);
  assert.equal(report.students[0]?.answeredCount, 1);
});

/* -------------------------------------------------------------------------- */
/*  Sure kestirimi                                                            */
/* -------------------------------------------------------------------------- */

test("zayif ve titiz ogrenci daha uzun surede bitirir", () => {
  const question = soru(1);
  const hizli = createProfile({ id: "h", label: "h", ability: 0.9, diligence: 0.2 });
  const yavas = createProfile({ id: "y", label: "y", ability: 0.3, diligence: 0.9 });

  assert.ok(estimateSolveMinutes(question, yavas) > estimateSolveMinutes(question, hizli));
});

test("acik uclu soru coktan secmeliden uzun surer", () => {
  const profile = createProfile({ id: "p", label: "p", ability: 0.6, diligence: 0.6 });

  assert.ok(
    estimateSolveMinutes(
      soru(1, { type: "acik_uclu", options: null, points: 40 }),
      profile,
    ) > estimateSolveMinutes(soru(1), profile),
  );
});

/* -------------------------------------------------------------------------- */
/*  Uyarilar                                                                  */
/* -------------------------------------------------------------------------- */

test("herkesin dustugu sinav 'cok zor' uyarisi verir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: 60,
    cohort: [uye("ust1", 0.9, 1, { group: "ust" }), uye("alt1", 0.2, 1, { group: "alt" })],
    questions: [soru(1, { points: 100 })],
    answers: [cevap("ust1", "q1", "A"), cevap("alt1", "q1", "C")],
  });

  const kodlar = report.warnings.map((warning) => warning.code);
  assert.ok(kodlar.includes("sinav_cok_zor"));
  assert.ok(kodlar.includes("ayrisma_yok"));
  // Uyarilar agirliga gore sirali: en agir olan basta.
  assert.equal(report.warnings[0]?.severity, "yuksek");
});

test("sinif ayrismiyorsa uyari verilir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: null,
    cohort: [uye("ust1", 0.9, 1, { group: "ust" }), uye("alt1", 0.2, 1, { group: "alt" })],
    questions: [soru(1, { points: 100 })],
    answers: [cevap("ust1", "q1", "B"), cevap("alt1", "q1", "B")],
  });

  assert.equal(report.separation, 0);
  assert.ok(report.warnings.some((warning) => warning.code === "ayrisma_yok"));
});

test("sure yetmiyorsa uyari verilir ve ilgili soru numaralari bos kalir", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    durationMinutes: 1,
    cohort: [uye("ust1", 0.9, 1, { group: "ust" }), uye("alt1", 0.2, 1, { group: "alt" })],
    questions: [soru(1), soru(2), soru(3)],
    answers: [cevap("ust1", "q1", "B"), cevap("alt1", "q1", "A")],
  });

  const uyari = report.warnings.find((warning) => warning.code === "sure_yetersiz");
  assert.ok(uyari);
  assert.equal(report.duration.fits, false);
  assert.deepEqual(uyari.questionNumbers, []);
});

test("saglikli sinavda uyari cikmaz", () => {
  const report = buildExamSimulationReport({
    cohortLabel: "Test",
    // Sure BILEREK dar tutuldu: cok genis bir sure "sure_fazla" uyarisi
    // uretirdi ve bu senaryo uyarisiz gecmeyi sinamak icin var.
    durationMinutes: 5,
    cohort: [
      uye("ust1", 0.9, 5, { group: "ust" }),
      uye("orta1", 0.6, 10, { group: "notr" }),
      uye("alt1", 0.3, 5, { group: "alt" }),
    ],
    questions: [soru(1, { points: 50 }), soru(2, { points: 50 })],
    answers: [
      cevap("ust1", "q1", "B"),
      cevap("ust1", "q2", "B"),
      cevap("orta1", "q1", "B"),
      cevap("orta1", "q2", "C"),
      cevap("alt1", "q1", "A"),
      cevap("alt1", "q2", "C"),
    ],
  });

  // 5 ogrenci 100, 10 ogrenci 50, 5 ogrenci 0 -> agirlikli ortalama 50.
  assert.equal(report.distribution.mean, 50);
  assert.equal(report.separation, 100);
  assert.deepEqual(report.warnings, []);
});
