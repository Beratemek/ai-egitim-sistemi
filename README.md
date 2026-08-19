# Yapay Zeka Destekli Egitim Sistemi (Hackathon MVP)

Kazanimdan soruya, cevaptan puana kadar olcme-degerlendirme surecini yapay zeka
ile hizlandiran; ancak nihai karari her zaman egitmene birakan tam yigin bir
baslangic projesi.

## Teknoloji yigini

| Katman | Teknoloji |
| --- | --- |
| Arayuz | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Tasarim sistemi | Tailwind CSS 3 + **shadcn/ui** (Radix primitifleri), lucide ikonlari, Inter (next/font) |
| Tema | next-themes ile acik/koyu mod; renkler CSS degiskenleri uzerinden |
| Grafik | Recharts (shadcn chart sarmalayicisi) |
| API | Next.js Route Handlers (Node.js runtime) |
| Veritabani / Yetki | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) |
| Yapay zeka | Vercel AI SDK (`ai`) + `@ai-sdk/openai`, semali cikti icin `zod` |

## Hizli baslangic

Gereksinim: **Node.js 18.18+** (onerilen: 20 veya 22). Baska hicbir sey gerekmez.

```bash
git clone https://github.com/Beratemek/ai-egitim-sistemi.git
cd ai-egitim-sistemi
npm install
npm run dev
```

Tarayicida <http://localhost:3000> adresini acin. **Anahtar girmenize gerek yok** -
uygulama `.env.local` olmadan **demo modunda** calisir:

- giris ekrani parola sormaz, dogrudan rol secme baglantilari gosterir,
- paneller `lib/mock-data.ts` icindeki ornek veriyle render edilir,
- AI uclari gercek bir API cagrisi yapmadan `[MOCK]` etiketli yanit doner.

> Port 3000 doluysa Next.js otomatik olarak bir sonraki bos porta gecer;
> terminaldeki `Local:` satirinda hangi adreste calistigi yazar.
> Belirli bir port icin: `npm run dev -- -p 3001`

Gercek Supabase ve OpenAI baglamak istediginizde:

```bash
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

ve asagidaki adimlari izleyin.

### Supabase kurulumu

1. [supabase.com](https://supabase.com/dashboard) uzerinde bir proje olusturun.
2. **SQL Editor**'e `supabase/schema.sql` dosyasinin tamamini yapistirip calistirin.
3. **Project Settings > API** bolumunden `URL` ve `anon key` degerlerini
   `.env.local` icine yazin.
4. **Authentication > Users** altindan test kullanicilari olusturun, sonra rolleri atayin:

```sql
update public.users set role = 'egitmen', full_name = 'Ayse Yilmaz'
where email = 'egitmen@ornek.com';
```

> Kayit ekranindan (`/login` > "Kayit ol") olusturulan kullanicilarin rolu
> `handle_new_user` trigger'i tarafindan otomatik atanir.

### Yapay zeka

`OPENAI_API_KEY` tanimliysa gercek model cagrisi yapilir. Anahtar yoksa veya
`AI_MOCK_MODE=true` ise deterministik sahte veri doner - demo sirasinda kota
tuketmemek icin kullanislidir. `OPENAI_BASE_URL` ile OpenAI uyumlu baska bir
saglayiciya (OpenRouter, Groq, yerel LLM) yonlendirebilirsiniz.

## Roller ve yollar

| Rol | Enum degeri | Panel |
| --- | --- | --- |
| Icerik Uzmani | `icerik_uzmani` | `/dashboard/icerik-uzmani` |
| Egitmen | `egitmen` | `/dashboard/egitmen`, `/dashboard/egitmen/soru-havuzu` |
| Ogrenci | `ogrenci` | `/dashboard/ogrenci` |
| Egitim Yoneticisi | `egitim_yoneticisi` | `/dashboard/yonetici` |

Rol -> yol eslesmesinin tek kaynagi [`lib/roles.ts`](lib/roles.ts) dosyasidir;
middleware, giris ekrani ve navigasyon hep buradan okur.

## Klasor yapisi

```
app/
  layout.tsx                     kok layout + metadata
  page.tsx                       tanitim sayfasi
  globals.css                    Tailwind katmanlari + tema degiskenleri
  login/page.tsx                 giris / kayit ekrani
  dashboard/
    layout.tsx                   oturum cozumleme + DashboardShell
    page.tsx                     role gore dagitim
    icerik-uzmani/page.tsx       metin + kazanim yukleme, AI soru uretimi
    egitmen/page.tsx             genel bakis, puan onayi bekleyen cevaplar
    egitmen/soru-havuzu/page.tsx soru havuzu tablosu
    ogrenci/page.tsx             sinav / cevaplama / geri bildirim
    yonetici/page.tsx            istatistik panosu
  api/
    ai/generate-questions/route.ts  POST -> GeneratedQuestion[]
    ai/grade-answer/route.ts        POST -> GradingResult
    questions/route.ts              GET / POST / PATCH
    submissions/route.ts            GET / POST / PATCH
  auth/
    callback/route.ts            e-posta dogrulama / magic link donusu
    signout/route.ts             POST -> oturum kapatma

components/
  ui/                            shadcn/ui bilesenleri: Button, Input, Textarea,
                                 Label, Select, Card, Badge, Table, Tabs, Sheet,
                                 DropdownMenu, Dialog, Avatar, Progress, Skeleton,
                                 Separator, Tooltip, ScrollArea, Sonner, Chart
  theme-provider.tsx             next-themes sarmalayicisi
  shared/
    dashboard-shell.tsx          sabit sol menu + mobil Sheet cekmece + hesap menusu
    app-nav.tsx                  rol bazli menu ogeleri (istemci; usePathname)
    brand-mark.tsx               logo (sunucu bileseni)
    role-icons.ts                rol ikonlari (RSC sinirini gecebilmek icin ayri)
    theme-toggle.tsx             acik/koyu tema anahtari
    analytics-charts.tsx         Recharts grafikleri (trend, ortalama, durum)
    question-pool-table.tsx      masaustunde tablo, mobilde kart listesi
    question-generator-form.tsx  AI soru uretim formu
    answer-form.tsx              ogrenci cevap + AI puan gorunumu
    page-header.tsx, stat-card.tsx, status-badge.tsx, login-form.tsx

lib/
  types.ts                       domain tipleri + Supabase Database generic'i
  roles.ts                       rol meta verisi ve yonlendirme haritasi
  env.ts                         cevre degiskeni erisimi
  supabase.ts                    tarayici istemcisi
  supabase-server.ts             sunucu / admin istemcisi, getCurrentUser
  ai.ts                          generateQuestions, gradeAnswer
  api.ts                         JSON yanit yardimcilari, requireRole
  utils.ts                       cn, formatDateTime, formatScore
  mock-data.ts                   demo verisi

supabase/schema.sql              tablolar, enum'lar, trigger'lar, RLS, view
middleware.ts                    oturum tazeleme + rol bazli yol korumasi
```

## AI servisi

```ts
import { generateQuestions, gradeAnswer } from "@/lib/ai";

// Metin + kazanimdan soru taslaklari
const questions = await generateQuestions(kaynakMetin, kazanim, {
  count: 5,
  type: "karisik",   // "test" | "acik_uclu" | "karisik"
});

// Ogrenci cevabini rubrige gore puanla
const result = await gradeAnswer(ogrenciCevabi, rubrik, {
  questionText,
  maxScore: 100,
});
// -> { score: 85, feedback: "...", criteria: [{ criterion, earned, max, comment }] }
```

Cikti sekli Zod semalariyla zorunlu kilinir (`generateObject`), bu yuzden
"JSON parse edilemedi" hatasi yerine dogrulanmis nesne dondurulur.
`normalizeGeneratedQuestion`, model ciktisini `questions_type_shape_check`
kisitiyla uyumlu hale getirir: test sorusunda sik + dogru cevap, acik uclu
soruda rubrik garanti edilir.

## Guvenlik notlari

- Tum tablolarda **RLS acik**. Rol kontrolu, politika ozyinelemesini onlemek
  icin `SECURITY DEFINER` isaretli `public.has_role()` fonksiyonu uzerinden yapilir.
- Ogrenci yalnizca `status = 'onayli'` sorulari ve kendi `submissions`
  kayitlarini gorebilir.
- `POST /api/submissions` rubrigi **istemciden degil veritabanindan** okur;
  aksi halde ogrenci kendi rubrigini gonderip puanini yukseltebilirdi.
- `SUPABASE_SERVICE_ROLE_KEY` yalnizca `lib/supabase-server.ts` icindeki
  `createAdminSupabaseClient()` tarafindan kullanilir ve `NEXT_PUBLIC_` on eki
  tasimaz; istemciye asla gonderilmez.

## Mock veriden gercek veriye gecis

Paneller su an `lib/mock-data.ts` kullaniyor. Ornegin soru havuzu icin
[`app/dashboard/egitmen/soru-havuzu/page.tsx`](app/dashboard/egitmen/soru-havuzu/page.tsx)
dosyasini soyle degistirin:

```tsx
const supabase = await createServerSupabaseClient();
const { data: questions } = await supabase
  .from("questions")
  .select("*")
  .order("created_at", { ascending: false });

return <QuestionPoolTable questions={questions ?? []} />;
```

`QuestionPoolTable` ayrica `onStatusChange` prop'u alir; `PATCH /api/questions`
cagrisini bagladiginizda onay/red islemi kalici hale gelir.

## Komutlar

```bash
npm run dev        # gelistirme sunucusu
npm run build      # uretim derlemesi
npm run start      # uretim sunucusu
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```
