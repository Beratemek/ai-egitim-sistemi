-- ---------------------------------------------------------------------------
-- Varsayilan sure (60 dk) ve otomatik puan dagitimi (toplam 100)
--
-- Iki varsayilan:
--   1. Yeni sinav 60 dakikayla baslar. Egitmen degistirebilir.
--   2. Puanlar soru sayisina gore 100 uzerinden bolusur: 20 soruda 5, 4
--      soruda 25. Tam bolunmezse artan puan bastaki sorulara birer birer
--      dagitilir - 3 soruda 34/33/33, toplam yine 100.
--
-- KRITIK NOKTA: egitmen puanlari ELLE duzenlediyse, sonradan soru eklendiginde
-- o duzenleme SILINMEMELI. Bu yuzden `points_auto` bayragi var: otomatik
-- dagitim yalnizca bayrak aciksa calisir, egitmen bir puana dokundugu anda
-- bayrak kapanir ve puanlar bir daha kendiliginden degismez.
-- Egitmen "esit dagit" diyerek bayragi yeniden acabilir.
--
-- Onkosul: uygulandi/... (BEKLEYEN-1-sinav-suresi.sql once calistirilmali)
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Varsayilan sure -------------------------------------------------------
alter table public.exams
  alter column duration_minutes set default 60;

-- Mevcut sinavlarda da sure gorunsun; hepsi suresizdi.
update public.exams set duration_minutes = 60 where duration_minutes is null;

-- 2. Puan dagitimi otomatik mi? -------------------------------------------
alter table public.exams
  add column if not exists points_auto boolean not null default true;

comment on column public.exams.points_auto is
  'Puanlar soru sayisina gore kendiliginden mi dagitilsin? Egitmen bir puani elle degistirince false olur.';

-- 3. Dagitim fonksiyonu ----------------------------------------------------
create or replace function public.redistribute_exam_points(target_exam uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  adet   integer;
  taban  integer;
  artan  integer;
begin
  select count(*) into adet
  from public.exam_questions
  where exam_id = target_exam;

  if adet = 0 then
    return 0;
  end if;

  -- 100'den fazla soru varsa herkese 1 puan bile versek toplam 100'u asar.
  -- Puan sifir olamayacagi icin (check kisiti) tabani 1'de tutuyoruz;
  -- toplam 100 degil soru sayisi kadar olur.
  if adet > 100 then
    update public.exam_questions
    set points = 1
    where exam_id = target_exam;
    return adet;
  end if;

  taban := 100 / adet;
  artan := 100 - taban * adet;

  -- Artan puan bastaki sorulara birer birer dagitilir: 3 soru -> 34/33/33.
  update public.exam_questions hedef
  set points = taban + case when sirali.sira <= artan then 1 else 0 end
  from (
    select question_id,
           row_number() over (order by position, question_id) as sira
    from public.exam_questions
    where exam_id = target_exam
  ) as sirali
  where hedef.exam_id = target_exam
    and hedef.question_id = sirali.question_id;

  return 100;
end;
$$;

grant execute on function public.redistribute_exam_points(uuid) to authenticated;

-- 4. Soru eklenince/cikinca kendiliginden dagit ---------------------------
--
-- Tetikleyici SATIR bazli. Toplu eklemede her satir icin bir kez calisir;
-- 20 soruluk bir ekleme 20 dagitim demek. Sinav olceginde bu kabul edilebilir
-- ve karsiliginda kural HER YOLDA gecerli oluyor - eylemden de, elle
-- yazmadan da. `points` UPDATE'inde tetiklenmedigi icin ozyineleme yok.
create or replace function public.auto_distribute_exam_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hedef uuid := coalesce(new.exam_id, old.exam_id);
begin
  if exists (select 1 from public.exams where id = hedef and points_auto) then
    perform public.redistribute_exam_points(hedef);
  end if;

  return null;
end;
$$;

drop trigger if exists exam_questions_auto_points on public.exam_questions;
create trigger exam_questions_auto_points
  after insert or delete on public.exam_questions
  for each row execute function public.auto_distribute_exam_points();

-- 5. Egitmen "esit dagit" diyebilsin --------------------------------------
create or replace function public.reset_exam_points(target_exam uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_exam(target_exam) then
    raise exception 'Bu sinavin puanlarini degistirme yetkiniz yok.'
      using errcode = '42501';
  end if;

  update public.exams set points_auto = true where id = target_exam;

  return public.redistribute_exam_points(target_exam);
end;
$$;

grant execute on function public.reset_exam_points(uuid) to authenticated;

-- 6. Mevcut sinavlarin puanlarini bir kez duzelt --------------------------
--
-- Hepsi soru basina 10 puandi; 5 soruluk sinavin toplami 50, 6 soruluk
-- sinavin 60 ediyordu. Ayni sinav farkli soru sayilariyla farkli tavana
-- sahipti, yuzde hesabi yaniltiyordu.
do $$
declare
  kayit record;
begin
  for kayit in select id from public.exams where points_auto loop
    perform public.redistribute_exam_points(kayit.id);
  end loop;
end;
$$;

commit;

-- 7. Kontrol ---------------------------------------------------------------
-- select e.title, e.duration_minutes, e.points_auto,
--        count(q.*) as soru, sum(q.points) as toplam
-- from public.exams e
-- left join public.exam_questions q on q.exam_id = e.id
-- group by e.id order by e.created_at desc;
