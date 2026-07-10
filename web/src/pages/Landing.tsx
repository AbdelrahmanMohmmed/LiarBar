import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";

/**
 * Landing / game hub — a faithful port of the imported Claude Design
 * "Games Landing" (Safariyat Games): a warm, sticker-style card layout with
 * hard borders and offset shadows. Bilingual AR/EN with RTL support, wired to
 * the app's existing language context and routing.
 */

const COPY = {
  ar: {
    siteName: "ألعاب سفريات",
    toggleLabel: "English",
    heroTitle: "اختر لعبتك وابدأ اللعب",
    heroSubtitle: "ألعاب اجتماعية بسيطة تلعبها مع أصدقائك في أي مكان.",
    availableLabel: "متاحة الآن",
    comingSoonLabel: "قريباً",
    game1Title: "أشك",
    game1Subtitle: "Liar's Bar",
    game1Desc: "لعبة خداع وكذب مليئة بالضحك، اجمع أصدقاءك وشوف مين بيكذب علينا!",
    playLabel: "العب الآن",
    game2Title: "كودنيمز",
    game2Subtitle: "Codenames",
    game2Desc: "لعبة تخمين الكلمات بالفرق، قريباً على ألعاب سفريات.",
    notifyLabel: "قريباً",
    footerText: "© 2026 ألعاب سفريات — العب في أي وقت، في أي مكان.",
  },
  en: {
    siteName: "Safariyat Games",
    toggleLabel: "العربية",
    heroTitle: "Pick a game and start playing",
    heroSubtitle: "Simple party games to play with your friends, anywhere.",
    availableLabel: "Available now",
    comingSoonLabel: "Coming soon",
    game1Title: "Liar's Bar",
    game1Subtitle: "أشك",
    game1Desc: "A party game of lies and laughs — gather your friends and catch the liar!",
    playLabel: "Play now",
    game2Title: "Codenames",
    game2Subtitle: "كودنيمز",
    game2Desc: "The classic team word-guessing game, coming soon to Safariyat Games.",
    notifyLabel: "Coming soon",
    footerText: "© 2026 Safariyat Games — play anytime, anywhere.",
  },
} as const;

const BUTTON_FONT = "'Baloo 2', sans-serif";

export default function Landing() {
  const navigate = useNavigate();
  const { lang, toggleLang } = useLanguage();

  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const textAlign = isAr ? "right" : "left";
  const buttonAlign = isAr ? "flex-end" : "flex-start";
  const badgeSide = isAr ? "left" : "right";
  const font = isAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif";

  const goToPlay = useCallback(() => navigate("/play"), [navigate]);

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        background: "#FDF6EC",
        fontFamily: font,
        color: "#2B2420",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 20px",
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Domino logo mark */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "#E8574A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              padding: 5,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#FDF6EC",
                borderRadius: 5,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  borderBottom: "2px solid #E8574A",
                }}
              >
                <Dot />
                <Dot />
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <Dot />
                <Dot />
                <Dot />
              </div>
            </div>
          </div>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: 20, lineHeight: 1.1 }}>
            {c.siteName}
          </div>
        </div>
        <button
          onClick={toggleLang}
          className="dc-lang-btn"
          style={{
            border: "2px solid #2B2420",
            background: "#FFFFFF",
            color: "#2B2420",
            fontFamily: BUTTON_FONT,
            fontWeight: 700,
            fontSize: 14,
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          {c.toggleLabel}
        </button>
      </header>

      {/* Main */}
      <main
        style={{
          flex: 1,
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          padding: "8px 20px 40px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <section
          style={{
            textAlign,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingTop: 8,
          }}
        >
          <h1
            style={{
              fontFamily: font,
              fontWeight: 800,
              fontSize: 30,
              lineHeight: 1.25,
              margin: 0,
              color: "#2B2420",
            }}
          >
            {c.heroTitle}
          </h1>
          <p
            style={{
              fontFamily: font,
              fontSize: 16,
              lineHeight: 1.6,
              margin: 0,
              color: "#5B5147",
            }}
          >
            {c.heroSubtitle}
          </p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Liar's Bar — available */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease both",
              background: "#FFFFFF",
              borderRadius: 24,
              border: "3px solid #2B2420",
              overflow: "hidden",
              boxShadow: "6px 6px 0 #2B2420",
            }}
          >
            <div
              style={{
                height: 140,
                background: "#F4C89A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div style={{ position: "relative", width: 140, height: 84 }}>
                <PlayingCard rotate={-14} diamond="#E8574A" />
                <PlayingCard rotate={0} diamond="#3AA6A6" />
                <PlayingCard rotate={14} diamond="#E8574A" />
              </div>
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  [badgeSide]: 10,
                  background: "#3AA6A6",
                  color: "#FDF6EC",
                  fontFamily: BUTTON_FONT,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 999,
                  animation: "dc-float-badge 2.4s ease-in-out infinite",
                }}
              >
                {c.availableLabel}
              </span>
            </div>
            <div
              style={{
                padding: "16px 20px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textAlign,
              }}
            >
              <div>
                <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                  {c.game1Title}
                </div>
                <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                  {c.game1Subtitle}
                </div>
              </div>
              <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                {c.game1Desc}
              </p>
              <button
                onClick={goToPlay}
                className="dc-play-btn"
                style={{
                  alignSelf: buttonAlign,
                  marginTop: 4,
                  background: "#E8574A",
                  color: "#FDF6EC",
                  border: "none",
                  fontFamily: BUTTON_FONT,
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "10px 22px",
                  borderRadius: 999,
                  cursor: "pointer",
                }}
              >
                {c.playLabel}
              </button>
            </div>
          </article>

          {/* Codenames — coming soon */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease 0.1s both",
              background: "#FFFFFF",
              borderRadius: 24,
              border: "3px solid #2B2420",
              overflow: "hidden",
              opacity: 0.75,
              boxShadow: "6px 6px 0 #2B2420",
            }}
          >
            <div
              style={{
                height: 140,
                background: "#CFE3E1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 20px)",
                  gridTemplateRows: "repeat(3, 20px)",
                  gap: 4,
                }}
              >
                {CODENAMES_TILES.map((color, i) => (
                  <div key={i} style={{ background: color, borderRadius: 3 }} />
                ))}
              </div>
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  [badgeSide]: 10,
                  background: "#2B2420",
                  color: "#FDF6EC",
                  fontFamily: BUTTON_FONT,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 999,
                }}
              >
                {c.comingSoonLabel}
              </span>
            </div>
            <div
              style={{
                padding: "16px 20px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textAlign,
              }}
            >
              <div>
                <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                  {c.game2Title}
                </div>
                <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                  {c.game2Subtitle}
                </div>
              </div>
              <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                {c.game2Desc}
              </p>
              <button
                disabled
                style={{
                  alignSelf: buttonAlign,
                  marginTop: 4,
                  background: "#E7E1D8",
                  color: "#A79C8E",
                  border: "none",
                  fontFamily: BUTTON_FONT,
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "10px 22px",
                  borderRadius: 999,
                  cursor: "not-allowed",
                }}
              >
                {c.notifyLabel}
              </button>
            </div>
          </article>
        </section>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "18px 20px 28px",
          fontFamily: font,
          fontSize: 13,
          color: "#8A7F73",
        }}
      >
        {c.footerText}
      </footer>
    </div>
  );
}

function Dot() {
  return <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#2B2420" }} />;
}

function PlayingCard({ rotate, diamond }: { rotate: number; diamond: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 58,
        height: 80,
        background: "#FDF6EC",
        border: "3px solid #2B2420",
        borderRadius: 10,
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        boxShadow: "2px 2px 0 rgba(43,36,32,0.25)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          width: 10,
          height: 10,
          background: diamond,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

const CODENAMES_TILES = [
  "#E8574A", "#FDF6EC", "#FDF6EC", "#3AA6A6", "#FDF6EC",
  "#FDF6EC", "#3AA6A6", "#2B2420", "#FDF6EC", "#E8574A",
  "#FDF6EC", "#E8574A", "#3AA6A6", "#FDF6EC", "#FDF6EC",
];
