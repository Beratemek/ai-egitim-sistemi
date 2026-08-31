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
| Egitmen | `egitmen` | `/dashboard/egitmen`, `/dashboard/egitmen/soru-havuzu`, `/dashboard/egitmen/sinavlar` |
| Ogrenci | `ogrenci` | `/dashboard/ogrenci`, `/dashboard/ogrenci/sinav/[examId]` |
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

  actions/                       Server Action'lar (arayuzun kalici yazma yolu)
    shared.ts                    ActionResult tipi + demo modu korumasi
    questions.ts                 taslak kaydetme, onay/red, kazanim, tercihler
    exams.ts                     sinav olustur, soru ekle/cikar, yayina al
    submissions.ts               cevap gonder (on puanlama), nihai puan onayi

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
    answer-form.tsx              ogrenci cevabi + AI puan gorunumu (kalici)
    exam-create-dialog.tsx       yeni sinav formu
    exam-builder.tsx             sinava soru ekle/cikar, yayina al
    submission-review-dialog.tsx egitmenin nihai puan onayi
    page-header.tsx, stat-card.tsx, status-badge.tsx, login-form.tsx

lib/
  types.ts                       domain tipleri + Supabase Database generic'i
  roles.ts                       rol meta verisi ve yonlendirme haritasi
  env.ts                         cevre degiskeni erisimi
  supabase.ts                    tarayici istemcisi
  supabase-server.ts             sunucu / admin istemcisi, getCurrentUser
  ai.ts                          generateQuestions, gradeAnswer
  grading.ts                     autoGrade: coktan secmeli + rubrik on puanlama
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

## Sanal sinif (soru kalitesi olcumu)

Uretilen bir taslak, havuza gonderilmeden once bes simule ogrenci profiliyle
pilot uygulamaya sokulabilir. Ogrenci agent'lari soruyu **cevap anahtarini
gormeden** cozer; madde guclugu (p degeri), ayirt edicilik, celdirici dagilimi
ve ipucu sizintisi onlarin cevaplarindan hesaplanir.

```ts
import { runVirtualClass } from "@/lib/ai";

const report = await runVirtualClass(question, { kazanim, subject });
// -> { kaliteSkoru: 70, pDegeri: 0.6, ayirtEdicilik: 0.5, bulgular: [...] }
```

Bulgular tek tikla revizyon talimatina cevrilir, soru yeniden yazilir ve
**yeniden olculur**; iki skor yan yana gosterilir. Ayrinti icin
[`docs/sanal-sinif.md`](docs/sanal-sinif.md).

## Sinav kestirimi (sinif simulasyonu)

Sinav yayina alinmadan once simule bir sinifa cozduruluyor: puan dagilimi,
gecme orani, ust-alt ayrismasi, soru bazinda basari, kazanim kirilimi ve sure
uyumu cikiyor. Kadro uc yoldan kurulabilir - hazir zit takim, egitmenin elle
tarif ettigi sinif ya da **gercek bir sinifin dijital ikizi** (gecmis
sonuclardan turetilir; ogrenci adi/kimligi modele gitmez).

```ts
import { simulateExam } from "@/lib/ai";

const report = await simulateExam({ cohort, questions, durationMinutes, cohortLabel });
// -> { distribution, separation, questions, outcomes, duration, warnings }
```

Her kestirim kaydediliyor; sinav gercekten yapilip puanlar onaylandiginda
tahmin gercekle karsilastirilip **kalibrasyon** uretiliyor ("son 7 kestirimde
ortalama sapma 6,4 puan"). Ayrinti icin
[`docs/sinav-kestirimi.md`](docs/sinav-kestirimi.md).

> Kestirim kaydi icin `supabase/migrations/BEKLEYEN-1-sinav-kestirimi.sql`
> uygulanmali. Uygulanmazsa kestirim yine calisir, yalnizca kalibrasyon
> birikmez.

## Guvenlik notlari

- Tum tablolarda **RLS acik**. Rol kontrolu, politika ozyinelemesini onlemek
  icin `SECURITY DEFINER` isaretli `public.has_role()` fonksiyonu uzerinden yapilir.
- Ogrenci soru metinlerini `get_student_exam_questions()` RPC'sinden, kendi
  cevaplarini `get_my_submissions()` RPC'sinden okur. Dogru cevap/rubrik ile
  ara AI ve egitmen puanlari sinav `sonuclandi` olmadan istemciye donmez.
- `POST /api/submissions` rubrigi **istemciden degil veritabanindan** okur;
  aksi halde ogrenci kendi rubrigini gonderip puanini yukseltebilirdi.
- `SUPABASE_SERVICE_ROLE_KEY` yalnizca `lib/supabase-server.ts` icindeki
  `createAdminSupabaseClient()` tarafindan AI puanlama yazmalarinda kullanilir.
  `NEXT_PUBLIC_` on eki tasimaz; istemciye asla gonderilmez. Bu anahtar
  tanimlanmadan `20260821203000_student_assessment_security.sql` migration'i
  ortak veritabanina uygulanmamalidir.

## Veri katmani

Paneller dogrudan `supabase.from(...)` cagirmaz; hepsi
[`lib/queries.ts`](lib/queries.ts) uzerinden okur. Bu katman Supabase
yapilandirilmamissa otomatik olarak `lib/mock-data.ts` demo verisine duser,
boylece anahtar girmeden klonlanan proje de calisir.

Yazma islemleri `app/actions/*.ts` icindeki Server Action'lardan gecer ve demo
modunda okunabilir bir hata dondurur ("Supabase baglantisi gerekiyor").
Tek istisna cevap gonderimidir: demo modunda da puanlama calisir ama sonuc
veritabanina yazilmaz, arayuz bunu acikca soyler.

### Sinav akisi

1. Icerik uzmani kazanimdan soru taslagi uretir -> havuza gonderir.
2. Egitmen [soru havuzunda](app/dashboard/egitmen/soru-havuzu/page.tsx)
   taslaklari onaylar.
3. Egitmen [sinav olusturur](app/dashboard/egitmen/sinavlar/page.tsx), havuzdan
   **yalnizca onayli** sorulari secip sinava ekler ve yayina alir.
4. Ogrenci sinava girer; coktan secmeli sorular dogru sik karsilastirmasiyla,
   acik uclu sorular rubrige gore AI ile **on** puanlanir
   ([`lib/grading.ts`](lib/grading.ts)).
5. Egitmen her cevapta AI puanini gorur onaylar veya duzeltir; puan ancak o
   zaman nihai olur.

## Komutlar

```bash
npm run dev        # gelistirme sunucusu
npm run build      # uretim derlemesi
npm run start      # uretim sunucusu
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```
