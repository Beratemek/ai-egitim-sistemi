import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRepairInstruction,
  buildVirtualClassReport,
  type ProfileRubricScore,
  type StudentAgentAnswer,
} from "../lib/student-agents.ts";
import { PRESET_PROFILES } from "../lib/student-profiles.ts";
import type { GeneratedQuestion } from "../lib/types.ts";

/* -------------------------------------------------------------------------- */
/*  Yardimcilar                                                               */
/* -------------------------------------------------------------------------- */

function testSorusu(patch: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    topic: "Kuvvet ve hareket",
    text: "Sabit hizla giden bir cisme etki eden net kuvvet nedir?",
    type: "test",
    options: [
      { key: "A", text: "Hiz yonunde bir kuvvet" },
      { key: "B", text: "Sifir" },
      { key: "C", text: "Hiza ters yonde bir kuvvet" },
      { key: "D", text: "Agirlik kadar bir kuvvet" },
    ],
    correct_answer: "B",
    rubric: null,
    difficulty: "zor",
    visual: null,
    ...patch,
  };
}

function acikUcluSoru(patch: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    topic: "Kuvvet ve hareket",
    text: "Newton'un birinci yasasini bir ornekle acikla.",
    type: "acik_uclu",
    options: null,
    correct_answer: null,
    rubric: "1. Yasayi dogru ifade eder (50)\n2. Uygun ornek verir (50)",
    difficulty: "orta",
    visual: null,
    ...patch,
  };
}

function cevap(
  profileId: string,
  answer: string,
  patch: Partial<StudentAgentAnswer> = {},
): StudentAgentAnswer {
  return {
    profileId,
    answer,
    confidence: 70,
    reasoning: `${profileId} gerekcesi`,
    ambiguous: false,
    ambiguityNote: null,
    ...patch,
  };
}

/**
 * Her celdiricinin secildigi, ust grubun tam basarili oldugu senaryo.
 *
 * p = 2/5 = 0,40 -> "zor" seviyeye denk gelir, sorunun etiketi de "zor";
 * ayirt edicilik 1,00; olu celdirici yok. Yani hicbir bulgu beklenmiyor.
 */
function saglikliCevaplar(): StudentAgentAnswer[] {
  return [
    cevap("guclu", "B", { confidence: 95 }),
    cevap("ortalama", "B", { confidence: 65 }),
    cevap("zorlanan", "A", { confidence: 25 }),
    cevap("yanilgili", "C", { confidence: 80 }),
    cevap("aceleci", "D", { confidence: 40 }),
  ];
}

/* -------------------------------------------------------------------------- */
/*  Metrikler                                                                 */
/* -------------------------------------------------------------------------- */

test("saglikli soru bulgusuz gecer ve tam puan alir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: saglikliCevaplar(),
    cueProbe: { guess: "A", confidence: 20, cue: null },
    rubricScores: null,
  });

  assert.deepEqual(report.bulgular, []);
  assert.equal(report.kaliteSkoru, 100);
  assert.equal(report.verdict, "hazir");
  assert.equal(report.pDegeri, 0.4);
  assert.equal(report.ayirtEdicilik, 1);
});

test("p degeri butun profilleri, ayirt edicilik yalniz ust/alt grubu sayar", () => {
  /*
    Aceleci ogrenci `notr` grupta: p degerine katilir ama ayirt edicilige
    girmez. Burada aceleci DOGRU cevapliyor ve p degerini yukseltiyor
    (2/5 = 0,40); ayirt edicilik ise yalnizca ust (1, 0) ve alt (0, 0)
    gruptan hesaplandigi icin 0,50 kaliyor - aceleci onu ne yukseltiyor ne
    dusuruyor.
  */
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu({ difficulty: "orta" }),
    answers: [
      cevap("guclu", "B"),
      cevap("ortalama", "C"),
      cevap("zorlanan", "A"),
      cevap("yanilgili", "C"),
      cevap("aceleci", "B"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  assert.equal(report.pDegeri, 0.4);
  assert.equal(report.ayirtEdicilik, 0.5);
});

test("sik dagilimi kimin hangi sikki sectigini tasir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: saglikliCevaplar(),
    cueProbe: null,
    rubricScores: null,
  });

  const dogruSik = report.siklar.find((sik) => sik.key === "B");
  assert.ok(dogruSik);
  assert.equal(dogruSik.correct, true);
  assert.equal(dogruSik.count, 2);
  assert.deepEqual(dogruSik.profileIds, ["guclu", "ortalama"]);
});

/* -------------------------------------------------------------------------- */
/*  Bulgular                                                                  */
/* -------------------------------------------------------------------------- */

test("guclu ogrenci anahtardan saparsa cevap anahtari supheli sayilir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: [
      cevap("guclu", "C", { confidence: 90 }),
      cevap("ortalama", "C"),
      cevap("zorlanan", "A"),
      cevap("yanilgili", "C"),
      cevap("aceleci", "B"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  const bulgu = report.bulgular.find((item) => item.code === "cevap_anahtari_supheli");
  assert.ok(bulgu, "cevap anahtari bulgusu bekleniyordu");
  assert.equal(bulgu.severity, "yuksek");
  assert.match(bulgu.detail, /C şıkkını seçti/);
  // Bulgu her zaman raporun en basinda: en agir olan once siralanir.
  assert.equal(report.bulgular[0]?.severity, "yuksek");
});

test("alt grup ust gruptan basariliysa madde ters calisiyor", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: [
      cevap("guclu", "C"),
      cevap("ortalama", "C"),
      cevap("zorlanan", "B"),
      cevap("yanilgili", "B"),
      cevap("aceleci", "C"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  assert.equal(report.ayirtEdicilik, -1);
  assert.ok(report.bulgular.some((item) => item.code === "ters_ayirt_edicilik"));
});

test("ipucu sizintisi yalniz gerekce ADI KONDUGUNDA isaretlenir", () => {
  const question = testSorusu();
  const answers = saglikliCevaplar();

  const gerekcesiz = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question,
    answers,
    // Dogru sikki tutturuyor ve emin, ama dayandigi bicimsel ipucu yok:
    // bu tahmin sanstir, sizinti degildir.
    cueProbe: { guess: "B", confidence: 90, cue: null },
    rubricScores: null,
  });

  assert.equal(gerekcesiz.ipucuSondasi?.sizinti, false);
  assert.ok(!gerekcesiz.bulgular.some((item) => item.code === "ipucu_sizintisi"));

  const gerekceli = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question,
    answers,
    cueProbe: {
      guess: "B",
      confidence: 90,
      cue: "dogru sik digerlerinden belirgin sekilde uzun",
    },
    rubricScores: null,
  });

  assert.equal(gerekceli.ipucuSondasi?.sizinti, true);
  const bulgu = gerekceli.bulgular.find((item) => item.code === "ipucu_sizintisi");
  assert.ok(bulgu);
  assert.equal(bulgu.severity, "yuksek");
});

test("ipucu sondasi yanlis sikki tuttururken sizinti isaretlenmez", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: saglikliCevaplar(),
    cueProbe: { guess: "D", confidence: 95, cue: "en uzun sik" },
    rubricScores: null,
  });

  assert.equal(report.ipucuSondasi?.sizinti, false);
});

test("iki ogrenci belirsizlik isaretlerse ifade bulgusu cikar", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: [
      cevap("guclu", "B", { ambiguous: true, ambiguityNote: "B ve D birlikte dogru" }),
      cevap("ortalama", "B", { ambiguous: true, ambiguityNote: "hangi an soruluyor belli degil" }),
      cevap("zorlanan", "A"),
      cevap("yanilgili", "C"),
      cevap("aceleci", "D"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  const bulgu = report.bulgular.find((item) => item.code === "belirsiz_ifade");
  assert.ok(bulgu);
  assert.equal(bulgu.severity, "orta");
  assert.match(bulgu.detail, /B ve D birlikte dogru/);
});

test("hicbir ogrencinin secmedigi celdirici isaretlenir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu({ difficulty: "orta" }),
    answers: [
      cevap("guclu", "B"),
      cevap("ortalama", "B"),
      cevap("zorlanan", "A"),
      cevap("yanilgili", "A"),
      cevap("aceleci", "B"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  const bulgu = report.bulgular.find((item) => item.code === "olu_celdirici");
  assert.ok(bulgu);
  assert.match(bulgu.detail, /C, D/);
});

test("etiketlenen zorluk olculen zorlukla uyusmazsa uyari verilir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    // Herkes dogru cevapliyor ama soru "zor" diye etiketlenmis.
    question: testSorusu({ difficulty: "zor" }),
    answers: [
      cevap("guclu", "B"),
      cevap("ortalama", "B"),
      cevap("zorlanan", "B"),
      cevap("yanilgili", "B"),
      cevap("aceleci", "B"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  assert.equal(report.pDegeri, 1);
  assert.ok(report.bulgular.some((item) => item.code === "cok_kolay"));
  assert.ok(report.bulgular.some((item) => item.code === "zorluk_uyusmazligi"));
  assert.ok(report.bulgular.some((item) => item.code === "dusuk_ayirt_edicilik"));
});

/* -------------------------------------------------------------------------- */
/*  Acik uclu                                                                 */
/* -------------------------------------------------------------------------- */

function rubrikPuani(profileId: string, score: number): ProfileRubricScore {
  return { profileId, score, comment: "gerekce" };
}

test("acik ucluda p degeri ve ayirt edicilik rubrik puanlarindan gelir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: acikUcluSoru(),
    answers: [
      cevap("guclu", "Ayrintili cevap"),
      cevap("ortalama", "Kismi cevap"),
      cevap("zorlanan", "Eksik cevap"),
      cevap("yanilgili", "Hatali cevap"),
      cevap("aceleci", "Hizli cevap"),
    ],
    cueProbe: null,
    rubricScores: [
      rubrikPuani("guclu", 90),
      rubrikPuani("ortalama", 70),
      rubrikPuani("zorlanan", 30),
      rubrikPuani("yanilgili", 40),
      rubrikPuani("aceleci", 60),
    ],
  });

  assert.equal(report.pDegeri, 0.58);
  assert.equal(report.ayirtEdicilik, 0.45);
  assert.equal(report.siklar.length, 0);
  assert.equal(report.ipucuSondasi, null);
  assert.ok(!report.bulgular.some((item) => item.code === "rubrik_ayirt_etmiyor"));
});

test("ust ve alt grup benzer puan alirsa rubrik ayristirmiyor sayilir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: acikUcluSoru(),
    answers: [
      cevap("guclu", "Ayrintili cevap"),
      cevap("ortalama", "Kismi cevap"),
      cevap("zorlanan", "Eksik cevap"),
      cevap("yanilgili", "Hatali cevap"),
      cevap("aceleci", "Hizli cevap"),
    ],
    cueProbe: null,
    rubricScores: [
      rubrikPuani("guclu", 70),
      rubrikPuani("ortalama", 65),
      rubrikPuani("zorlanan", 60),
      rubrikPuani("yanilgili", 60),
      rubrikPuani("aceleci", 65),
    ],
  });

  const bulgu = report.bulgular.find((item) => item.code === "rubrik_ayirt_etmiyor");
  assert.ok(bulgu);
  assert.equal(bulgu.severity, "orta");
});

/* -------------------------------------------------------------------------- */
/*  Otomatik onarim talimati                                                  */
/* -------------------------------------------------------------------------- */

test("onarim talimati yalniz yuksek ve orta oncelikli bulgulari tasir", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu({ difficulty: "kolay" }),
    answers: [
      // Guclu ogrenci saparsa yuksek oncelikli bulgu; zorluk uyusmazligi ise
      // dusuk oncelikli ve talimata girmemeli.
      cevap("guclu", "C", { confidence: 95 }),
      cevap("ortalama", "C"),
      cevap("zorlanan", "A"),
      cevap("yanilgili", "C"),
      cevap("aceleci", "D"),
    ],
    cueProbe: null,
    rubricScores: null,
  });

  assert.ok(report.bulgular.some((item) => item.code === "zorluk_uyusmazligi"));

  const talimat = buildRepairInstruction(report);
  assert.ok(talimat);
  assert.match(talimat, /Doğru cevabı yeniden denetle/);
  assert.ok(!talimat.includes("Sorunun ölçülen zorluğu"));
});

test("bulgu yoksa onarim talimati uretilmez", () => {
  const report = buildVirtualClassReport({
    profiles: PRESET_PROFILES,
    question: testSorusu(),
    answers: saglikliCevaplar(),
    cueProbe: null,
    rubricScores: null,
  });

  assert.equal(buildRepairInstruction(report), null);
});
