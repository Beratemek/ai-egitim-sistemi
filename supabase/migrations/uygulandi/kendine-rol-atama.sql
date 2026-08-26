-- ---------------------------------------------------------------------------
-- Sistem yoneticisi kendisine de rol atayabilsin
--
-- `set_user_roles` "kendi rollerinizi degistiremezsiniz" diye reddediyordu.
-- Gerekce sistemde hic yonetici kalmamasi riskiydi; ama artik erisim yalnizca
-- ATANMIS rollerden geldigi icin yoneticinin kendine rol eklemesi normal
-- akisin parcasi - baska turlu kendi panelinden cikip egitmen paneline
-- bakamiyor.
--
-- Kisit tumuyle kaldirilmiyor, DARALTILIYOR: kendi ADMIN rolunu birakmak
-- yalnizca sistemde baska bir admin varsa mumkun. Boylece yonetici kendine
-- istedigi rolu ekleyip cikarabilir, ama son yonetici sistemi yonetilemez
-- halde birakamaz. Bu durumdan cikis yalnizca SQL Editor ile olurdu.
--
-- Onkosul: uygulandi/2026-08-22-coklu-rol.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

create or replace function public.set_user_roles(
  target_user uuid,
  new_roles public.user_role[]
)
returns public.user_role[]
language plpgsql
security definer
set search_path = public
as $$
declare
  temiz public.user_role[];
  aktif public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Rol atamasi yalnizca sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  -- Tekrarlari at, bos kume birak.
  select coalesce(array_agg(distinct r), '{}'::public.user_role[])
  into temiz
  from unnest(coalesce(new_roles, '{}'::public.user_role[])) as r;

  if cardinality(temiz) = 0 then
    raise exception 'En az bir rol secilmelidir.' using errcode = '22023';
  end if;

  -- Son yonetici kendi admin rolunu birakamaz: sistemde rol atayabilecek
  -- kimse kalmaz ve bu durumdan yalnizca SQL Editor ile cikilabilir.
  if target_user = auth.uid()
     and not ('admin' = any(temiz))
     and not exists (
       select 1 from public.users
       where id <> auth.uid() and 'admin' = any(roles)
     )
  then
    raise exception 'Sistemdeki tek yoneticisiniz; kendi yonetici rolunuzu birakamazsiniz. Once baska bir kullaniciya sistem yoneticisi rolu verin.'
      using errcode = '42501';
  end if;

  select role into aktif from public.users where id = target_user;

  if aktif is null then
    raise exception 'Kullanici bulunamadi.' using errcode = '22023';
  end if;

  -- Aktif rol artik verilmemisse ilk role dus.
  if not (aktif = any(temiz)) then
    aktif := temiz[1];
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set roles            = temiz,
      role             = aktif,
      role_status      = 'onayli',
      requested_role   = null,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return temiz;
end;
$$;

grant execute on function public.set_user_roles(uuid, public.user_role[]) to authenticated;

-- Kontrol ------------------------------------------------------------------
-- Yonetici kendi satirinda rol ekleyip cikarabilmeli; son admin ise
-- 'admin' rolunu cikarmaya calisinca 42501 almalidir.
