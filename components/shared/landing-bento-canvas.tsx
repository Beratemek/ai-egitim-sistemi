import {
  BarChart3,
  BookOpen,
  Check,
  FileQuestion,
  FileText,
  GraduationCap,
  ListChecks,
  ScanText,
  Target,
  UserCheck,
} from "lucide-react";

export function LandingBentoCanvas() {
  return (
    <div className="w-full">
      <div className="academic-bento-stage">
        <div className="academic-bento-viewport">
          <div className="academic-bento-grid">
            <article className="bento-source bg-[#20382f] p-5 text-[#f7f3e9] sm:p-6">
              <div className="flex items-center justify-between text-[#b9d1c7]">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Kaynak</span>
                <FileText className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <BookOpen className="mb-4 h-6 w-6 text-[#b9d1c7]" strokeWidth={1.4} />
                <p className="font-display text-2xl leading-tight sm:text-3xl">İçerik sisteme eklenir.</p>
                <p className="mt-2 text-xs text-white/55">PDF · metin · ders notu</p>
              </div>
            </article>

            <article className="bento-outcome bg-[#176f5e] p-5 text-[#fffaf0] sm:p-6">
              <div className="flex items-center justify-between text-[#dce9e3]">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Kazanım</span>
                <Target className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-xl leading-tight sm:text-2xl">Ölçülecek hedef netleşir.</p>
                <p className="mt-1 text-[10px] text-white/60">İçerikle eşleştirilir</p>
              </div>
            </article>

            <article className="bento-context bg-[#dfeae4] p-4 text-[#173a36] sm:p-5">
              <div className="flex items-center justify-between text-[#52736d]">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Hazırlık</span>
                <ScanText className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-xl leading-none sm:text-2xl">Bağlam çıkarılır.</p>
                <p className="mt-2 text-[10px] text-[#52736d]">Soru üretimine hazırlanır</p>
              </div>
            </article>

            <article className="bento-question bg-[#fffdf8] p-5 text-[#10272f] sm:p-6">
              <div className="flex items-center justify-between text-[#52736d]">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Soru türü</span>
                <FileQuestion className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-2xl leading-tight sm:text-3xl">Çoktan seçmeli</p>
                <p className="mt-1 text-xs text-muted-foreground">ve açık uçlu</p>
              </div>
            </article>

            <article className="bento-editorial bg-[#c7795c] p-4 text-[#fffaf0] sm:p-5">
              <ListChecks className="h-4 w-4" />
              <div className="mt-auto">
                <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/65">Soru üretimi</p>
                <p className="mt-1 font-display text-xl sm:text-2xl">Taslak hazırlanır.</p>
              </div>
            </article>

            <article className="bento-exam bg-[#f3dfbd] p-4 text-[#34271e] sm:p-5">
              <div className="flex items-center justify-between text-[#9b563f]">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Eğitmen kontrolü</span>
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-xl leading-none sm:text-2xl">Yayına hazır.</p>
                <p className="mt-2 text-[10px] text-[#9b563f]">Taslak gözden geçirilir</p>
              </div>
            </article>

            <article className="bento-answer bg-[#a9c4c4] p-5 text-[#173a36] sm:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Öğrenci cevabı</span>
                <Check className="bento-check h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-2xl leading-tight sm:text-3xl">Cevap güvenle kaydedilir.</p>
                <p className="mt-2 text-xs text-[#375f58]">Gönderildikten sonra değiştirilemez</p>
              </div>
            </article>

            <article className="bento-assessment bg-[#fffdf8] p-5 text-[#10272f] sm:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#52736d]">Rubrik</span>
                <ListChecks className="h-4 w-4 text-[#52736d]" />
              </div>
              <p className="mt-5 font-display text-2xl leading-none sm:text-3xl">Ön değerlendirme</p>
              <div className="mt-auto space-y-2" aria-label="Rubrik kriterleri">
                {["Kavram", "Gerekçe", "Açıklık"].map((criterion, index) => (
                  <div key={criterion} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-[8px] text-muted-foreground">
                    <span>{criterion}</span>
                    <span className="h-1 bg-[#dce2dc]">
                      <span className="block h-full bg-[#176f5e]" style={{ width: `${72 + index * 9}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="bento-human bg-[#10272f] p-5 text-[#f7f3e9] sm:p-6">
              <div className="flex items-center justify-between text-[#b9d1c7]">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Nihai sonuç</span>
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-2xl leading-tight sm:text-3xl">Eğitmen onaylı.</p>
                <p className="mt-2 text-[10px] text-white/50">Son karar insanda</p>
              </div>
            </article>

            <article className="bento-analytics bg-[#e4c98c] p-5 text-[#2d372d] sm:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em]">Gelişim</span>
                <BarChart3 className="h-4 w-4" />
              </div>
              <div className="mt-auto">
                <p className="font-display text-2xl leading-tight sm:text-3xl">Öğrenme görünür olur.</p>
                <div className="bento-learning-lines mt-5 flex h-10 items-end gap-1.5" aria-hidden>
                  {[38, 54, 46, 67, 73, 88].map((height, index) => (
                    <span
                      key={height}
                      className="flex-1 border-t border-[#2d372d]/35 bg-[#2d372d]/10"
                      style={{ height: `${height}%`, animationDelay: `${index * -0.41}s` }}
                    />
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
