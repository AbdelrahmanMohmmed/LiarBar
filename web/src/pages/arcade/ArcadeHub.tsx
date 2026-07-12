import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import { Gamepad2, Bug, Swords, PersonStanding, Rocket, Sparkles } from "lucide-react";

const GAMES = [
  {
    key: "snake",
    to: "/arcade/snake",
    icon: Bug,
    color: "from-emerald-500 to-emerald-700",
    ring: "group-hover:shadow-emerald-900/40",
    ar: { title: "الأفعى", sub: "Snake", desc: "كُل الطعام وازداد طولاً، لكن لا تصطدم بنفسك أو بالجدار!" },
    en: { title: "Snake", sub: "Snake", desc: "Eat the food, grow longer — but don't hit yourself or the wall!" },
  },
  {
    key: "tictactoe",
    to: "/arcade/tictactoe",
    icon: GridIcon,
    color: "from-sky-500 to-sky-700",
    ring: "group-hover:shadow-sky-900/40",
    ar: { title: "تيك تاك تو", sub: "Tic-Tac-Toe", desc: "رصّ ثلاثة رموز متتالية قبل خصمك. العب ضد صديق أو الحاسوب." },
    en: { title: "Tic-Tac-Toe", sub: "Tic-Tac-Toe", desc: "Line up three in a row before your rival. Play a friend or the CPU." },
  },
  {
    key: "fighter",
    to: "/arcade/fighter",
    icon: Swords,
    color: "from-rose-500 to-rose-700",
    ring: "group-hover:shadow-rose-900/40",
    ar: { title: "نزال", sub: "Fighter", desc: "قتال محلي لاعبين اثنين: حرّك، اقفز، وشنّ هجمات حتى تفرغ صحة الخصم." },
    en: { title: "Fighter", sub: "Fighter", desc: "Local 2-player brawl: move, jump, and strike until your rival's health hits zero." },
  },
  {
    key: "jumper",
    to: "/arcade/jumper",
    icon: PersonStanding,
    color: "from-amber-500 to-amber-700",
    ring: "group-hover:shadow-amber-900/40",
    ar: { title: "العدّاء", sub: "Super Runner", desc: "اقفز فوق العوائق واصمد أطول مدة ممكنة في هذا الركض اللانهائي." },
    en: { title: "Super Runner", sub: "Super Runner", desc: "Jump over obstacles and survive as long as you can in this endless runner." },
  },
  {
    key: "space-invaders",
    to: "/arcade/space-invaders",
    icon: Rocket,
    color: "from-cyan-500 to-cyan-700",
    ring: "group-hover:shadow-cyan-900/40",
    ar: { title: "غزاة الفضاء", sub: "Space Invaders", desc: "حرّك سفينتك، أطلق النار على الأعداء، وتصدّى لموجات الغزو والزعيم." },
    en: { title: "Space Invaders", sub: "Space Invaders", desc: "Pilot your ship, blast incoming enemies, and survive the swarm — and a boss." },
  },
  {
    key: "space-alien",
    to: "/arcade/space-alien",
    icon: Sparkles,
    color: "from-fuchsia-500 to-fuchsia-700",
    ring: "group-hover:shadow-fuchsia-900/40",
    ar: { title: "غزو الفضائيين", sub: "Alien Fleet", desc: "دافع عن الأرض ضد أسطول فضائي منظم يهبط رويداً رويداً." },
    en: { title: "Alien Fleet", sub: "Alien Fleet", desc: "Defend Earth from a marching alien fleet that descends row by row." },
  },
] as const;

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  );
}

export default function ArcadeHub() {
  const navigate = useNavigate();
  const { lang, toggleLang } = useLanguage();
  const isAr = lang === "ar";

  const COPY = {
    ar: {
      title: "الصالة",
      sub: "ألعاب أركيد أحادية اللاعب قابلة للعب فوراً",
      play: "العب",
      langLabel: "English",
    },
    en: {
      title: "Arcade",
      sub: "Single-player games you can play right in your browser",
      play: "Play",
      langLabel: "العربية",
    },
  } as const;
  const c = COPY[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen bg-[#0e0b16] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-700/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 max-w-5xl w-full mx-auto">
        <div className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-fuchsia-900/40">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{c.title}</h1>
            <p className="text-fuchsia-200/40 text-xs">{c.sub}</p>
          </div>
        </div>
        <button
          onClick={toggleLang}
          className="px-3 py-2 rounded-lg text-fuchsia-200/60 hover:text-white hover:bg-white/5 transition-all text-sm font-medium border border-fuchsia-900/30"
        >
          {c.langLabel}
        </button>
      </header>

      <main className="relative z-10 max-w-5xl w-full mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((g) => {
            const Icon = g.icon;
            const text = isAr ? g.ar : g.en;
            return (
              <button
                key={g.key}
                onClick={() => navigate(g.to)}
                className={`group relative text-left bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-5 transition-all hover:-translate-y-1 hover:bg-white/10 ${g.ring} shadow-lg shadow-black/30`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="font-bold text-lg">{text.title}</div>
                <div className="text-fuchsia-200/40 text-xs mb-2">{text.sub}</div>
                <p className="text-white/60 text-sm leading-relaxed">{text.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-300 group-hover:gap-2.5 transition-all">
                  {c.play}
                  <Arrow isAr={isAr} />
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Arrow({ isAr }: { isAr: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAr ? "rotate(180deg)" : "none" }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
