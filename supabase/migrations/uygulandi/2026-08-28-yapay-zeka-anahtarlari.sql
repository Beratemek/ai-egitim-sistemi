-- ---------------------------------------------------------------------------
-- Yapay zeka saglayici anahtarlari: musteri kendi anahtarini kendi girsin
--
-- NEDEN: Anahtarin tek kaynagi `.env` dosyasiydi. Bu, anahtari degistirmek
-- icin sunucuya erisim + yeniden baslatma demek; musteri kendi OpenAI /
-- Anthropic / Gemini / OpenRouter anahtarini hicbir sekilde giremiyordu.
-- Artik anahtar burada durur ve sistem yoneticisi arayuzden yonetir
-- (/dashboard/sistem/api).
--
-- GUVENLIK - iki katmanli:
--
--   1. TABLO TUMUYLE KAPALI. RLS aciktir ve HICBIR politika yoktur; ustelik
--      anon/authenticated rollerinden tum yetkiler geri alinir. Yani oturum
--      acmis bir kullanicinin -sistem yoneticisi DAHIL- tarayicisi bu tabloyu
--      okuyamaz. Anahtari yalnizca sunucu, service_role ile okur.
--      Anahtar tarayiciya hic inmedigi icin XSS ya da sizmis bir anon anahtar
--      da ise yaramaz.
--
--   2. YAZMA yalnizca SECURITY DEFINER fonksiyonlardan gecer ve fonksiyon
--      yetkiyi kendi govdesinde `is_admin()` ile dogrular. Arayuzu atlayip
--      PostgREST'e dogrudan istek atmak sonucu degistirmez.
--
-- Anahtar tabloda DUZ METIN durur. Bunu bilerek yapiyoruz: sifrelesek bile
-- anahtari cozecek gizli deger yine ayni sunucuda olurdu, yani gercek bir
-- koruma katmani eklemezdi. Asil koruma yukaridaki iki maddedir; yedeklerin
-- ve service_role anahtarinin gizliligi bu yuzden onemlidir.
--
-- Idempotenttir: birden fazla kez calistirilabilir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Tablo ------------------------------------------------------------------
--
-- TEK SATIR: `id` sutunu boolean ve birincil anahtar, uzerinde de `check (id)`
-- var. Yani tabloda yalnizca `id = true` olan bir satir bulunabilir. Bu sayede
-- "hangi kayit gecerli" sorusu hic dogmaz; ayri bir "aktif" sutunu ya da
-- tarihe gore secim mantigi gerekmez.

create table if not exists public.ai_settings (
  id boolean primary key default true,
  provider text not null default 'openai',
  api_key text not null default '',
  base_url text not null default '',
  model_generation text not null default '',
  model_grading text not null default '',
  mock_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  constraint ai_settings_tek_satir check (id),
  constraint ai_settings_bilinen_saglayici check (
    provider in ('openai', 'anthropic', 'google', 'openrouter', 'diger')
  )
);

comment on table public.ai_settings is
  'Yapay zeka saglayici ayarlari. TEK satir tutar; arayuzden sistem yoneticisi duzenler.';
comment on column public.ai_settings.id is
  'Daima true. Birincil anahtar + check kisiti tabloyu tek satira kilitler.';
comment on column public.ai_settings.api_key is
  'Saglayici API anahtari. Yalnizca service_role okuyabilir; arayuze maskelenmis gider.';
comment on column public.ai_settings.base_url is
  'OpenAI uyumlu saglayicilarin taban adresi (OpenRouter, Groq, yerel LLM). Bos ise varsayilan.';
comment on column public.ai_settings.model_generation is
  'Soru uretiminde kullanilan model. Bos ise saglayicinin varsayilani.';
comment on column public.ai_settings.model_grading is
  'Cevap puanlamasinda kullanilan model. Bos ise uretim modeli kullanilir.';
comment on column public.ai_settings.mock_mode is
  'true ise gercek model cagrilmaz, deterministik sahte veri uretilir (demo/egitim).';

-- 2. Erisim -----------------------------------------------------------------
--
-- RLS aciliyor ama POLITIKA YAZILMIYOR. RLS acik + politika yok = tabloya
-- kimse erisemez (service_role haric; o RLS'i bypass eder). Politika
-- eklenmemesi bir eksiklik degil, bilincli tasarimdir.

alter table public.ai_settings enable row level security;

-- Supabase yeni tablolara varsayilan yetkileri anon/authenticated'a verir;
-- burada acikca geri aliyoruz ki API anahtari PostgREST uzerinden istenemesin.
revoke all on table public.ai_settings from public, anon, authenticated;
grant all on table public.ai_settings to service_role;

-- 3. Kaydetme ---------------------------------------------------------------
--
-- `new_api_key` BOS gonderilirse mevcut anahtar KORUNUR. Sebep: arayuz
-- anahtari geri okuyamiyor (okuyamamali). Yonetici yalnizca modeli degistirmek
-- istediginde anahtari yeniden yazmak zorunda kalsaydi, her kucuk duzenleme
-- anahtari panoya kopyalamayi gerektirirdi - anahtarin sizmasinin en olagan
-- yolu da budur.

create or replace function public.save_ai_settings(
  new_provider text,
  new_api_key text,
  new_base_url text,
  new_model_generation text,
  new_model_grading text,
  new_mock_mode boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu islem icin sistem yoneticisi olmalisiniz.'
      using errcode = '42501';
  end if;

  if new_provider not in ('openai', 'anthropic', 'google', 'openrouter', 'diger') then
    raise exception 'Bilinmeyen saglayici: %', new_provider
      using errcode = '22023';
  end if;

  -- "Diger" saglayici taban adres olmadan calisamaz: istek nereye gidecegini
  -- bilemez ve varsayilan olarak OpenAI'a duser - yani yanlis servise gecerli
  -- olmayan bir anahtar gonderilir.
  if new_provider = 'diger'
     and coalesce(btrim(new_base_url), '') = '' then
    raise exception 'OpenAI uyumlu saglayici icin taban adres zorunludur.'
      using errcode = '22023';
  end if;

  insert into public.ai_settings as mevcut (
    id,
    provider,
    api_key,
    base_url,
    model_generation,
    model_grading,
    mock_mode,
    updated_at,
    updated_by
  )
  values (
    true,
    new_provider,
    coalesce(btrim(new_api_key), ''),
    coalesce(btrim(new_base_url), ''),
    coalesce(btrim(new_model_generation), ''),
    coalesce(btrim(new_model_grading), ''),
    coalesce(new_mock_mode, false),
    now(),
    auth.uid()
  )
  on conflict (id) do update set
    provider = excluded.provider,
    api_key = case
      when nullif(btrim(new_api_key), '') is null then mevcut.api_key
      else btrim(new_api_key)
    end,
    base_url = excluded.base_url,
    model_generation = excluded.model_generation,
    model_grading = excluded.model_grading,
    mock_mode = excluded.mock_mode,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

comment on function public.save_ai_settings(text, text, text, text, text, boolean) is
  'Yapay zeka ayarlarini kaydeder. Yalnizca sistem yoneticisi. Bos anahtar mevcut anahtari korur.';

-- 4. Anahtari silme ---------------------------------------------------------
--
-- Ayri bir fonksiyon: "anahtari sil" ile "anahtari degistirme" ayni cagriyla
-- ifade edilemez, cunku bos deger yukarida KORUMA anlamina geliyor.

create or replace function public.clear_ai_api_key()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu islem icin sistem yoneticisi olmalisiniz.'
      using errcode = '42501';
  end if;

  update public.ai_settings
     set api_key = '',
         updated_at = now(),
         updated_by = auth.uid()
   where id;
end;
$$;

comment on function public.clear_ai_api_key() is
  'Kayitli API anahtarini siler; uygulama .env yedegine ya da simulasyon moduna doner.';

revoke all on function public.save_ai_settings(text, text, text, text, text, boolean)
  from public, anon;
revoke all on function public.clear_ai_api_key() from public, anon;

grant execute on function public.save_ai_settings(text, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.clear_ai_api_key() to authenticated;

commit;
