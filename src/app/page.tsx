import Hero from "@/components/Hero";
import RecruitForm from "@/components/RecruitForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#091831] via-[#0c2747] to-[#0d3a53]">
      <Hero />

      {/* ヒーローに重なる白カード */}
      <div className="relative z-10 mx-auto -mt-[84px] max-w-3xl px-4 pb-10 sm:-mt-[116px] sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
          {/* 見出し + 装飾文字 Recruitment */}
          <div className="relative mb-8 overflow-hidden py-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 select-none whitespace-nowrap text-4xl font-extrabold italic tracking-tight text-[#cadefb] sm:text-6xl"
            >
              Recruitment
            </span>
            <h1
              className="relative text-xl text-slate-900 sm:text-2xl"
              style={{
                fontFamily:
                  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Hiragino Kaku Gothic Pro", sans-serif',
                fontWeight: 800,
              }}
            >
              採用エントリーフォーム
            </h1>
          </div>

          <RecruitForm />
        </div>
      </div>

      <footer className="pb-10 text-center text-xs text-white/60">
        ©2025 株式会社BioVault
      </footer>
    </main>
  );
}
