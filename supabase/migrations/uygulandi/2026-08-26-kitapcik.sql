-- ---------------------------------------------------------------------------
-- Kitapcik (A/B/C/D)
--
-- Ayni sinav her ogrenciye ayni sirayla gitmez: dort kitapcik vardir, sorular
-- ve siklar kitapciga gore yer degistirir. Amac yan yana oturan iki ogrencinin
-- ekraninda ayni soruyu ayni yerde gormemesi.
--
-- SAKLANAN TEK SEY HARFTIR. Soru ve sik sirasi bir tabloda tutulmaz;
-- `(sinav kimligi + kitapcik harfi)` tohumundan deterministik uretilir
-- (bkz. lib/booklet.ts). Boylece sinav basina yuzlerce satirlik ikinci bir
-- gercek olusmaz ve sunucu ile istemci ayni siziyi bagimsiz hesaplayabilir.
--
-- HARF OGRENCIYE GOSTERILMEZ. Ogrenci hangi kitapcigi cozdugunu bilmez;
-- sutun yalnizca sunucunun karistirmayi hesaplamasi ve egitmenin kontrol
-- ekraninda gormesi icindir.
--
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Sutun -----------------------------------------------------------------

alter table public.exam_assignments
  add column if not exists booklet char(1);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exam_assignments_booklet_check'
  ) then
    alter table public.exam_assignments
      add constraint exam_assignments_booklet_check
      check (booklet is null or booklet in ('A', 'B', 'C', 'D'));
  end if;
end $$;

comment on column public.exam_assignments.booklet is
  'Ogrencinin kitapcigi (A/B/C/D). Soru ve sik sirasi bundan turetilir; ogrenciye GOSTERILMEZ.';


-- 2. Dagitim: her zaman EN AZ kullanilmis harf -----------------------------
--
-- Round-robin yerine "en az dolu olani sec" kullaniliyor. Sonuc esit dagilimda
-- ayni (20 ogrenci -> 5/5/5/5) ama bir atama silinip yenisi eklendiginde de
-- denge kendiliginden korunuyor; sira sayacina dayanan bir cozum orada
-- bozulurdu. Esitlik durumunda harf sirasi belirleyici, yani sonuc
-- deterministik: once A dolar.

create or replace function public.assign_booklet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Harf disaridan verilmisse (or. veri tasima) dokunma.
  if new.booklet is not null then
    return new;
  end if;

  select t.harf into new.booklet
  from unnest(array['A', 'B', 'C', 'D']) as t(harf)
  order by (
    select count(*)
    from public.exam_assignments mevcut
    where mevcut.exam_id = new.exam_id
      and mevcut.booklet = t.harf
  ), t.harf
  limit 1;

  return new;
end;
$$;

drop trigger if exists exam_assignments_booklet_ata on public.exam_assignments;
create trigger exam_assignments_booklet_ata
  before insert on public.exam_assignments
  for each row execute function public.assign_booklet();


-- 3. Mevcut atamalar -------------------------------------------------------
--
-- Tetikleyici yalnizca YENI satirlarda calisir; bu migration'dan once acilmis
-- atamalarin harfi yok. Atama sirasina gore esit dagitilir.

with sirali as (
  select
    id,
    row_number() over (partition by exam_id order by assigned_at, id) - 1 as sira
  from public.exam_assignments
  where booklet is null
)
update public.exam_assignments hedef
   set booklet = (array['A', 'B', 'C', 'D'])[(sirali.sira % 4) + 1]
  from sirali
 where hedef.id = sirali.id;
