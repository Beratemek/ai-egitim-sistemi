# Migration dosyaları

## Nasıl çalışır

Bu klasörde **doğrudan çalıştırılacak dosyalar durur.** Supabase SQL Editor'de
yukarıdan aşağı, numara sırasıyla çalıştır:

```
BEKLEYEN-1-...  →  BEKLEYEN-2-...  →  BEKLEYEN-3-...  →  BEKLEYEN-4-...  →  BEKLEYEN-5-...
```

Çalıştırdıktan sonra dosyayı `uygulandi/` klasörüne taşı. Böylece bu klasörde
her zaman **yalnızca yapılacak iş** kalır.

## Neden `uygulandi/` klasörü var?

Silmek yerine taşındılar çünkü bu dosyalar veritabanı şemasının tek yazılı
kaydı. Bir politikanın neden öyle yazıldığını ya da bir sütunun ne zaman
eklendiğini yalnızca oradan okuyabiliyoruz. Ama günlük işte gözünün önünde
olmalarına gerek yok.

Kaydı başka bir yerde tuttuğuna karar verirsen `uygulandi/` klasörünü tümüyle
silebilirsin; uygulamanın çalışmasına etkisi olmaz.

## Yanlışlıkla iki kez çalıştırırsan?

Sorun olmaz. Dosyaların hepsi **idempotent** yazıldı: `create table if not
exists`, `create or replace function`, `drop policy if exists` + `create
policy`. İkinci çalıştırma aynı sonucu üretir.

Tek istisna enum değeri ekleyen adımlar (`admin-rolu-1-enum`); onlar da
`if not exists` ile korunuyor.

## Sıra neden önemli?

Sonraki dosyalar öncekilerin oluşturduğu fonksiyonlara dayanıyor. Örneğin
`BEKLEYEN-3` içindeki politikalar `can_review_exam()` fonksiyonunu kullanıyor;
o fonksiyon `uygulandi/2026-08-22-ders-yetkisi.sql` içinde oluşturuluyor.
Atlanan bir adım "function does not exist" hatası verir.

## Şu an bekleyenler

| Dosya | Ne yapar | Neden önemli |
|---|---|---|
| `BEKLEYEN-1-sinav-suresi.sql` | `exams.duration_minutes` + süre kısıtının sunucuda zorlanması | Bunsuz süre alanı kaydedilemez; ayrıca süre yalnızca sayaçta kalırsa istemciden süresiz cevap gönderilebilir |

Çalıştırıp çalıştırmadığından emin değilsen tekrar çalıştır — zararı yok.
