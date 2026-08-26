-- ---------------------------------------------------------------------------
-- Varsayilan rol = kisiye atanan ILK rol
--
-- SORUN: `set_user_roles` gelen diziyi `array_agg(distinct r)` ile temizliyordu.
-- `distinct` diziyi ENUM SIRASINA gore siralar - yani sistem yoneticisi hangi
-- sirayla atarsa atasin sonuc hep su siraya duşuyordu:
--
--     icerik_uzmani -> egitmen -> ogrenci -> egitim_yoneticisi -> admin
--
-- Sonuc: `roles[1]` her zaman 'icerik_uzmani' oluyor, atama sirasi
-- veritabanina hic ulasmiyordu. Yonetim ekraninda herkesin yaninda
-- "Icerik Uzmani +3" yazmasinin sebebi buydu. Arayuz sirayi dogru
-- gonderiyordu; bozan taraf bu fonksiyondu.
--
-- KURAL (bu migration'dan sonra):
--   users.roles[1] = VARSAYILAN rol. Atama sirasindaki ilk roldur.
--   users.role     = AKTIF rol. Varsayilandan baslar; kullanici kendisi
--                    degistirebilir (set_active_role). Rol kumesi
--                    degistiginde yeniden varsayilana duser.
--
-- Onkosul: 2026-08-22-coklu-rol.sql, tum-roller-onaya-dussun.sql,
--          kendine-rol-atama.sql (son-yonetici kisiti buradan gelir ve
--          asagida AYNEN korunur - bu dosya onu geri almaz).
-- Idempotenttir.
--
-- NOT (geriye donuk veri): Eski kayitlarin atama sirasi KAYITLI DEGIL -
-- enum sirasina gomulmus durumda ve geri getirilemez. Bu yuzden migration
-- mevcut satirlari bilerek ELLEMEZ; yanlis bir sirayi "duzeltmis" gibi
-- yapip kullanicilari rastgele panellere tasimaktansa oldugu gibi birakir.
-- Bir kullanicinin varsayilanini degistirmek icin yonetim ekranindan
-- rollerini istenen sirayla yeniden atamak yeterlidir.
-- ---------------------------------------------------------------------------

-- 1. Rol kumesi: SIRA KORUNUR --------------------------------------------
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
begin
  if not public.is_admin() then
    raise exception 'Rol atamasi yalnizca sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  -- Tekrarlari at ama SIRAYI KORU: her rolun ILK gorundugu konum esas alinir.
  -- `array_agg(distinct ...)` burada kullanilamaz; siralamayi kendisi yapar.
  with girdi as (
    select r, min(ord) as ord
    from unnest(coalesce(new_roles, '{}'::public.user_role[]))
         with ordinality as t(r, ord)
    group by r
  )
  select coalesce(array_agg(r order by ord), '{}'::public.user_role[])
  into temiz
  from girdi;

  if cardinality(temiz) = 0 then
    raise exception 'En az bir rol secilmelidir.' using errcode = '22023';
  end if;

  -- Son yonetici kendi admin rolunu birakamaz: sistemde rol atayabilecek
  -- kimse kalmaz ve bu durumdan yalnizca SQL Editor ile cikilabilir.
  -- (uygulandi/kendine-rol-atama.sql ile gelen kisit; AYNEN korunuyor -
  -- yonetici kendine rol ekleyip cikarabilir, yalnizca SON admin kilitlidir.)
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

  if not exists (select 1 from public.users where id = target_user) then
    raise exception 'Kullanici bulunamadi.' using errcode = '22023';
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  -- Aktif rol VARSAYILANA doner. Sistem yoneticisi rol kumesini yeniden
  -- kurdugunda kullanici o kumenin ilk rolunde baslar; boylece "eğitmenden
  -- baslayip hepsini atarsam egitmen olarak acilsin" beklentisi karsilanir.
  update public.users
  set roles            = temiz,
      role             = temiz[1],
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

-- 2. Talep onayi: onaylanan rol VARSAYILAN olur ---------------------------
-- Kayit sirasinda herkese 'ogrenci' verildigi icin, onaylanan rol sadece
-- kumeye EKLENSEYDI dizi ['ogrenci','egitmen'] olur ve yeni egitmen ogrenci
-- panelinde acilirdi. Onaylanan rol kumenin BASINA alinir: hem varsayilan
-- (roles[1]) hem de aktif rol o olur.
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
  set roles = case
        -- Basa al. Zaten kumedeyse once cikarilir ki iki kez gecmesin.
        when approve then array[wanted]::public.user_role[]
                          || array_remove(roles, wanted)
        else roles
      end,
      role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- 3. Belge ------------------------------------------------------------------
comment on column public.users.roles is
  'Kullaniciya verilmis roller, ATAMA SIRASIYLA. roles[1] varsayilan roldur. Yetki bu kumeye gore belirlenir (bkz. has_role).';
comment on column public.users.role is
  'Su an aktif olan rol. Varsayilandan (roles[1]) baslar, kullanici degistirebilir. Yalnizca yonlendirme ve basliklar icindir; yetki kaynagi degildir.';

-- 4. Kontrol -----------------------------------------------------------------
-- Atama sirasi korunuyor mu? roles[1] ile role ayni mi?
--   select email, roles[1] as varsayilan, role as aktif, roles
--   from public.users order by email;
