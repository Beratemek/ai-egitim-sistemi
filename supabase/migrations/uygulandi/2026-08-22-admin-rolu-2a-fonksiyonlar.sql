-- ADIM 2a/3 - admin yardimci fonksiyonlari
-- Once 1. adim (enum) calistirilmis olmali. Idempotenttir.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role::text = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.can_manage_exam(target_exam uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin()
    or public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  );
$$;

create or replace function public.review_role_request(target_user uuid, approve boolean)
returns public.role_status language plpgsql security definer set search_path = public as $$
declare
  wanted public.user_role;
  result public.role_status;
begin
  if not (public.is_admin() or public.has_role('egitim_yoneticisi')) then
    raise exception 'Bu islem icin yetkiniz yok.' using errcode = '42501';
  end if;

  select requested_role into wanted from public.users where id = target_user;

  if wanted is null then
    raise exception 'Bu kullanicinin bekleyen bir rol talebi yok.' using errcode = '22023';
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
