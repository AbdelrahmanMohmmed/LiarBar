import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";

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
    game2Desc: "لعبة تخمين الكلمات بالفرق، العبها الآن مع أصدقائك!",
    game3Title: "أعلى أو أقل",
    game3Subtitle: "Higher or Lower",
    game3Desc: "لعبة تخمين رقمك السري، شارك تخميناتك واعرف من يقترب للرقم السري أولاً!",
    game4Title: "الدومينو الكلاسيكية",
    game4Subtitle: "Classic Dominoes",
    game4Desc: "العب الدومينو الكلاسيكية مع أصدقائك زوجي أو فردي مع البوتات وتحديد النقاط وعداد الوقت!",
    notifyLabel: "العب الآن",
    gameLobbyTitle: "وضع اللوبي",
    gameLobbySubtitle: "غرفة تجمع الألعاب",
    gameLobbyDesc: "أنشئ غرفة تجمع دائمة لأصدقائك، وتحدث معهم بالصوت، وابدأ أي لعبة بسلاسة دون انقطاع الاتصال!",
    lobbyPlayLabel: "إنشاء لوبي",
    arcadeTitle: "صالة الألعاب",
    arcadeSubtitle: "Arcade",
    arcadeDesc: "مجموعة ألعاب أركيد أحادية اللاعب تلعبها مباشرة في المتصفح — أفعى، تيك تاك تو، نزال، وغزاة الفضاء!",
    arcadePlayLabel: "ادخل الصالة",
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
    game2Desc: "The classic team word-guessing game — play it now with your friends!",
    game3Title: "Higher or Lower",
    game3Subtitle: "أعلى أو أقل",
    game3Desc: "A fun number guessing game. Compare ranges with others and see who finds their secret number first!",
    game4Title: "Classic Dominoes",
    game4Subtitle: "الدومينو الكلاسيكية",
    game4Desc: "Play the traditional Domino game online with friends! Supports Solo or 2v2 Teams mode with bots and turn timers.",
    notifyLabel: "Play now",
    gameLobbyTitle: "Lobby Mode",
    gameLobbySubtitle: "Game Party Hub",
    gameLobbyDesc: "Create a persistent party lobby, chat with friends via voice, and seamlessly launch any game without disconnecting!",
    lobbyPlayLabel: "Create Lobby",
    arcadeTitle: "Arcade",
    arcadeSubtitle: "Arcade",
    arcadeDesc: "A collection of single-player arcade games you can play right in your browser — Snake, Tic-Tac-Toe, Fighter, and Space Invaders!",
    arcadePlayLabel: "Enter Arcade",
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
  const goToCodenames = useCallback(() => navigate("/codenames"), [navigate]);
  const goToHigherLower = useCallback(() => navigate("/higher-lower"), [navigate]);
  const goToDomino = useCallback(() => navigate("/domino"), [navigate]);
  const goToLobby = useCallback(() => navigate("/lobby"), [navigate]);
  const goToArcade = useCallback(() => navigate("/arcade"), [navigate]);

  return (
    <>
    <Seo
      lang={isAr ? "ar" : "en"}
      title={isAr ? "ألعاب سفريات — ألعاب جماعية أونلاين مجانية" : "Safariyat Games — Free online multiplayer party games"}
      description={
        isAr
          ? "العب ألعاب جماعية أونلاين مجانية مع أصدقائك — أشك، كودنيمز، وأعلى أو أقل. بدون تحميل وبدون تسجيل."
          : "Play free online multiplayer party games with friends — Liar's Bar, Codenames, and Higher or Lower. No download, no sign-up."
      }
      path="/"
    />
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

          {/* Codenames — available */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease 0.1s both",
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
                onClick={goToCodenames}
                className="dc-play-btn"
                style={{
                  alignSelf: buttonAlign,
                  marginTop: 4,
                  background: "#3AA6A6",
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
                {c.notifyLabel}
              </button>
            </div>
          </article>

          {/* Higher or Lower — available */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease 0.2s both",
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
                background: "#FEF3C7", // Soft warm yellow
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#3AA6A6",
                  color: "#FDF6EC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 800,
                  border: "3.5px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  transform: "rotate(-8deg)",
                }}
              >
                ↑
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#E8574A",
                  color: "#FDF6EC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 800,
                  border: "3.5px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  transform: "rotate(8deg)",
                }}
              >
                ↓
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
                  {c.game3Title}
                </div>
                <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                  {c.game3Subtitle}
                </div>
              </div>
              <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                {c.game3Desc}
              </p>
              <button
                onClick={goToHigherLower}
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

          {/* Dominoes — available */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease 0.25s both",
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
                background: "#D1FAE5", // Soft mint green
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", gap: 10, transform: "rotate(-4deg)" }}>
                {/* Mini Domino 1 */}
                <div style={{ width: 44, height: 76, background: "#FCFBF7", border: "2.5px solid #2B2420", borderRadius: 6, display: "flex", flexDirection: "column", position: "relative", boxShadow: "2px 2px 0 #2B2420" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1.5px solid #2B2420" }}>
                    <div style={{ width: 5, height: 5, background: "#2B2420", borderRadius: "50%" }} />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexWrap: "wrap", padding: 4, gap: 3, alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 4, height: 4, background: "#D4AF37", borderRadius: "50%", border: "0.5px solid #9A7B1C" }} />
                </div>
                {/* Mini Domino 2 */}
                <div style={{ width: 44, height: 76, background: "#FCFBF7", border: "2.5px solid #2B2420", borderRadius: 6, display: "flex", flexDirection: "column", position: "relative", boxShadow: "2px 2px 0 #2B2420", transform: "translateY(8px) rotate(8deg)" }}>
                  <div style={{ flex: 1, display: "flex", flexWrap: "wrap", padding: 4, gap: 3, alignItems: "center", justifyContent: "center", borderBottom: "1.5px solid #2B2420" }}>
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexWrap: "wrap", padding: 4, gap: 3, alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                  </div>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 4, height: 4, background: "#D4AF37", borderRadius: "50%", border: "0.5px solid #9A7B1C" }} />
                </div>
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
                  {c.game4Title}
                </div>
                <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                  {c.game4Subtitle}
                </div>
              </div>
              <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                {c.game4Desc}
              </p>
              <button
                onClick={goToDomino}
                className="dc-play-btn"
                style={{
                  alignSelf: buttonAlign,
                  marginTop: 4,
                  background: "#3AA6A6",
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

          {/* Lobby Mode — available */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease 0.3s both",
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
                background: "#E9D5FF", // Soft warm purple
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                position: "relative",
              }}
            >
              {/* Sticker styling representation of game lobby/chat */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 12,
                  background: "#FDF6EC",
                  border: "3px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  transform: "rotate(-6deg)",
                }}
              >
                💬
              </div>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 12,
                  background: "#3AA6A6",
                  border: "3px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  transform: "rotate(6deg)",
                }}
              >
                🎮
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
                  {c.gameLobbyTitle}
                </div>
                <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                  {c.gameLobbySubtitle}
                </div>
              </div>
              <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                {c.gameLobbyDesc}
              </p>
              <button
                onClick={goToLobby}
                className="dc-play-btn"
                style={{
                  alignSelf: buttonAlign,
                  marginTop: 4,
                  background: "#A855F7", // Purple theme button
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
                {c.lobbyPlayLabel}
              </button>
            </div>
          </article>

          {/* Arcade — available */}
          <article
            style={{
              animation: "dc-pop-in 0.5s ease 0.4s both",
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
                background: "#E0E7FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "#7C3AED",
                  border: "3px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  transform: "rotate(-7deg)",
                }}
              >
                🐍
              </div>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "#22D3EE",
                  border: "3px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  transform: "rotate(7deg)",
                }}
              >
                👾
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
                  {c.arcadeTitle}
                </div>
                <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                  {c.arcadeSubtitle}
                </div>
              </div>
              <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                {c.arcadeDesc}
              </p>
              <button
                onClick={goToArcade}
                className="dc-play-btn"
                style={{
                  alignSelf: buttonAlign,
                  marginTop: 4,
                  background: "#7C3AED",
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
                {c.arcadePlayLabel}
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
    </>
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
