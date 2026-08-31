-- ---------------------------------------------------------------------------
-- Sinav kestirimi kaydi ve kalibrasyon
--
-- NE ISE YARAR
-- Sinav yayina alinmadan once simule bir sinifa cozduruluyor ve bir tahmin
-- cikiyor: "bu sinav bu sinifta ortalama %62 getirir". Bu tahmin hicbir yere
-- yazilmazsa sinav gercekten yapildiginda kimse tahminin tutup tutmadigini
-- bilemez - ve tutmayan bir tahmin, tutan bir tahminden ayirt edilemedigi
-- surece hicbir sey ifade etmez.
--
-- Bu tablo tahmini KAYDEDER. Sinav sonuclandiginda gercek ortalamayla yan
-- yana konur; sapma zamanla birikince "sanal sinif ortalama +-X puan
-- sapiyor" diye olculebilir bir guven araligi cikar. Ozelligin kendi
-- dogrulugunu olcmesinin tek yolu bu.
--
-- NEDEN JSONB
-- Raporun sekli uygulama tarafinda yasiyor (bkz. lib/exam-simulation.ts) ve
-- gelistikce degisiyor: yeni bir uyari kodu, yeni bir metrik. Bunu sutunlara
-- acmak her degisiklikte migration yazmak demekti. Kalibrasyonun ihtiyac
-- duydugu TEK sayi (`predicted_average`) ise ayri bir sutunda: sorgu onun
-- uzerinden gidiyor, jsonb yalnizca gecmis raporu geri gostermek icin.
--
-- Idempotenttir; iki kez calistirmak sorun degildir.
-- ---------------------------------------------------------------------------

create table if not exists public.exam_simulations (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,

  -- Kadro nereden geldi: hazir zit takim, egitmenin elle kurdugu sinif ya da
  -- gercek bir sinifin dijital ikizi. Kalibrasyonda onemli: ikizin sapmasi
  -- ile hazir kadronun sapmasi ayni sey degil.
  cohort_kind text not null,
  cohort_label text not null,

  -- Kadronun temsil ettigi ogrenci sayisi (agirliklarin toplami).
  student_count integer not null default 0,

  -- Kalibrasyonun karsilastirdigi sayi.
  predicted_average numeric(5, 2) not null,

  -- Raporun tamami; arayuz gecmis kestirimi oldugu gibi geri gosterebilsin.
  report jsonb not null,

  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exam_simulations_cohort_kind_check'
  ) then
    alter table public.exam_simulations
      add constraint exam_simulations_cohort_kind_check
      check (cohort_kind in ('hazir', 'elle', 'ikiz'));
  end if;
end $$;

comment on table public.exam_simulations is
  'Sinav yayina alinmadan once yapilan kestirimler. Gercek sonucla karsilastirilip kalibrasyon uretilir.';
comment on column public.exam_simulations.predicted_average is
  'Kadronun agirlikli tahmini ortalamasi (0-100). Kalibrasyon bu sutundan hesaplanir.';

create index if not exists exam_simulations_exam_idx
  on public.exam_simulations (exam_id, created_at desc);

create index if not exists exam_simulations_creator_idx
  on public.exam_simulations (created_by, created_at desc);


-- RLS ------------------------------------------------------------------------
--
-- Kestirim SINAV TASLAGI hakkinda bilgi tasir (soru metinleri rapor icinde
-- gecebilir), dolayisiyla sinavin sahibinden ve adminden baskasi gormemeli.
-- Ogrenciye hicbir kosulda acilmaz.

alter table public.exam_simulations enable row level security;

drop policy if exists "exam_simulations_select_owner" on public.exam_simulations;
create policy "exam_simulations_select_owner" on public.exam_simulations
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  );

-- Yazma yalnizca sinavin sahibi egitmene. `created_by = auth.uid()` sarti
-- baskasinin adina kayit acilmasini engelliyor.
drop policy if exists "exam_simulations_insert_owner" on public.exam_simulations;
create policy "exam_simulations_insert_owner" on public.exam_simulations
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  );

drop policy if exists "exam_simulations_delete_owner" on public.exam_simulations;
create policy "exam_simulations_delete_owner" on public.exam_simulations
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  );

-- Kestirim kaydi DEGISTIRILEMEZ: kalibrasyonun anlami tahminin sonradan
-- duzeltilememesinde. Update politikasi bilerek yok.
