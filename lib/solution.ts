/**
 * Soru çözümü - tip, doğrulama ve normalleştirme.
 *
 * Öğrenci bir soruyu yanlış yaptığında "doğru cevap B'ydi" ona bir şey
 * öğretmez. Öğrenmeyi sağlayan üç şey var: devredeki KURAL, çözüme giden
 * YOL ve seçtiği şıkkın NEDEN yanlış olduğu. Bu dosya o üçünü taşıyan
 * yapıyı tanımlıyor.
 *
 * ŞEMA NEDEN ESNEK: ders başına ayrı bir yapı kurmak cazip görünüyor ama
 * yanlış. Matematikte çözüm bir işlem dizisidir, tarihte bir bağlam
 * anlatımıdır, dil bilgisinde önce kural söylenip sonra şıklar elenir.
 * Üçü için üç ayrı şema yazmak, her yeni ders türünde şemayı büyütmek
 * demekti. Bunun yerine alanlar ISTEGE BAGLI: model hangi alanın o soruya
 * uyduğuna kendisi karar veriyor - `questionVisualSchema`'da görselin
 * türüne karar verdiği gibi.
 *
 *   Matematik  ->  `adimlar` dolu, `kavram` kısa (formül)
 *   Tarih      ->  `adimlar` boş, `kavram` uzun (bağlam)
 *   Dil bilgisi->  `kavram` = kuralın tanımı, `secenekler` ağırlıklı
 *
 * ONAY KAPISI YOK: çözümler toplu betikle üretiliyor ve içerik uzmanının
 * onayına girmiyor (bilinçli karar). Bu yüzden öğrenciye gösterilirken
 * yapay zekâ ürünü olduğu YAZILMALI ve eğitmen sonradan düzeltebilmeli.
 * Kapı değil, çıkış yolu.
 */

/** Çözümdeki tek bir adım. Sıra `path` dizisindeki konumdur. */
export interface SolutionStep {
  /** Adımın kendisi. Matematikte işlem, sözelde akıl yürütme. */
  text: string;
}

/**
 * Bir şıkkın değerlendirmesi.
 *
 * Doğru şık da listeye GIRER: öğrenci yalnızca kendi işaretlediğini değil,
 * doğrunun neden doğru olduğunu da okumalı. Aksi halde eleme mantığı
 * yarım kalır.
 */
export interface SolutionOption {
  /** Şık anahtarı: "A", "B", ... Soru metnindeki `options_json` ile eşleşir. */
  key: string;
  /** Bu şık doğru mu? */
  correct: boolean;
  /**
   * Neden doğru ya da neden yanlış.
   *
   * Yanlış şıklarda asıl değer burada: "C'yi seçtiysen X ile Y'yi
   * karıştırmış olabilirsin" cümlesi, doğru cevabı söylemekten daha
   * öğreticidir.
   */
  reason: string;
}

export interface QuestionSolution {
  /**
   * Devredeki kural, kavram ya da formül. ZORUNLU.
   *
   * Çözümün geri kalanı bunun uygulanmasıdır; bu olmadan öğrenci adımları
   * ezberler, kuralı öğrenmez.
   */
  concept: string;
  /**
   * Çözüme giden sıralı adımlar. İşlem gerektiren derslerde dolar,
   * gerektirmeyende boş kalır.
   */
  steps: SolutionStep[];
  /**
   * Şık şık değerlendirme. Yalnızca çoktan seçmeli sorularda dolar;
   * açık uçlu soruda boş kalır.
   */
  options: SolutionOption[];
  /** Doğru cevabın açık ve kısa gerekçesi. ZORUNLU. */
  conclusion: string;
}

/* -------------------------------------------------------------------------- */

/** Aşırı uzun metinleri kırpar; model bazen paragraf yazıyor. */
const MAX_CONCEPT = 600;
const MAX_STEP = 400;
const MAX_REASON = 400;
const MAX_CONCLUSION = 600;
/** Adım ve şık sayısı üst sınırı - bozuk çıktı arayüzü şişirmesin. */
const MAX_STEPS = 12;
const MAX_OPTIONS = 8;

function metin(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const temiz = value.trim();
  if (temiz.length === 0) return null;
  return temiz.length > limit ? temiz.slice(0, limit) : temiz;
}

/**
 * Ham veriyi (model çıktısı ya da veritabanı satırı) doğrular.
 *
 * İKI YERDEN çağrılıyor ve bu bilinçli: modelin ürettiği de, veritabanından
 * okunan da aynı kapıdan geçiyor. Şema zamanla değişirse eski satırlar
 * sessizce bozuk render edilmek yerine `null` döner ve arayüz "çözüm yok"
 * gösterir - yarım bir çözüm göstermekten iyidir.
 *
 * `concept` ya da `conclusion` yoksa çözüm yok sayılır: ikisi olmadan
 * geriye yalnızca "şu şık yanlış" listesi kalır, o da öğretmez.
 */
export function parseSolution(input: unknown): QuestionSolution | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const concept = metin(raw.concept, MAX_CONCEPT);
  const conclusion = metin(raw.conclusion, MAX_CONCLUSION);
  if (!concept || !conclusion) return null;

  const steps: SolutionStep[] = Array.isArray(raw.steps)
    ? raw.steps
        .map((item) => {
          const text =
            typeof item === "string"
              ? metin(item, MAX_STEP)
              : metin((item as Record<string, unknown>)?.text, MAX_STEP);
          return text ? { text } : null;
        })
        .filter((item): item is SolutionStep => item !== null)
        .slice(0, MAX_STEPS)
    : [];

  const options: SolutionOption[] = Array.isArray(raw.options)
    ? raw.options
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const key = metin(row.key, 4);
          const reason = metin(row.reason, MAX_REASON);
          if (!key || !reason) return null;
          return { key, correct: row.correct === true, reason };
        })
        .filter((item): item is SolutionOption => item !== null)
        .slice(0, MAX_OPTIONS)
    : [];

  return { concept, steps, options, conclusion };
}

/**
 * Çözüm öğrenciye gösterilmeye değer mi?
 *
 * Yalnızca `concept` + `conclusion` olan bir çözüm geçerlidir ama zayıftır.
 * Bu yardımcı, arayüzün "zengin çözüm" ile "asgari çözüm" ayrımı yapmasına
 * izin veriyor - ileride yeniden üretilecekleri işaretlemek için de kullanılır.
 */
export function isDetailedSolution(solution: QuestionSolution): boolean {
  return solution.steps.length > 0 || solution.options.length > 0;
}
