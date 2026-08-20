-- ===========================================================================
--  YAPAY ZEKA DESTEKLI EGITIM SISTEMI - VERITABANI SEMASI
--  Supabase / PostgreSQL
--
--  Kullanim: Supabase Dashboard > SQL Editor icine bu dosyanin tamamini
--  yapistirip calistirin. Dosya idempotent'tir (tekrar calistirilabilir).
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
      'egitim_yoneticisi'   -- Egitim Yoneticisi: istatistikleri gorur
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
  full_name   text not null default '',
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.users is 'Kullanici profilleri ve rolleri (auth.users 1-1 uzantisi).';

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

comment on table public.questions is 'Soru havuzu. AI uretir, egitmen onaylar.';

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
-- Rol, kayit sirasinda gonderilen raw_user_meta_data->>'role' degerinden okunur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  begin
    requested_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    requested_role := 'ogrenci';
  end;

  insert into public.users (id, role, full_name, email)
  values (
    new.id,
    coalesce(requested_role, 'ogrenci'),
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

drop policy if exists "questions_update_egitmen" on public.questions;
create policy "questions_update_egitmen" on public.questions
  for update using (public.has_role('egitmen'))
  with check (public.has_role('egitmen'));

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
