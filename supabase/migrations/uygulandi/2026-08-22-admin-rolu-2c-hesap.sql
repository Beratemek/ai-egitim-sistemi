-- ADIM 2c/3 - admin@t3.com hesabini admin rolune tasi
-- Once 1, 2a ve 2b calistirilmis olmali.

do $$
begin
  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
     set role = 'admin', role_status = 'onayli', requested_role = null
   where email = 'admin@t3.com';

  perform set_config('app.role_change_allowed', 'off', true);
end $$;

select email, role, role_status from public.users order by role;
