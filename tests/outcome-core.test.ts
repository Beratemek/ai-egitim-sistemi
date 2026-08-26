import assert from "node:assert/strict";
import test from "node:test";

import {
  findSimilarOutcome,
  outcomeCore,
  outcomeSimilarity,
  searchOutcomes,
} from "../lib/outcome-core.ts";

/**
 * KAZANIM TEKRARI.
 *
 * Kazanim serbest metin oldugu icin iki hoca ayni seyi olcmek isteyip farkli
 * yazabiliyor. O zaman ayni sorular iki ayri kimlige dagiliyor ve kazanim
 * bazli basari yuzdesi anlamli bir orneklem toplayamiyor.
 *
 * Buradaki testler iki sinirin da korundugunu guvenceye alir:
 *   - Ayni seyi soyleyen farkli yazimlar YAKALANIR.
 *   - Gercekten farkli kazanimlar YAKALANMAZ (yanlis alarm yok).
 */

test("dolgu kelimeler cekirdekten atilir", () => {
  assert.deepEqual(outcomeCore("Öğrenci, fotosentez hakkında her şeyi bilir."), [
    "fotosentez",
    "bilir",
  ]);
});

test("ayni seyi soyleyen iki farkli yazim ayni sayilir", () => {
  // Sorunu bildiren gercek ornek: iki hoca, ayni konu, iki kazanim.
  const skor = outcomeSimilarity("Fotosentez bilgisi", "Fotosentez hakkında her şey");
  assert.equal(skor, 1);
});

test("fiil farki kazanimi FARKLI yapar - yanlis alarm olmamali", () => {
  // "aciklar" kavrama, "siralar" hatirlama olcer. Bunlar ayni kazanim degil.
  const skor = outcomeSimilarity(
    "Öğrenci fotosentezin evrelerini açıklar",
    "Öğrenci fotosentezin evrelerini sıralar",
  );
  assert.ok(skor < 0.7, `beklenen < 0.7, gelen ${skor}`);
});

test("Turkce ekler ayni koke indirilir", () => {
  // "fotosentez" ve "fotosentezin" ayni sey; dizge olarak farkli.
  const skor = outcomeSimilarity(
    "fotosentez evrelerini açıklar",
    "fotosentezin evreleri açıklanır",
  );
  assert.ok(skor >= 0.7, `beklenen >= 0.7, gelen ${skor}`);
});

test("kisa ve alakasiz kelimeler onek kuralina takilmaz", () => {
  // "ev" ile "evre" onek iliskisi kurar ama ayni kok DEGIL: 5 harf siniri
  // bunu engelliyor.
  const skor = outcomeSimilarity("ev planlar", "evre planlar");
  assert.ok(skor < 1, `ev/evre ayni sayilmamali, gelen ${skor}`);
});

test("buyuk-kucuk harf ve noktalama farki onemsiz", () => {
  const skor = outcomeSimilarity(
    "ÖĞRENCİ FOTOSENTEZİ AÇIKLAR!",
    "öğrenci fotosentezi açıklar",
  );
  assert.equal(skor, 1);
});

test("tumuyle farkli kazanimlar eslesmez", () => {
  const skor = outcomeSimilarity(
    "Öğrenci Newton yasalarını örnekle açıklar",
    "Öğrenci fotosentezin evrelerini açıklar",
  );
  assert.ok(skor < 0.7, `beklenen < 0.7, gelen ${skor}`);
});

test("findSimilarOutcome listeden benzeri bulur", () => {
  const list = [
    { id: "1", outcome_text: "Öğrenci Newton yasalarını açıklar" },
    { id: "2", outcome_text: "Fotosentez bilgisi" },
  ];

  const bulunan = findSimilarOutcome("Fotosentez hakkında her şey", list);
  assert.equal(bulunan?.id, "2");
});

test("findSimilarOutcome benzer yoksa null doner", () => {
  const list = [{ id: "1", outcome_text: "Öğrenci Newton yasalarını açıklar" }];

  assert.equal(findSimilarOutcome("Öğrenci mitozun evrelerini sıralar", list), null);
});

test("cekirdegi tumuyle dolgu olan metinler ham karsilastirilir", () => {
  // Iki tarafta da anlamli kelime kalmiyor; bos kume karsilastirmasi her seyi
  // ayni gosterirdi.
  assert.equal(outcomeSimilarity("her şey", "bilgisi"), 0);
  assert.equal(outcomeSimilarity("her şey", "Her şey"), 1);
});

/* -------------------------------------------------------------------------- */
/*  Canli arama                                                               */
/* -------------------------------------------------------------------------- */

const KAZANIMLAR = [
  {
    id: "1",
    outcome_text: "Öğrenci fotosentezin evrelerini açıklar.",
    topic: "Fotosentez",
    subject: "Biyoloji",
  },
  {
    id: "2",
    outcome_text: "Öğrenci birim çember üzerinde trigonometrik oranları hesaplar.",
    topic: "Trigonometri",
    subject: "Matematik",
  },
  {
    id: "3",
    outcome_text: "Öğrenci LDR sensörünün çalışma ilkesini açıklar.",
    topic: "LDR ve Işık Sensörleri",
    subject: "Robotik ve Kodlama",
  },
];

test("yarim yazilmis kelime eslesir - ad ararken cikan oneriler gibi", () => {
  // Cekirdek benzerligi bunu yakalayamaz: "fotos" hicbir koke tam oturmaz.
  const sonuc = searchOutcomes("fotos", KAZANIMLAR);
  assert.equal(sonuc.length, 1);
  assert.equal(sonuc[0]?.id, "1");
});

test("konu ve ders adindan da bulunur", () => {
  assert.equal(searchOutcomes("trigono", KAZANIMLAR)[0]?.id, "2");
  assert.equal(searchOutcomes("robotik", KAZANIMLAR)[0]?.id, "3");
});

test("ayni seyi baska kelimelerle yazan da bulur", () => {
  // Alt dizi eslesmesi yok; cekirdek benzerligi devreye giriyor.
  const sonuc = searchOutcomes("fotosentezin evreleri", KAZANIMLAR);
  assert.equal(sonuc[0]?.id, "1");
});

test("iki karakterden kisa arama sonuc dondurmez", () => {
  // Her tusa basista tum listeyi acmak oneri degil gurultu olurdu.
  assert.deepEqual(searchOutcomes("f", KAZANIMLAR), []);
  assert.deepEqual(searchOutcomes("", KAZANIMLAR), []);
});

test("alakasiz arama bos doner", () => {
  assert.deepEqual(searchOutcomes("osmanli padisahlari", KAZANIMLAR), []);
});

test("sonuc sayisi sinirlanir", () => {
  const cok = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    outcome_text: "Öğrenci fotosentezin evrelerini açıklar.",
    topic: "Fotosentez",
  }));
  assert.equal(searchOutcomes("fotosentez", cok).length, 6);
  assert.equal(searchOutcomes("fotosentez", cok, 3).length, 3);
});
