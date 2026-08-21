-- ---------------------------------------------------------------------------
-- ADIM 1/2 - `admin` rolunu enum'a ekle
--
-- BU DOSYA TEK BASINA CALISTIRILMALIDIR.
--
-- PostgreSQL, bir enum'a eklenen yeni degerin AYNI islem (transaction) icinde
-- kullanilmasina izin vermez ("unsafe use of new value of enum type"). Bu
-- yuzden enum eklemesi ile onu kullanan adimlar iki ayri calistirmaya bolundu.
--
-- Calistirma: Supabase Dashboard -> SQL Editor -> New query -> yapistir -> Run
-- Bittikten sonra 2. adim dosyasini calistirin.
-- ---------------------------------------------------------------------------

alter type public.user_role add value if not exists 'admin';
