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

Klasördeki dosya adına bakma — **veritabanına sor:**

```
npm run migration:durum
```

Bu komut her migration'ın bıraktığı izi (bir sütun ya da fonksiyon) tek tek
kontrol eder ve eksik olanı söyler. Dosyanın `uygulandi/` klasörüne taşınmış
olup olmaması yalnızca bir defter kaydıdır; SQL'i çalıştırdığında dosya
kendiliğinden taşınmaz. Tek doğru ölçüt şemanın kendisi.

Şu an: **1 bekleyen** — `BEKLEYEN-1-varsayilan-rol.sql` (15/16 uygulanmış).

> Bu dosya yeni bir sütun/fonksiyon eklemez, iki fonksiyonun **gövdesini**
> değiştirir (`set_user_roles`, `review_role_request`). Durum betiği bu yüzden
> izi `users.roles` sütununun **açıklamasından** okur — PostgREST sütun
> açıklamalarını OpenAPI tanımında yayınlıyor.
