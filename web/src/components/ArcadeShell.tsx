import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { useLanguage } from "@/lib/languageContext";

interface ArcadeShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function ArcadeShell({ title, subtitle, children }: ArcadeShellProps) {
  const navigate = useNavigate();
  const { lang, toggleLang } = useLanguage();
  const isAr = lang === "ar";

  return (
    <div className="min-h-screen bg-[#0e0b16] text-white flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-700/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 max-w-5xl w-full mx-auto">
        <button
          onClick={() => navigate("/arcade")}
          className="inline-flex items-center gap-1.5 text-fuchsia-200/60 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/5 transition-all"
        >
          <ArrowLeft className={`w-4 h-4 ${isAr ? "rotate-180" : ""}`} />
          {isAr ? "كل الألعاب" : "All games"}
        </button>
        <div className="text-center flex-1">
          <h1 className="font-bold text-lg text-white leading-tight">{title}</h1>
          {subtitle && <p className="text-fuchsia-200/40 text-xs">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg text-fuchsia-200/60 hover:text-white hover:bg-white/5 transition-all"
            title={isAr ? "الرئيسية" : "Home"}
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={toggleLang}
            className="px-3 py-2 rounded-lg text-fuchsia-200/60 hover:text-white hover:bg-white/5 transition-all text-sm font-medium border border-fuchsia-900/30"
          >
            {isAr ? "EN" : "ع"}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
