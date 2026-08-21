-- ---------------------------------------------------------------------------
-- Rol onayi ve rol duzenleme yetkisini `admin` rolune tasi
--
-- Rol dagitmak bir SISTEM isidir, egitim isi degil. `egitim_yoneticisi`
-- sinav ve basari istatistiklerinden sorumlu kalir; kimin hangi rolde
-- oldugu artik yalnizca `admin` tarafindan belirlenir.
--
-- Onkosul: 2026-08-22-admin-rolu-1-enum.sql ve -2a/-2b/-2c calistirilmis olmali.
-- Idempotenttir.
--
-- Calistirma: Supabase Dashboard -> SQL Editor -> New query -> yapistir -> Run
-- ---------------------------------------------------------------------------

-- 1. Rol talebini karara baglama: yalnizca admin --------------------------
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
  if not public.is_admin() then
    raise exception 'Rol talepleri yalnizca sistem yoneticisi tarafindan karara baglanir.'
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

-- 2. Rolu dogrudan degistirme (duzenleme) ---------------------------------
-- Talep beklemeden bir kullanicinin rolunu belirler. Yalnizca admin.
create or replace function public.set_user_role(
  target_user uuid,
  new_role public.user_role
)
returns public.user_role
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Rol degisikligi yalnizca sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  if target_user = auth.uid() then
    raise exception 'Kendi rolunuzu degistiremezsiniz; sistemde yonetici kalmayabilir.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.users where id = target_user) then
    raise exception 'Kullanici bulunamadi.' using errcode = '22023';
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = new_role,
      role_status      = 'onayli',
      requested_role   = null,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return new_role;
end;
$$;

grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- 3. Kontrol ---------------------------------------------------------------
-- select email, role, role_status, requested_role from public.users order by role;
