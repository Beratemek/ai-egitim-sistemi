-- ===========================================================================
--  YAPAY ZEKA DESTEKLI EGITIM SISTEMI - VERITABANI SEMASI
--  Supabase / PostgreSQL
--
--  !!! BU DOSYAYI CALISTIRMAYIN !!!
--
--  Eskiden "tamamini SQL Editor'e yapistirip calistirin" diyordu. ARTIK
--  DOGRU DEGIL: dosya semanin gerisinde kaldi ve calistirmak sistemi geriye
--  alir. Somut ornekler:
--
--    * `roles` sutunu bu dosyada HIC YOK - coklu rol ozelligi (bkz.
--      migrations/uygulandi/2026-08-22-coklu-rol.sql) burada yok sayilir.
--    * `handle_new_user` ve `request_role` ESKI kurali tasiyor: ogrenci
--      secen kullanici dogrudan 'onayli' oluyor. Oysa gecerli kural
--      "her rol onaya duser" (tum-roller-onaya-dussun.sql). Bu dosyayi
--      calistirmak yeni kayitlarin onay kuyruguna DUSMEMESINE yol acar.
--
--  SEMANIN GERCEK KAYDI: supabase/migrations/ klasoru.
--    - Bekleyen isler: BEKLEYEN-*.sql (numara sirasiyla calistirilir)
--    - Gecmis: uygulandi/ (calistirilmis, tarihsel kayit)
--    Ayrintili anlatim icin migrations/OKUBENI.md.
--
--  Bu dosya yalnizca bir REFERANS olarak duruyor: tablolarin ve politikalarin
--  NEDEN oyle yazildigini anlatan uzun gerekceler burada. Okumak icin acin,
--  calistirmak icin degil.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ===========================================================================
-- 1. ENUM TIPLERI
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum (
      'icerik_uzmani',      -- Icerik Uzmani: metin ve kazanim yukler
      'egitmen',            -- Egitmen: sorulari inceler, onaylar, puan onaylar
      'ogrenci',            -- Ogrenci: sinava girer, cevap yazar
      'egitim_yoneticisi',  -- Egitim Yoneticisi: istatistikleri gorur
      'admin'               -- Sistem Yoneticisi: GIZLI rol, her seye yetkili
    );
  end if;

  -- Semayi daha once kurmus veritabanlarinda enum'a 'admin' eklemek icin
  -- ayri bir adim gerekir; bkz. migrations/2026-08-22-admin-rolu-1-enum.sql
  -- (PostgreSQL yeni enum degerini ayni islemde kullandirtmaz).

  if not exists (select 1 from pg_type where typname = 'role_status') then
    create type public.role_status as enum (
      'secilmedi',    -- ilk giristen sonra rolunu henuz secmedi
      'beklemede',    -- rol talep etti, egitim yoneticisi onayi bekliyor
      'onayli',       -- rolu gecerli
      'reddedildi'    -- talebi reddedildi; yeni talep acabilir
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum ('test', 'acik_uclu');
  end if;

  if not exists (select 1 from pg_type where typname = 'question_status') then
    create type public.question_status as enum (
      'taslak',      -- AI uretti, egitmen henuz incelemedi
      'onayli',      -- Egitmen onayladi, havuzda kullanilabilir
      'reddedildi'   -- Egitmen reddetti
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum (
      'gonderildi',         -- Ogrenci gonderdi, AI degerlendirmedi
      'ai_degerlendirildi', -- AI puanladi, egitmen onayi bekliyor
      'egitmen_onayli'      -- Egitmen puani onayladi/duzeltti (nihai)
    );
  end if;

  -- DENEYAP Teknoloji Atolyeleri ders dallari.
  -- lib/deneyap.ts icindeki DENEYAP_CATEGORIES ile ayni sirada tutulmalidir.
  if not exists (select 1 from pg_type where typname = 'deneyap_category') then
    create type public.deneyap_category as enum (
      'yazilim_teknolojileri',
      'siber_guvenlik',
      'ileri_robotik',
      'enerji_teknolojileri',
      'tasarim_ve_uretim',
      'mobil_uygulama',
      'elektronik_programlama_ve_iot',
      'yapay_zeka',
      'havacilik_ve_uzay',
      'robotik_ve_kodlama',
      'nanoteknoloji_ve_malzeme'
    );
  end if;
end
$$;

-- ===========================================================================
-- 2. TABLOLAR
-- ===========================================================================

-- --- users -----------------------------------------------------------------
-- auth.users kaydini genisleten profil tablosu. id = auth.users.id
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'ogrenci',
  -- Rol onay akisi: ogrenci disindaki roller egitim yoneticisi onayi ister.
  role_status public.role_status not null default 'onayli',
  requested_role   public.user_role,
  role_reviewed_by uuid,
  role_reviewed_at timestamptz,
  full_name   text not null default '',
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.users is 'Kullanici profilleri ve rolleri (auth.users 1-1 uzantisi).';
comment on column public.users.role_status is 'Rol onay durumu; ogrenci disindaki roller onay ister.';
comment on column public.users.requested_role is 'Kullanicinin talep ettigi rol; onaylaninca role kopyalanir.';

-- Semayi daha once kurmus veritabanlari icin.
alter table public.users add column if not exists role_status public.role_status not null default 'onayli';
alter table public.users add column if not exists requested_role public.user_role;
alter table public.users add column if not exists role_reviewed_by uuid;
alter table public.users add column if not exists role_reviewed_at timestamptz;

create index if not exists users_role_status_idx on public.users (role_status);

-- --- learning_outcomes (kazanimlar) ----------------------------------------
-- Icerik uzmaninin yukledigi kaynak metin + kazanim.
create table if not exists public.learning_outcomes (
  id           uuid primary key default gen_random_uuid(),
  topic        text not null,
  outcome_text text not null,                -- kazanim ifadesi
  source_text  text not null default '',     -- AI'a verilecek baglam metni
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.learning_outcomes is 'Icerik uzmani tarafindan yuklenen metin ve kazanimlar.';

-- --- questions -------------------------------------------------------------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  subject        text not null default 'Ders atanmamis',  -- ders: dal ile konu arasi kirilim
  topic          text not null,
  text           text not null,
  type           public.question_type not null,
  options_json   jsonb,                      -- test icin: [{"key":"A","text":"..."}]
  correct_answer text,                       -- test icin dogru sikkin key'i
  rubric         text,                       -- acik uclu icin degerlendirme rubrigi
  status         public.question_status not null default 'taslak',
  outcome_id     uuid references public.learning_outcomes (id) on delete set null,
  created_by     uuid references public.users (id) on delete set null,
  reviewed_by    uuid references public.users (id) on delete set null,
  ai_generated   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Tip bazli tutarlilik: test sorusunda sik + dogru cevap, acik ucluda rubrik zorunlu
  constraint questions_type_shape_check check (
    (type = 'test'      and options_json is not null and correct_answer is not null)
    or
    (type = 'acik_uclu' and rubric is not null)
  )
);

comment on column public.questions.subject is 'Ders adi. Havuz dal -> ders -> konu -> soru olarak kirilir.';

-- Semayi daha once kurmus veritabanlari icin: sutunu sonradan ekle.
alter table public.questions add column if not exists subject text not null default 'Ders atanmamis';
create index if not exists questions_subject_idx on public.questions (subject);

comment on table public.questions is 'Soru havuzu. AI uretir, egitmen onaylar.';

-- Atolye dali kolonu. Tablo daha once olusmus kurulumlarda da eklenmesi icin
-- "create table" yerine "alter table ... if not exists" kullaniliyor.
alter table public.questions
  add column if not exists category public.deneyap_category;

alter table public.learning_outcomes
  add column if not exists category public.deneyap_category;

create index if not exists questions_category_idx on public.questions (category);

create index if not exists questions_status_idx on public.questions (status);
create index if not exists questions_topic_idx  on public.questions (topic);
create index if not exists questions_type_idx   on public.questions (type);

-- --- exams -----------------------------------------------------------------
create table if not exists public.exams (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null default '',
  instructor_id uuid not null references public.users (id) on delete cascade,
  is_published  boolean not null default false,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.exams is 'Egitmenin olusturdugu sinavlar.';

create index if not exists exams_instructor_idx on public.exams (instructor_id);

-- --- exam_questions (N:N) --------------------------------------------------
create table if not exists public.exam_questions (
  exam_id      uuid not null references public.exams (id) on delete cascade,
  question_id  uuid not null references public.questions (id) on delete cascade,
  position     integer not null default 0,
  points       numeric(5,2) not null default 10,
  primary key (exam_id, question_id)
);

comment on table public.exam_questions is 'Sinav <-> Soru eslesmesi (cok-a-cok).';

create index if not exists exam_questions_exam_idx on public.exam_questions (exam_id);

-- --- submissions -----------------------------------------------------------
create table if not exists public.submissions (
  id                        uuid primary key default gen_random_uuid(),
  exam_id                   uuid not null references public.exams (id) on delete cascade,
  question_id               uuid references public.questions (id) on delete set null,
  student_id                uuid not null references public.users (id) on delete cascade,
  answer_text               text not null default '',
  ai_score                  numeric(5,2),
  ai_feedback               text,
  ai_criteria_json          jsonb not null default '[]'::jsonb,
  instructor_approved_score numeric(5,2),
  instructor_note           text,
  status                    public.submission_status not null default 'gonderildi',
  reviewed_by               uuid references public.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint submissions_ai_score_range check (
    ai_score is null or (ai_score >= 0 and ai_score <= 100)
  ),
  constraint submissions_approved_score_range check (
    instructor_approved_score is null
    or (instructor_approved_score >= 0 and instructor_approved_score <= 100)
  )
);

comment on table public.submissions is 'Ogrenci cevaplari, AI puani ve egitmen onayi.';

create index if not exists submissions_exam_idx    on public.submissions (exam_id);
create index if not exists submissions_student_idx on public.submissions (student_id);
create index if not exists submissions_status_idx  on public.submissions (status);

-- Bir ogrenci ayni sinavdaki ayni soruyu yalnizca bir kez yanitlar.
-- Constraint yerine UNIQUE INDEX kullaniliyor: "if not exists" destekledigi icin
-- bu dosya tekrar calistirilabilir kaliyor.
create unique index if not exists submissions_one_answer_per_question_uniq
  on public.submissions (exam_id, question_id, student_id);

-- ===========================================================================
-- 3. TRIGGER'LAR
-- ===========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- Yeni auth.users kaydi olustugunda public.users profilini otomatik ac.
--
-- Rol artik dogrudan verilmez, TALEP edilir:
--   * metadata'da rol yoksa (ornegin Google ile giris) -> 'secilmedi',
--     kullanici /hosgeldiniz ekraninda kim oldugunu secer.
--   * ogrenci secilmisse dogrudan onaylanir.
--   * diger roller egitim yoneticisi onayina dusulur; onaya kadar etkin rol
--     'ogrenci' kalir, boylece onay beklerken yetkili alanlara giremez.
-- BAYAT - GECERLI DEGIL. Guncel hali icin:
--   migrations/uygulandi/tum-roller-onaya-dussun.sql
--   migrations/BEKLEYEN-2-kayit-onayi-garanti.sql
-- Buradaki surum ogrenciyi dogrudan 'onayli' yapar; gecerli kural her rolu
-- onay kuyruguna dusurmektir. `roles` sutununu da doldurmuyor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested public.user_role;
  status    public.role_status;
begin
  begin
    requested := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    requested := null;
  end;

  if requested is null then
    status := 'secilmedi';
  elsif requested = 'ogrenci' then
    status := 'onayli';
  else
    status := 'beklemede';
  end if;

  insert into public.users (id, role, role_status, requested_role, full_name, email)
  values (
    new.id,
    'ogrenci',
    status,
    requested,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- 4. YARDIMCI FONKSIYONLAR (RLS icin)
--    SECURITY DEFINER -> RLS'i bypass eder, boylece politika ozyinelemesi olmaz.
-- ===========================================================================

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.has_role(target public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = target
  );
$$;

-- ---------------------------------------------------------------------------
-- Rol onay akisi
--
-- Rol ve rol durumu kullanicinin KENDI eliyle degistirilemez; aksi halde
-- herkes kendi satirini guncelleyip yonetici olabilirdi. Iki kapi var:
--   * request_role()       -> kullanici kendi adina rol TALEP eder
--   * review_role_request()-> yalnizca egitim yoneticisi karar verir
-- Ikisi de SECURITY DEFINER; asagidaki tetikleyici dogrudan yazmayi engeller.
-- ---------------------------------------------------------------------------

/**
 * Dogrudan rol degisikligini engeller.
 *
 * Yalnizca SECURITY DEFINER fonksiyonlarindan gelen degisiklige izin verir;
 * onlar `public.role_change_allowed` bayragini acar.
 */
create or replace function public.guard_role_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.role_status is distinct from old.role_status
      or new.requested_role is distinct from old.requested_role)
     and coalesce(current_setting('app.role_change_allowed', true), 'off') <> 'on'
  then
    raise exception 'Rol alanlari dogrudan degistirilemez; request_role / review_role_request kullanin.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_role_columns on public.users;
create trigger users_guard_role_columns
  before update on public.users
  for each row execute function public.guard_role_columns();

/**
 * Kullanicinin kendi adina rol talep etmesi.
 * Ogrenci dogrudan onaylanir; diger roller egitim yoneticisi onayina duser.
 */
-- BAYAT - GECERLI DEGIL; bkz. handle_new_user ustundeki not.
create or replace function public.request_role(target public.user_role)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.role_status;
begin
  if auth.uid() is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  result := case when target = 'ogrenci' then 'onayli' else 'beklemede' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = case when target = 'ogrenci' then 'ogrenci' else 'ogrenci' end,
      requested_role   = target,
      role_status      = result,
      role_reviewed_by = null,
      role_reviewed_at = null,
      updated_at       = now()
  where id = auth.uid();

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

/**
 * Egitim yoneticisinin bir rol talebini onaylamasi / reddetmesi.
 * Onaylanirsa talep edilen rol etkin role kopyalanir.
 */
create or replace function public.review_role_request(
  target_user uuid,
  approve boolean
)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted public.user_role;
  result public.role_status;
begin
  if not public.has_role('egitim_yoneticisi') then
    raise exception 'Bu islem icin egitim yoneticisi olmaniz gerekiyor.'
      using errcode = '42501';
  end if;

  select requested_role into wanted from public.users where id = target_user;

  if wanted is null then
    raise exception 'Bu kullanicinin bekleyen bir rol talebi yok.'
      using errcode = '22023';
  end if;

  result := case when approve then 'onayli' else 'reddedildi' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- ===========================================================================
-- 5. ROW LEVEL SECURITY
-- ===========================================================================

alter table public.users             enable row level security;
alter table public.learning_outcomes enable row level security;
alter table public.questions         enable row level security;
alter table public.exams             enable row level security;
alter table public.exam_questions    enable row level security;
alter table public.submissions       enable row level security;

-- --- users -----------------------------------------------------------------
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
  for select using (
    id = auth.uid()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- learning_outcomes -----------------------------------------------------
drop policy if exists "outcomes_select_authenticated" on public.learning_outcomes;
create policy "outcomes_select_authenticated" on public.learning_outcomes
  for select using (auth.uid() is not null);

drop policy if exists "outcomes_write_icerik_uzmani" on public.learning_outcomes;
create policy "outcomes_write_icerik_uzmani" on public.learning_outcomes
  for all using (public.has_role('icerik_uzmani'))
  with check (public.has_role('icerik_uzmani'));

-- --- questions -------------------------------------------------------------
-- Ogrenci sadece ONAYLI sorulari gorur. Dogru cevabin sizmamasi icin
-- uygulama katmani ogrenciye select ederken correct_answer/rubric istemez.
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select using (
    status = 'onayli'
    or public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "questions_insert" on public.questions;
create policy "questions_insert" on public.questions
  for insert with check (
    public.has_role('egitmen') or public.has_role('icerik_uzmani')
  );

-- Onay / red icerik uzmaninin isidir; egitmen de yazim duzeltmesi
-- yapabilsin diye ikisine birden acik.
drop policy if exists "questions_update_egitmen" on public.questions;
drop policy if exists "questions_update" on public.questions;
create policy "questions_update" on public.questions
  for update using (
    public.has_role('icerik_uzmani') or public.has_role('egitmen')
  )
  with check (
    public.has_role('icerik_uzmani') or public.has_role('egitmen')
  );

drop policy if exists "questions_delete_egitmen" on public.questions;
create policy "questions_delete_egitmen" on public.questions
  for delete using (public.has_role('egitmen'));

-- --- exams -----------------------------------------------------------------
drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    is_published
    or instructor_id = auth.uid()
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "exams_write_egitmen" on public.exams;
create policy "exams_write_egitmen" on public.exams
  for all using (public.has_role('egitmen') and instructor_id = auth.uid())
  with check (public.has_role('egitmen') and instructor_id = auth.uid());

-- --- exam_questions --------------------------------------------------------
drop policy if exists "exam_questions_select" on public.exam_questions;
create policy "exam_questions_select" on public.exam_questions
  for select using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and (
          e.is_published
          or e.instructor_id = auth.uid()
          or public.has_role('egitim_yoneticisi')
        )
    )
  );

drop policy if exists "exam_questions_write_egitmen" on public.exam_questions;
create policy "exam_questions_write_egitmen" on public.exam_questions
  for all using (
    exists (select 1 from public.exams e where e.id = exam_id and e.instructor_id = auth.uid())
  )
  with check (
    exists (select 1 from public.exams e where e.id = exam_id and e.instructor_id = auth.uid())
  );

-- --- submissions -----------------------------------------------------------
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    student_id = auth.uid()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "submissions_insert_ogrenci" on public.submissions;
create policy "submissions_insert_ogrenci" on public.submissions
  for insert with check (
    student_id = auth.uid() and public.has_role('ogrenci')
  );

-- Ogrenci sadece egitmen onayindan once kendi cevabini duzeltebilir.
drop policy if exists "submissions_update_ogrenci" on public.submissions;
create policy "submissions_update_ogrenci" on public.submissions
  for update using (student_id = auth.uid() and status = 'gonderildi')
  with check (student_id = auth.uid());

drop policy if exists "submissions_update_egitmen" on public.submissions;
create policy "submissions_update_egitmen" on public.submissions
  for update using (public.has_role('egitmen'))
  with check (public.has_role('egitmen'));

-- ===========================================================================
-- 6. ISTATISTIK GORUNUMU (Egitim Yoneticisi dashboard'u icin)
-- ===========================================================================

-- security_invoker = true SART: aksi halde view, sahibinin (postgres) yetkisiyle
-- calisir ve alttaki tablolarin RLS politikalarini ATLAR; boylece herhangi bir
-- ogrenci tum sinavlarin istatistiklerini gorebilirdi.
create or replace view public.exam_statistics
  with (security_invoker = true)
as
select
  e.id                                                            as exam_id,
  e.title                                                         as exam_title,
  e.instructor_id,
  count(distinct s.student_id)                                    as student_count,
  count(s.id)                                                     as submission_count,
  count(s.id) filter (where s.status = 'egitmen_onayli')          as approved_count,
  round(avg(coalesce(s.instructor_approved_score, s.ai_score)), 2) as average_score
from public.exams e
left join public.submissions s on s.exam_id = e.id
group by e.id, e.title, e.instructor_id;

-- ===========================================================================
-- 7. DEMO VERI (opsiyonel)
--    Auth kullanicilari Supabase Dashboard > Authentication > Users uzerinden
--    olusturulup, asagidaki UPDATE ile rolleri atanabilir:
--
--    update public.users set role = 'egitmen', full_name = 'Ayse Yilmaz'
--    where email = 'egitmen@ornek.com';
-- ===========================================================================

insert into public.learning_outcomes (topic, outcome_text, source_text)
select
  'Fotosentez',
  'Ogrenci fotosentezin isik ve karanlik evrelerini aciklar.',
  'Fotosentez, bitkilerin isik enerjisini kimyasal enerjiye donusturdugu surectir. Isik evresi tilakoit zarda, karanlik evre (Calvin dongusu) stromada gerceklesir.'
where not exists (select 1 from public.learning_outcomes where topic = 'Fotosentez');

-- ===========================================================================
-- 8. SORU TERCIH HAFIZASI  (AI'in icerik uzmanindan ogrenmesi)
--
--    Icerik uzmani AI'in urettigi her taslagi begenebilir (like) veya
--    reddedebilir (dislike). Bu kayitlar bir sonraki uretimde modele
--    ornek olarak geri verilir: begenilenler "bu tarzda uret", reddedilenler
--    "bu tarzdan kacin" olarak. Ince ayar (fine-tuning) degil, baglam ici
--    ogrenme (few-shot) - hemen etki eder ve geri alinabilir.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'preference_verdict') then
    create type public.preference_verdict as enum ('begendi', 'begenmedi');
  end if;
end
$$;

create table if not exists public.question_preferences (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  verdict      public.preference_verdict not null,

  -- Ornegin kendisi: modele few-shot olarak geri verilir.
  question_text  text not null,
  question_type  public.question_type not null,
  topic          text not null default '',
  difficulty     text not null default 'orta',
  options_json   jsonb,
  rubric         text,

  -- Uzmanin serbest yorumu ("celdiriciler zayif", "cok kolay" gibi).
  note         text,
  outcome_id   uuid references public.learning_outcomes (id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.question_preferences is
  'Icerik uzmaninin AI taslaklarina verdigi begeni/red geri bildirimi; sonraki uretimlere ornek olarak beslenir.';

create index if not exists question_preferences_user_idx
  on public.question_preferences (user_id, created_at desc);
create index if not exists question_preferences_verdict_idx
  on public.question_preferences (verdict);

alter table public.question_preferences enable row level security;

-- Herkes kendi tercihlerini yonetir; egitmen ve yonetici okuyabilir.
drop policy if exists "preferences_select" on public.question_preferences;
create policy "preferences_select" on public.question_preferences
  for select using (
    user_id = auth.uid()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "preferences_insert_own" on public.question_preferences;
create policy "preferences_insert_own" on public.question_preferences
  for insert with check (user_id = auth.uid());

drop policy if exists "preferences_update_own" on public.question_preferences;
create policy "preferences_update_own" on public.question_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "preferences_delete_own" on public.question_preferences;
create policy "preferences_delete_own" on public.question_preferences
  for delete using (user_id = auth.uid());

-- ===========================================================================
-- 9. OGRENCI SINAV ATAMA / OTURUM AKISI
-- ===========================================================================
-- Ogrenci sinav atama, oturum ve nihai puan modeli.
-- Idempotent olacak sekilde yazilmistir; mevcut yayinlanmis sinav/cevaplari
-- yeni modele geriye uyumlu olarak tasir.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'exam_attempt_status' and n.nspname = 'public'
  ) then
    create type public.exam_attempt_status as enum (
      'devam_ediyor',
      'degerlendiriliyor',
      'sonuclandi'
    );
  end if;
end
$$;

alter table public.submissions
  add column if not exists ai_criteria_json jsonb not null default '[]'::jsonb;

create table if not exists public.exam_assignments (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams (id) on delete cascade,
  student_id  uuid not null references public.users (id) on delete cascade,
  assigned_by uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at      timestamptz,
  unique (exam_id, student_id)
);

create table if not exists public.exam_attempts (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  student_id     uuid not null references public.users (id) on delete cascade,
  status         public.exam_attempt_status not null default 'devam_ediyor',
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  completed_at   timestamptz,
  earned_points  numeric(8,2),
  total_points   numeric(8,2),
  final_score    numeric(5,2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (exam_id, student_id),
  constraint exam_attempt_final_score_range check (
    final_score is null or (final_score >= 0 and final_score <= 100)
  ),
  -- Nihai not TAM SAYI; gerekcesi submissions'taki ayni adli kisitta.
  constraint exam_attempts_final_score_tam_sayi check (
    final_score is null or final_score = round(final_score)
  ),
  constraint exam_attempt_result_consistency check (
    status <> 'sonuclandi'
    or (
      submitted_at is not null
      and completed_at is not null
      and final_score is not null
      and earned_points is not null
      and total_points is not null
    )
  )
);

create index if not exists exam_assignments_student_idx
  on public.exam_assignments (student_id, assigned_at desc);
create index if not exists exam_attempts_student_idx
  on public.exam_attempts (student_id, updated_at desc);
create index if not exists exam_attempts_exam_idx
  on public.exam_attempts (exam_id, status);

drop trigger if exists exam_attempts_set_updated_at on public.exam_attempts;
create trigger exam_attempts_set_updated_at
  before update on public.exam_attempts
  for each row execute function public.set_updated_at();

alter table public.exam_assignments enable row level security;
alter table public.exam_attempts enable row level security;

create or replace function public.is_exam_assigned_to_current_user(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.exam_assignments a
    where a.exam_id = target_exam and a.student_id = auth.uid()
  );
$$;

create or replace function public.can_manage_exam(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  );
$$;

revoke all on function public.is_exam_assigned_to_current_user(uuid) from public;
revoke all on function public.can_manage_exam(uuid) from public;
grant execute on function public.is_exam_assigned_to_current_user(uuid) to authenticated;
grant execute on function public.can_manage_exam(uuid) to authenticated;


drop policy if exists "exam_assignments_select" on public.exam_assignments;
create policy "exam_assignments_select" on public.exam_assignments
  for select using (
    student_id = auth.uid()
    or public.can_manage_exam(exam_id)
  );

drop policy if exists "exam_assignments_write" on public.exam_assignments;
create policy "exam_assignments_write" on public.exam_assignments
  for all using (
    public.can_manage_exam(exam_id)
  )
  with check (
    public.can_manage_exam(exam_id)
  );

drop policy if exists "exam_attempts_select" on public.exam_attempts;
create policy "exam_attempts_select" on public.exam_attempts
  for select using (
    student_id = auth.uid()
    or public.can_manage_exam(exam_id)
  );

-- Ogrenci attempt satirini dogrudan degistiremez. Durum gecisleri asagidaki
-- security-definer fonksiyonlardan yapilir; nihai puani istemciden yazamaz.

create or replace function public.start_exam_attempt(target_exam uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  attempt_id uuid;
begin
  if actor is null then raise exception 'Oturum acmaniz gerekiyor.'; end if;

  if not exists (
    select 1
    from public.exam_assignments a
    join public.exams e on e.id = a.exam_id
    where a.exam_id = target_exam
      and a.student_id = actor
      and e.is_published
      and (e.starts_at is null or e.starts_at <= now())
      and (coalesce(a.due_at, e.ends_at) is null or coalesce(a.due_at, e.ends_at) >= now())
  ) then
    raise exception 'Bu sinav size atanmamis veya cevaplamaya acik degil.';
  end if;

  insert into public.exam_attempts (exam_id, student_id)
  values (target_exam, actor)
  on conflict (exam_id, student_id) do nothing;

  select id into attempt_id
  from public.exam_attempts
  where exam_id = target_exam and student_id = actor;

  return attempt_id;
end;
$$;

create or replace function public.submit_exam_attempt(target_exam uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  attempt_id uuid;
  question_count integer;
  evaluated_count integer;
begin
  if actor is null then raise exception 'Oturum acmaniz gerekiyor.'; end if;

  select count(*) into question_count
  from public.exam_questions
  where exam_id = target_exam;

  select count(*) into evaluated_count
  from public.submissions
  where exam_id = target_exam
    and student_id = actor
    and question_id is not null
    and status in ('ai_degerlendirildi', 'egitmen_onayli');

  if question_count = 0 or evaluated_count < question_count then
    raise exception 'Tum cevaplar degerlendirmeye gonderilmeden sinav teslim edilemez.';
  end if;

  update public.exam_attempts
  set status = 'degerlendiriliyor', submitted_at = coalesce(submitted_at, now())
  where exam_id = target_exam
    and student_id = actor
    and status = 'devam_ediyor'
  returning id into attempt_id;

  if attempt_id is null then
    select id into attempt_id from public.exam_attempts
    where exam_id = target_exam and student_id = actor;
  end if;

  return attempt_id;
end;
$$;

create or replace function public.recalculate_exam_attempt_result(
  target_exam uuid,
  target_student uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  question_count integer;
  approved_count integer;
  earned numeric(8,2);
  total numeric(8,2);
begin
  if not (
    public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  ) then
    raise exception 'Bu sonucu hesaplama yetkiniz yok.';
  end if;

  select count(*), coalesce(sum(points), 0)
  into question_count, total
  from public.exam_questions
  where exam_id = target_exam;

  select
    count(*),
    coalesce(sum(eq.points * s.instructor_approved_score / 100.0), 0)
  into approved_count, earned
  from public.exam_questions eq
  join public.submissions s
    on s.exam_id = eq.exam_id
   and s.question_id = eq.question_id
   and s.student_id = target_student
  where eq.exam_id = target_exam
    and s.status = 'egitmen_onayli'
    and s.instructor_approved_score is not null;

  if question_count = 0 or approved_count < question_count or total <= 0 then
    return false;
  end if;

  update public.exam_attempts
  set
    status = 'sonuclandi',
    submitted_at = coalesce(submitted_at, now()),
    completed_at = now(),
    -- Ogrenciye "25 / 30 puan" diye gosterilen sayilar; ikisi de tam.
    earned_points = round(earned),
    total_points = round(total),
    -- BIREYSEL not TAM SAYI: 83.33 gibi bir puan ogrenciye bir sey anlatmiyor.
    -- Ondalik yalnizca sinif/topluluk ortalamasinda anlamli.
    final_score = round(earned / total * 100.0)
  where exam_id = target_exam and student_id = target_student;

  return found;
end;
$$;

revoke all on function public.start_exam_attempt(uuid) from public;
revoke all on function public.submit_exam_attempt(uuid) from public;
revoke all on function public.recalculate_exam_attempt_result(uuid, uuid) from public;
grant execute on function public.start_exam_attempt(uuid) to authenticated;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
grant execute on function public.recalculate_exam_attempt_result(uuid, uuid) to authenticated;

-- Mevcut MVP verisini kaybetmeden yeni modele gecis: yayinlanmis sinavlar
-- mevcut ogrencilere atanir, cevabi olan ogrenciler icin attempt olusturulur.
insert into public.exam_assignments (exam_id, student_id, assigned_by, due_at)
select e.id, u.id, e.instructor_id, e.ends_at
from public.exams e
cross join public.users u
where e.is_published and u.role = 'ogrenci'
on conflict (exam_id, student_id) do nothing;

insert into public.exam_attempts (
  exam_id,
  student_id,
  status,
  started_at,
  submitted_at
)
select
  s.exam_id,
  s.student_id,
  case
    when count(*) filter (where s.status <> 'gonderildi') >=
         (select count(*) from public.exam_questions eq where eq.exam_id = s.exam_id)
      then 'degerlendiriliyor'::public.exam_attempt_status
    else 'devam_ediyor'::public.exam_attempt_status
  end,
  min(s.created_at),
  case
    when count(*) filter (where s.status <> 'gonderildi') >=
         (select count(*) from public.exam_questions eq where eq.exam_id = s.exam_id)
      then max(s.updated_at)
    else null
  end
from public.submissions s
group by s.exam_id, s.student_id
on conflict (exam_id, student_id) do nothing;

-- Daha once tum cevaplari onaylanmis sinavlarin agirlikli nihai sonucunu da tasir.
with existing_results as (
  select
    eq.exam_id,
    s.student_id,
    count(*) as approved_count,
    (select count(*) from public.exam_questions all_eq where all_eq.exam_id = eq.exam_id)
      as question_count,
    sum(eq.points * s.instructor_approved_score / 100.0) as earned,
    sum(eq.points) as total
  from public.exam_questions eq
  join public.submissions s
    on s.exam_id = eq.exam_id
   and s.question_id = eq.question_id
  where s.status = 'egitmen_onayli'
    and s.instructor_approved_score is not null
  group by eq.exam_id, s.student_id
)
update public.exam_attempts a
set
  status = 'sonuclandi',
  submitted_at = coalesce(a.submitted_at, a.updated_at),
  completed_at = coalesce(a.completed_at, a.updated_at),
  earned_points = round(r.earned),
  total_points = round(r.total),
  final_score = round(r.earned / r.total * 100.0)
from existing_results r
where a.exam_id = r.exam_id
  and a.student_id = r.student_id
  and r.question_count > 0
  and r.approved_count >= r.question_count
  and r.total > 0;
create or replace function public.get_student_exam_questions(target_exam uuid)
returns table (
  id uuid,
  subject text,
  topic text,
  text text,
  type public.question_type,
  options_json jsonb,
  outcome_id uuid,
  "position" integer,
  points numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.subject,
    q.topic,
    q.text,
    q.type,
    q.options_json,
    q.outcome_id,
    eq.position as "position",
    eq.points
  from public.exam_assignments a
  join public.exam_attempts attempt
    on attempt.exam_id = a.exam_id
   and attempt.student_id = a.student_id
  join public.exam_questions eq on eq.exam_id = a.exam_id
  join public.questions q on q.id = eq.question_id
  where a.exam_id = target_exam
    and a.student_id = auth.uid()
    and q.status = 'onayli'
  order by eq.position;
$$;

revoke all on function public.get_student_exam_questions(uuid) from public;
grant execute on function public.get_student_exam_questions(uuid) to authenticated;

-- Ogrenci yalnizca kendisine atanmis yayinlanmis sinavlari ve baglarini gorur.
drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    instructor_id = auth.uid()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (
      is_published
      and public.is_exam_assigned_to_current_user(exams.id)
    )
  );

drop policy if exists "exam_questions_select" on public.exam_questions;
create policy "exam_questions_select" on public.exam_questions
  for select using (
    public.can_manage_exam(exam_id)
    or public.has_role('icerik_uzmani')
    or public.is_exam_assigned_to_current_user(exam_id)
  );

commit;

-- Ogrenci degerlendirme verisinin sinav tamamen sonuclanmadan sizmasini
-- engeller. Bu migration uygulanmadan once sunucuya SUPABASE_SERVICE_ROLE_KEY
-- eklenmelidir; AI puanlama yazmalari artik yalnizca guvenli sunucu istemcisiyle
-- yapilir.

begin;

-- Ogrenci kendi cevap metnini her zaman gorebilir. AI puani, rubrik kirilimi,
-- egitmen notu ve nihai durum ise ancak exam_attempts.sonuclandi oldugunda acilir.
create or replace function public.get_my_submissions(target_exam uuid default null)
returns table (
  id uuid,
  exam_id uuid,
  question_id uuid,
  student_id uuid,
  answer_text text,
  ai_score numeric,
  ai_feedback text,
  ai_criteria_json jsonb,
  instructor_approved_score numeric,
  instructor_note text,
  status public.submission_status,
  reviewed_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.exam_id,
    s.question_id,
    s.student_id,
    s.answer_text,
    case when a.status = 'sonuclandi' then s.ai_score else null end,
    case when a.status = 'sonuclandi' then s.ai_feedback else null end,
    case when a.status = 'sonuclandi' then s.ai_criteria_json else '[]'::jsonb end,
    case when a.status = 'sonuclandi' then s.instructor_approved_score else null end,
    case when a.status = 'sonuclandi' then s.instructor_note else null end,
    case
      when a.status = 'sonuclandi' then s.status
      when s.status = 'gonderildi' then 'gonderildi'::public.submission_status
      else 'ai_degerlendirildi'::public.submission_status
    end,
    case when a.status = 'sonuclandi' then s.reviewed_by else null end,
    s.created_at,
    s.updated_at
  from public.submissions s
  left join public.exam_attempts a
    on a.exam_id = s.exam_id and a.student_id = s.student_id
  where s.student_id = auth.uid()
    and (target_exam is null or s.exam_id = target_exam)
  order by s.created_at desc;
$$;

revoke all on function public.get_my_submissions(uuid) from public;
grant execute on function public.get_my_submissions(uuid) to authenticated;

-- RLS tek basina UPDATE sirasinda kolon bazli degisikligi kisitlamaz. Bu
-- tetikleyici ogrencinin istemciden AI puani/status yazmasini, soruyu veya
-- ogrenciyi degistirmesini ve kapali bir attempt'a cevap eklemesini engeller.
create or replace function public.guard_student_submission_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role isteklerinde auth.uid() null olur; sunucu puanlama akisi bu
  -- nedenle asagidaki ogrenci kisitlarina girmez.
  if auth.uid() is null or auth.uid() <> new.student_id then
    return new;
  end if;

  if not public.has_role('ogrenci') then
    raise exception 'Yalnizca ogrenci kendi cevabini kaydedebilir.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.exam_assignments assignment
    join public.exam_attempts attempt
      on attempt.exam_id = assignment.exam_id
     and attempt.student_id = assignment.student_id
    join public.exams exam on exam.id = assignment.exam_id
    join public.exam_questions exam_question
      on exam_question.exam_id = assignment.exam_id
     and exam_question.question_id = new.question_id
    where assignment.exam_id = new.exam_id
      and assignment.student_id = new.student_id
      and attempt.status = 'devam_ediyor'
      and exam.is_published
      and (exam.starts_at is null or exam.starts_at <= now())
      and (
        coalesce(assignment.due_at, exam.ends_at) is null
        or coalesce(assignment.due_at, exam.ends_at) >= now()
      )
  ) then
    raise exception 'Sinav oturumu cevap kaydetmeye acik degil.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'gonderildi'
       or new.ai_score is not null
       or new.ai_feedback is not null
       or new.ai_criteria_json <> '[]'::jsonb
       or new.instructor_approved_score is not null
       or new.instructor_note is not null
       or new.reviewed_by is not null
    then
      raise exception 'Degerlendirme alanlari ogrenci tarafindan yazilamaz.'
        using errcode = '42501';
    end if;
  elsif new.exam_id is distinct from old.exam_id
     or new.question_id is distinct from old.question_id
     or new.student_id is distinct from old.student_id
     or new.status is distinct from old.status
     or new.ai_score is distinct from old.ai_score
     or new.ai_feedback is distinct from old.ai_feedback
     or new.ai_criteria_json is distinct from old.ai_criteria_json
     or new.instructor_approved_score is distinct from old.instructor_approved_score
     or new.instructor_note is distinct from old.instructor_note
     or new.reviewed_by is distinct from old.reviewed_by
  then
    raise exception 'Ogrenci yalnizca taslak cevap metnini degistirebilir.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_guard_student_write on public.submissions;
create trigger submissions_guard_student_write
  before insert or update on public.submissions
  for each row execute function public.guard_student_submission_write();

-- Dogru cevap ve rubrik kolonlari tablo REST istegiyle okunamaz. Ogrenci sinav
-- sorularini yalnizca get_student_exam_questions() guvenli RPC'sinden alir.
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select using (
    public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
  );

-- Ham submission satiri ara onaylari ve AI geribildirimini sizdirir. Ogrenci
-- icin tek okuma kapisi yukaridaki alanlari maskeleyen RPC'dir.
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

commit;


-- ===========================================================================
-- 8. GIZLI SISTEM ROLU: admin
--
-- `admin` kayit ve rol secim ekranlarinda gorunmez, yalnizca veritabanindan
-- atanir. Sitedeki her panele girer ve tum tablolarda okuma/yazma yetkisine
-- sahiptir. Asagidaki tanimlar yukaridaki politikalari BILEREK ezer.
-- ===========================================================================

-- 1. Yardimci: cagiran kullanici admin mi? -----------------------------------
-- role::text karsilastirmasi bilincli: enum literali kullanilmadigi icin bu
-- fonksiyon 1. adimin ayni oturumda calistirilip calistirilmadigindan
-- etkilenmez.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role::text = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 2. Sinav yonetimi yardimcisi -----------------------------------------------
create or replace function public.can_manage_exam(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_admin()
    or public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  );
$$;

-- 3. Rol talebi karara baglama: admin de onaylayabilsin ----------------------
create or replace function public.review_role_request(
  target_user uuid,
  approve boolean
)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted public.user_role;
  result public.role_status;
begin
  if not (public.is_admin() or public.has_role('egitim_yoneticisi')) then
    raise exception 'Bu islem icin egitim yoneticisi olmaniz gerekiyor.'
      using errcode = '42501';
  end if;

  select requested_role into wanted from public.users where id = target_user;

  if wanted is null then
    raise exception 'Bu kullanicinin bekleyen bir rol talebi yok.'
      using errcode = '22023';
  end if;

  result := case when approve then 'onayli' else 'reddedildi' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- 4. RLS politikalari --------------------------------------------------------
-- Her politikaya `public.is_admin()` eklenir; mevcut kurallar korunur.

-- --- users -----------------------------------------------------------------
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
  for select using (
    id = auth.uid()
    or public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

-- --- learning_outcomes -----------------------------------------------------
drop policy if exists "outcomes_write_icerik_uzmani" on public.learning_outcomes;
create policy "outcomes_write_icerik_uzmani" on public.learning_outcomes
  for all using (public.is_admin() or public.has_role('icerik_uzmani'))
  with check (public.is_admin() or public.has_role('icerik_uzmani'));

-- --- questions -------------------------------------------------------------
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select using (
    public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "questions_insert" on public.questions;
create policy "questions_insert" on public.questions
  for insert with check (
    public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
  );

drop policy if exists "questions_update_egitmen" on public.questions;
drop policy if exists "questions_update" on public.questions;
create policy "questions_update" on public.questions
  for update using (
    public.is_admin()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitmen')
  )
  with check (
    public.is_admin()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitmen')
  );

drop policy if exists "questions_delete_egitmen" on public.questions;
create policy "questions_delete_egitmen" on public.questions
  for delete using (public.is_admin() or public.has_role('egitmen'));

-- --- exams -----------------------------------------------------------------
drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    public.is_admin()
    or instructor_id = auth.uid()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (
      is_published
      and public.is_exam_assigned_to_current_user(exams.id)
    )
  );

drop policy if exists "exams_write_egitmen" on public.exams;
create policy "exams_write_egitmen" on public.exams
  for all using (
    public.is_admin()
    or (public.has_role('egitmen') and instructor_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.has_role('egitmen') and instructor_id = auth.uid())
  );

-- --- exam_questions --------------------------------------------------------
drop policy if exists "exam_questions_select" on public.exam_questions;
create policy "exam_questions_select" on public.exam_questions
  for select using (
    public.is_admin()
    or public.can_manage_exam(exam_id)
    or public.has_role('icerik_uzmani')
    or public.is_exam_assigned_to_current_user(exam_id)
  );

drop policy if exists "exam_questions_write_egitmen" on public.exam_questions;
create policy "exam_questions_write_egitmen" on public.exam_questions
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  );

-- --- submissions -----------------------------------------------------------
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "submissions_update_egitmen" on public.submissions;
create policy "submissions_update_egitmen" on public.submissions
  for update using (public.is_admin() or public.has_role('egitmen'))
  with check (public.is_admin() or public.has_role('egitmen'));

-- --- question_preferences --------------------------------------------------
drop policy if exists "preferences_select" on public.question_preferences;
create policy "preferences_select" on public.question_preferences
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );


-- ===========================================================================
-- 9. VERI SIZINTISI DUZELTMELERI
--    Asagidaki tanimlar yukaridaki ayni adli politikalari BILEREK ezer.
-- ===========================================================================

-- 1. question_preferences: her egitmen HERKESIN tercihini okuyabiliyordu ----
--
-- Tablo yalnizca sayac tutmuyor; `question_text`, `options_json` ve `rubric`
-- alanlarini tasiyor. Politikadaki `has_role('egitmen')` dali yuzunden
-- herhangi bir egitmen, TUM icerik uzmanlarinin begendigi/reddettigi soru
-- taslaklarini rubrikleriyle birlikte okuyabiliyordu.
--
-- Bu tablo icerik uzmaninin KENDI tarz hafizasi: baskasinin kaydini gormesi
-- icin bir urun gerekcesi yok. Kendi kaydi + sistem yoneticisi yeterli.
drop policy if exists "preferences_select" on public.question_preferences;
create policy "preferences_select" on public.question_preferences
  for select using (
    user_id = auth.uid()
    or public.is_admin()
  );

-- 2. learning_outcomes: ogrenci de kaynak metni okuyabiliyordu --------------
--
-- Politika `auth.uid() is not null` idi, yani oturum acan HERKES. Kazanim
-- kaydi `source_text` tasiyor - sorularin uretildigi ham ders metni. Ogrenci
-- arayuzu bunu hicbir yerde gostermiyor; okuma hakki da olmamali.
drop policy if exists "outcomes_select_authenticated" on public.learning_outcomes;
create policy "outcomes_select_authenticated" on public.learning_outcomes
  for select using (
    public.is_admin()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );


-- ===========================================================================
-- 10. OGRENCI CALISMA PLANI
-- ===========================================================================

create table if not exists public.student_study_plan_items (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.users (id) on delete cascade,
  recommendation_key text not null,
  title              text not null,
  context            text,
  action             text,
  evidence           text,
  outcome_id         uuid,
  latest_exam_id     uuid,
  status             text not null default 'baslanmadi',
  saved_at           timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint student_study_plan_status_check check (
    status in ('baslanmadi', 'calisiliyor', 'tamamlandi')
  ),
  constraint student_study_plan_recommendation_unique unique (
    student_id,
    recommendation_key
  )
);

create index if not exists student_study_plan_student_updated_idx
  on public.student_study_plan_items (student_id, updated_at desc);

drop trigger if exists student_study_plan_set_updated_at
  on public.student_study_plan_items;
create trigger student_study_plan_set_updated_at
  before update on public.student_study_plan_items
  for each row execute function public.set_updated_at();

alter table public.student_study_plan_items enable row level security;

drop policy if exists "student_study_plan_select_own"
  on public.student_study_plan_items;
create policy "student_study_plan_select_own"
  on public.student_study_plan_items
  for select using (student_id = auth.uid());

drop policy if exists "student_study_plan_insert_own"
  on public.student_study_plan_items;
create policy "student_study_plan_insert_own"
  on public.student_study_plan_items
  for insert with check (student_id = auth.uid());

drop policy if exists "student_study_plan_update_own"
  on public.student_study_plan_items;
create policy "student_study_plan_update_own"
  on public.student_study_plan_items
  for update using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "student_study_plan_delete_own"
  on public.student_study_plan_items;
create policy "student_study_plan_delete_own"
  on public.student_study_plan_items
  for delete using (student_id = auth.uid());

grant select, insert, update, delete
  on public.student_study_plan_items to authenticated;
