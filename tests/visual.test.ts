import assert from "node:assert/strict";
import test from "node:test";

import { parseVisual, sanitizeSvg } from "../lib/visual.ts";

/**
 * SVG TEMIZLEME BIR GUVENLIK SINIRI.
 *
 * SVG calistirilabilir bir bicim. Modelin urettigi cizim dogrudan sayfaya
 * basilirsa `<script>` ya da `onload=` ile kod kosar. Model kotu niyetli
 * olmasa da KAYNAK METIN kullanicidan geliyor: yuklenen bir PDF'e gomulmus
 * talimat modeli yonlendirebilir (prompt injection).
 *
 * Asagidaki testler bu sinirin acilmadigini guvenceye alir.
 */

test("script etiketi sokulur", () => {
  const out = sanitizeSvg('<svg><script>alert(1)</script><circle r="5"/></svg>');
  assert.ok(out);
  assert.ok(!out.includes("script"), out);
  assert.ok(out.includes("circle"));
});

test("olay isleyicileri sokulur", () => {
  const out = sanitizeSvg('<svg onload="steal()"><rect onclick=\'go()\' x="1"/></svg>');
  assert.ok(out);
  assert.ok(!/onload/i.test(out), out);
  assert.ok(!/onclick/i.test(out), out);
  assert.ok(out.includes("rect"));
});

test("foreignObject sokulur - icinde HTML calisir", () => {
  const out = sanitizeSvg(
    '<svg><foreignObject><body><img src=x onerror="x()"></body></foreignObject><line/></svg>',
  );
  assert.ok(out);
  assert.ok(!/foreignObject/i.test(out), out);
  assert.ok(out.includes("line"));
});

test("javascript: baglantisi sokulur", () => {
  const out = sanitizeSvg('<svg><a href="javascript:alert(1)"><text>t</text></a></svg>');
  assert.ok(out);
  assert.ok(!/javascript:/i.test(out), out);
});

test("kod blogu isaretleri ve cevre metni soyulur", () => {
  const out = sanitizeSvg('```svg\nIste cizim:\n<svg><circle r="3"/></svg>\n```');
  assert.ok(out);
  assert.ok(out.startsWith("<svg"), out);
  assert.ok(out.endsWith("</svg>"), out);
});

test("svg olmayan girdi reddedilir", () => {
  assert.equal(sanitizeSvg("sadece metin"), null);
  assert.equal(sanitizeSvg("<div>html</div>"), null);
});

test("asiri buyuk cizim reddedilir", () => {
  const huge = "<svg>" + "<circle r='1'/>".repeat(3000) + "</svg>";
  assert.equal(sanitizeSvg(huge), null);
});

/* -------------------------------------------------------------------------- */
/*  parseVisual                                                               */
/* -------------------------------------------------------------------------- */

test("gecerli grafik kabul edilir", () => {
  const visual = parseVisual({
    kind: "chart",
    chartType: "bar",
    xKey: "yil",
    series: [{ key: "uretim", label: "Üretim" }],
    data: [{ yil: "2020", uretim: 12 }],
  });

  assert.equal(visual?.kind, "chart");
});

test("eksik alanli grafik reddedilir - bozuk kayit ekrani cokertmesin", () => {
  assert.equal(parseVisual({ kind: "chart", chartType: "bar" }), null);
  assert.equal(
    parseVisual({ kind: "chart", chartType: "pasta", xKey: "a", series: [], data: [] }),
    null,
  );
});

test("grafik satirlari 40 ile sinirlanir", () => {
  const visual = parseVisual({
    kind: "chart",
    chartType: "line",
    xKey: "x",
    series: [{ key: "y", label: "Y" }],
    data: Array.from({ length: 120 }, (_, i) => ({ x: String(i), y: i })),
  });

  assert.equal(visual?.kind === "chart" ? visual.data.length : -1, 40);
});

test("gorsel yalnizca https ile kabul edilir", () => {
  assert.equal(parseVisual({ kind: "image", url: "http://x/y.jpg", alt: "" }), null);
  assert.equal(parseVisual({ kind: "image", url: "javascript:x", alt: "" }), null);
  assert.ok(parseVisual({ kind: "image", url: "https://x/y.jpg", alt: "a" }));
});

test("lisans bilgisi eksikse bos degil, 'Bilinmiyor' yazar", () => {
  const visual = parseVisual({ kind: "image", url: "https://x/y.jpg", alt: "a" });
  assert.equal(visual?.kind === "image" ? visual.license : null, "Bilinmiyor");
});

test("tanimsiz ve bos degerler null doner", () => {
  assert.equal(parseVisual(null), null);
  assert.equal(parseVisual(undefined), null);
  assert.equal(parseVisual("metin"), null);
  assert.equal(parseVisual({ kind: "video" }), null);
});
