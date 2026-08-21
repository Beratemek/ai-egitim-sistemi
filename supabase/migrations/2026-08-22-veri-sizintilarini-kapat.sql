-- ---------------------------------------------------------------------------
-- Iki veri sizintisini kapat
--
-- Ders yetkisi tasarimi sirasinda yapilan guvenlik incelemesinde bulundu.
-- Ikisi de bugun canli; ders yetkisi ozelliginden bagimsiz olarak gecerli.
--
-- Idempotenttir.
-- ---------------------------------------------------------------------------

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

-- 3. Kontrol ---------------------------------------------------------------
-- select polname, polcmd from pg_policy
--   where polrelid in ('public.question_preferences'::regclass,
--                      'public.learning_outcomes'::regclass);
