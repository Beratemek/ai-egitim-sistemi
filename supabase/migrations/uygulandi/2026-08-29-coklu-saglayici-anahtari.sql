-- ---------------------------------------------------------------------------
-- COKLU SAGLAYICI: her sağlayıcı için ayrı anahtar
--
-- NEDEN: `ai_settings` tek satirlik bir tabloydu, yani ayni anda tek bir
-- saglayici anahtari tutulabiliyordu. Musteri hem Gemini hem OpenRouter
-- anahtarina sahipse ikincisini kaydettigi anda birincisi siliniyordu ve
-- icerik uzmani yalnizca o an aktif olan saglayicinin modellerini gorebiliyordu.
--
-- Bu dosya anahtarlari AYRI bir tabloya tasir: her saglayici icin bir satir.
-- `ai_settings` ise yalnizca GENEL tercihleri tutmaya devam eder - varsayilan
-- saglayici, puanlama modeli ve simulasyon anahtari.
--
-- Boylece icerik uzmani tek listede hem Gemini hem OpenRouter modellerini
-- gorur; sectigi modelin saglayicisi ve anahtari kendiliginden kullanilir.
--
-- GUVENLIK modeli BEKLEYEN-3 ile ayni: tablo RLS ile tumuyle kapali (politika
-- yok, anon/authenticated yetkileri geri alinmis), yazma yalnizca `is_admin()`
-- dogrulayan SECURITY DEFINER fonksiyonlardan geciyor, anahtari yalnizca
-- sunucu service_role ile okuyor.
--
-- Idempotenttir: birden fazla kez calistirilabilir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Saglayici basina anahtar --------------------------------------------------

create table if not exists public.ai_provider_keys (
  provider text primary key,
  api_key text not null default '',
  base_url text not null default '',
  model_generation text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null,
  constraint ai_provider_keys_bilinen_saglayici check (
    provider in ('openai', 'anthropic', 'google', 'openrouter', 'diger')
  )
);

comment on table public.ai_provider_keys is
  'Saglayici basina API anahtari. Her saglayici en fazla bir satir; hepsi ayni anda tanimli olabilir.';
comment on column public.ai_provider_keys.model_generation is
  'Bu saglayici secildiginde varsayilan olarak kullanilacak model. Bos ise katalog varsayilani.';

alter table public.ai_provider_keys enable row level security;

revoke all on table public.ai_provider_keys from public, anon, authenticated;
grant all on table public.ai_provider_keys to service_role;

-- 2. Var olan anahtari tasi ---------------------------------------------------
--
-- BEKLEYEN-3 ile girilmis anahtar kaybolmasin. `ai_settings.api_key` silinmiyor;
-- yalnizca kopyalaniyor - dosya iki kez calistirilirsa `do nothing` sayesinde
-- yeni tablodaki (muhtemelen daha guncel) deger korunur.

insert into public.ai_provider_keys (
  provider, api_key, base_url, model_generation, updated_at, updated_by
)
select provider, api_key, base_url, model_generation, updated_at, updated_by
  from public.ai_settings
 where id
   and btrim(api_key) <> ''
on conflict (provider) do nothing;

-- 3. Anahtar kaydetme ---------------------------------------------------------
--
-- BEKLEYEN-3'teki `save_ai_settings` ile ayni kural: anahtar BOS gonderilirse
-- mevcut anahtar KORUNUR. Arayuz anahtari geri okuyamadigi icin, yalnizca
-- model degistirmek isteyen yoneticinin anahtari yeniden yazmasi gerekmemeli.

create or replace function public.save_ai_provider_key(
  target_provider text,
  new_api_key text,
  new_base_url text,
  new_model_generation text
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

  if target_provider not in ('openai', 'anthropic', 'google', 'openrouter', 'diger') then
    raise exception 'Bilinmeyen saglayici: %', target_provider
      using errcode = '22023';
  end if;

  -- "Diger" saglayici taban adres olmadan calisamaz: istek nereye gidecegini
  -- bilemez ve varsayilan olarak OpenAI'a duser.
  if target_provider = 'diger'
     and coalesce(btrim(new_base_url), '') = '' then
    raise exception 'OpenAI uyumlu saglayici icin taban adres zorunludur.'
      using errcode = '22023';
  end if;

  insert into public.ai_provider_keys as mevcut (
    provider, api_key, base_url, model_generation, updated_at, updated_by
  )
  values (
    target_provider,
    coalesce(btrim(new_api_key), ''),
    coalesce(btrim(new_base_url), ''),
    coalesce(btrim(new_model_generation), ''),
    now(),
    auth.uid()
  )
  on conflict (provider) do update set
    api_key = case
      when nullif(btrim(new_api_key), '') is null then mevcut.api_key
      else btrim(new_api_key)
    end,
    base_url = excluded.base_url,
    model_generation = excluded.model_generation,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

comment on function public.save_ai_provider_key(text, text, text, text) is
  'Bir saglayicinin anahtarini/modelini kaydeder. Yalnizca sistem yoneticisi. Bos anahtar mevcudu korur.';

-- 4. Anahtar silme ------------------------------------------------------------

create or replace function public.clear_ai_provider_key(target_provider text)
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

  delete from public.ai_provider_keys where provider = target_provider;

  -- Silinen saglayici ayni zamanda VARSAYILAN ise, uygulama anahtarsiz bir
  -- saglayiciya isaret etmis olurdu. Anahtari duran baska bir saglayici varsa
  -- varsayilani ona cekiyoruz; yoksa ayar oldugu gibi kalir ve uygulama
  -- simulasyon moduna duser.
  update public.ai_settings
     set provider = coalesce(
           (select provider from public.ai_provider_keys
             where btrim(api_key) <> ''
             order by updated_at desc
             limit 1),
           provider
         ),
         updated_at = now(),
         updated_by = auth.uid()
   where id and provider = target_provider;
end;
$$;

comment on function public.clear_ai_provider_key(text) is
  'Bir saglayicinin anahtarini siler; varsayilan oysa anahtari olan baska bir saglayiciya gecer.';

-- 5. Genel tercihler ----------------------------------------------------------
--
-- `save_ai_settings` (BEKLEYEN-3) anahtari da yaziyordu; anahtarlar artik ayri
-- tabloda oldugu icin genel tercihler icin ANAHTARA DOKUNMAYAN yeni bir
-- fonksiyon gerekiyor. Eskisi geriye donuk uyumluluk icin duruyor.

create or replace function public.save_ai_defaults(
  new_provider text,
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

  insert into public.ai_settings (
    id, provider, model_generation, model_grading, mock_mode, updated_at, updated_by
  )
  values (
    true,
    new_provider,
    coalesce(btrim(new_model_generation), ''),
    coalesce(btrim(new_model_grading), ''),
    coalesce(new_mock_mode, false),
    now(),
    auth.uid()
  )
  on conflict (id) do update set
    provider = excluded.provider,
    model_generation = excluded.model_generation,
    model_grading = excluded.model_grading,
    mock_mode = excluded.mock_mode,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

comment on function public.save_ai_defaults(text, text, text, boolean) is
  'Varsayilan saglayici, modeller ve simulasyon anahtari. API anahtarlarina DOKUNMAZ.';

revoke all on function public.save_ai_provider_key(text, text, text, text) from public, anon;
revoke all on function public.clear_ai_provider_key(text) from public, anon;
revoke all on function public.save_ai_defaults(text, text, text, boolean) from public, anon;

grant execute on function public.save_ai_provider_key(text, text, text, text) to authenticated;
grant execute on function public.clear_ai_provider_key(text) to authenticated;
grant execute on function public.save_ai_defaults(text, text, text, boolean) to authenticated;

commit;
