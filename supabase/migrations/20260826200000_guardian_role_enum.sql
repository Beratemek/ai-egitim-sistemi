-- PostgreSQL yeni eklenen enum degerinin ayni transaction icinde
-- kullanilmasina izin vermeyebilir. Bu nedenle veliye ait tablo, politika ve
-- fonksiyonlar bilerek bir sonraki migration'da kuruluyor.

alter type public.user_role add value if not exists 'veli';
