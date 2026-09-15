import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/languageContext";
import { useGame } from "@/lib/gameContext";
import { Seo } from "@/lib/seo";
import { BRAND, GAMES, url } from "@/lib/brand";

/**
 * Landing / game hub — Safariyat Games sticker-style card layout
 * powered by the unified Party creation & room joining engine.
 */

const LS_NAME = `${BRAND.id}_playerName`;

const COPY = {
  ar: {
    siteName: "ألعاب سفريات",
    toggleLabel: "English",
    heroTitle: "لمّ أصحابك في أوضة واحدة",
    heroSubtitle: "أوضة واحدة ولينك واحد. اختاروا اللعبة بعد ما الكل يدخل — وغيّروها وقت ما تحبوا من غير ما حد يدخل تاني.",
    nameLabel: "اسمك:",
    namePlaceholder: "اكتب اسمك هنا (مثال: كريم)",
    codePlaceholder: "كود الغرفة (8 أرقام)",
    joinBtn: "انضمام",
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
    rentoTitle: "رينتو",
    rentoSubtitle: "Rento",
    rentoDesc: "لعبة صفقات عقارية. ارمِ النرد واشترِ الملكيات وافلس خصومك!",
    rentoPlayLabel: "العب الآن",
    spyfallTitle: "برا اللعبة",
    spyfallSubtitle: "Spyfall",
    spyfallDesc: "الكل عارف المكان ودوره فيه ما عدا الجاسوس! اسألوا بعض واكشفوا الجاسوس قبل فوات الأوان!",
    chameleonTitle: "الحرباية",
    chameleonSubtitle: "Chameleon",
    chameleonDesc: "ستاشر كلمة على الشبكة وواحدة سرية. الكل عارفها ما عدا الحرباية — كلمة واحدة وصوتوا!",
    tabooTitle: "تابو",
    tabooSubtitle: "Taboo",
    tabooDesc: "وصّف الكلمة لفريقك بالصوت من غير ما تقول أي من الكلمات الأربعة الممنوعة! محتاجة المايك.",
    bluffTitle: "بلوف",
    bluffSubtitle: "Bluff",
    bluffDesc: "اكتب إجابة مزيفة ذكية، واكشف الإجابة الحقيقية واخدع أصحابك لتجمع أعلى نقاط!",
    wyrTitle: "لو خيّروك",
    wyrSubtitle: "Would You Rather",
    wyrDesc: "سؤال مستحيل بين خيارين! جاوب في السر وخمّن أصحابك اختاروا إيه!",
    arcadeTitle: "صالة الألعاب",
    arcadeSubtitle: "Arcade",
    arcadeDesc: "مجموعة ألعاب أركيد أحادية اللاعب تلعبها مباشرة في المتصفح — أفعى، تيك تاك تو، نزال، وغزاة الفضاء!",
    arcadePlayLabel: "ادخل الصالة",
    nameModalTitle: "أهلاً بك! ما اسمك؟",
    nameModalSub: "أدخل اسمك لبدء اللعبة وإنشاء الغرفة فوراً",
    nameModalBtn: "ابدأ اللعب الآن",
    heroCta: "افتح أوضة",
    heroCtaBusy: "جارٍ فتح الأوضة...",
    heroJoinHint: "معاك كود أوضة؟",
    gamesHeading: "تقدروا تلعبوا إيه",
    gamesNote: "كل اللعب دي بتتختار من جوّه الأوضة — مفيش لينك منفصل لكل لعبة.",
    howToPlay: "إزاي تلعبها",
    hideHow: "إخفاء",
    arcadeSolo: "أو العب لوحدك في الصالة ←",
    game1How: [
      "كل واحد ياخد كروت، ويتحدد نوع الادعاء — قلوب مثلاً.",
      "في دورك تحط كارت أو أكتر مقلوبين وتقول إنهم النوع ده. ممكن تكون بتكدب.",
      "أي حد يقدر يقول «أشك». واللي يطلع غلطان ياخد الكومة كلها.",
      "أول واحد يخلّص كروته يكسب.",
    ],
    game2How: [
      "فريقين. كل فريق عنده قائد تلميح شايف الكلمات بتاعة مين.",
      "القائد يقول كلمة واحدة ورقم — الرقم هو عدد الكلمات اللي بيشاور عليها.",
      "فريقه يدوس على الكلمات. الغلط ينهي الدور، والقاتل يخسّركم على طول.",
      "أول فريق يلاقي كل كلماته يكسب.",
    ],
    game3How: [
      "كل واحد بياخد رقم سري بين ١ و٩٩ — وانت كمان.",
      "في دورك خمّن رقمك، وهيقولك الرقم الحقيقي أعلى ولا أقل.",
      "المدى بتاعك بيضيق مع كل تخمينة، وكذلك الباقيين.",
      "أول واحد يقول رقمه بالظبط ياخد الجولة.",
    ],
    game4How: [
      "الـ٢٨ حجر بيتوزعوا كلهم. مفيش بنك — اللي في إيدك هو اللي عندك.",
      "الدبل ستة بيفتح، وبعدين تلعب على أي طرف مفتوح بنفس النقطة.",
      "مش عارف تلعب؟ طقّ — والكل هيعرف إنت ناقصك إيه.",
      "خلّص الأول، أو كون الأقل لما الطاولة تتقفل. السباق لـ١٠١.",
    ],
    rentoHow: [
      "ارمي النرد ولف على اللوحة، واشتري المدن اللي تقف عليها.",
      "لو وقفت على مدينة حد تاني، تدفعله إيجار.",
      "تقدر تبادل عقارات وفلوس مع أي حد في أي وقت.",
      "آخر واحد مفلسش هو اللي يكسب.",
    ],
    spyfallHow: [
      "الكل بياخد نفس المكان ودور فيه — ما عدا جاسوس واحد مبياخدش حاجة.",
      "دوروا على بعض بأسئلة عن المكان اللي انتوا فيه.",
      "جاوب كفاية عشان تثبت إنك منهم، من غير ما تكشف المكان للجاسوس.",
      "اتهم لما تتأكد. والجاسوس يكسب لو خمّن المكان أو لو مااتمسكش.",
    ],
    chameleonHow: [
      "ستاشر كلمة في شبكة. الكل شايف الكلمة السرية — ما عدا الحرباية.",
      "بالدور، كل واحد يقول كلمة واحدة بس عنها، بصوت عالي.",
      "لو كلمتك مبهمة هتبان عليك، ولو واضحة قوي الحرباية هتعرف الكلمة.",
      "صوّتوا. والحرباية لو اتمسكت لسه ليها تخمينة واحدة على الكلمة.",
    ],
    tabooHow: [
      "الفرق بتتقسم لوحدها. واحد بيوصّف الكلمة اللي على الكارت بصوت عالي.",
      "فريقه بيخمّن بصوت عالي. ستين ثانية للدور.",
      "الفريق التاني ماسك الكارت وشايف الأربع كلمات الممنوعة.",
      "صح: +١. ولو قلت كلمة ممنوعة: −١. والتمرير مش بيكلّف غير الوقت.",
    ],
    bluffHow: [
      "تظهر جملة ناقصها كلمة. كل واحد يكتب إجابة من مخّه.",
      "كل الإجابات المخترعة بتتخلط مع الإجابة الحقيقية.",
      "اختار اللي مصدّقها — ومش هتقدر تختار بتاعتك.",
      "لو لقيت الصح: +٢. وكل صاحب يصدّق كذبتك: +١.",
    ],
    wyrHow: [
      "واحد بيبقى هو الموضوع، بياخد سؤال مستحيل ويجاوب في السر.",
      "الباقيين يخمّنوا هو اختار إيه.",
      "لو خمّنت صح تاخد نقطة — يبقى يستاهل إنك تعرف أصحابك.",
      "وصاحب السؤال بياخد نقطة عن كل واحد خمّن غلط.",
    ],
    arcadeHow: [
      "أفعى، إكس أو، تتريس، الذاكرة، نزال، غزاة الفضاء، وسلم وثعبان.",
      "كلها موجودة في قائمة ألعاب الأوضة زي أي لعبة تانية.",
    ],
    footerText: "© 2026 ألعاب سفريات — العب في أي وقت، في أي مكان.",
  },
  en: {
    siteName: "Safariyat Games",
    toggleLabel: "العربية",
    heroTitle: "Get your friends in one room",
    heroSubtitle: "One room, one link. Pick a game once everyone is in \u2014 and switch whenever you like, without anyone re-joining.",
    nameLabel: "Your Name:",
    namePlaceholder: "Type your name (e.g. Alex)",
    codePlaceholder: "8-digit room code",
    joinBtn: "Join",
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
    rentoTitle: "Rento",
    rentoSubtitle: "Rento",
    rentoDesc: "Multiplayer property trading. Roll dice, buy properties, and bankrupt your rivals!",
    rentoPlayLabel: "Play now",
    spyfallTitle: "Spyfall",
    spyfallSubtitle: "برا اللعبة",
    spyfallDesc: "Everyone knows the location except the spy! Ask tricky questions and catch the spy before time runs out!",
    chameleonTitle: "Chameleon",
    chameleonSubtitle: "الحرباية",
    chameleonDesc: "Sixteen words on a grid and one is secret. Say one word each, then vote to catch the chameleon!",
    tabooTitle: "Taboo",
    tabooSubtitle: "تابو",
    tabooDesc: "Describe the mystery word to your team without saying the 4 forbidden taboo words! Voice required.",
    bluffTitle: "Bluff",
    bluffSubtitle: "بلوف",
    bluffDesc: "Invent hilarious fake answers to tricky trivia questions. Spot the truth and fool your friends!",
    wyrTitle: "Would You Rather",
    wyrSubtitle: "لو خيّروك",
    wyrDesc: "Answer an impossible dilemma in secret, then see who really knows how their friends think!",
    arcadeTitle: "Arcade",
    arcadeSubtitle: "Arcade",
    arcadeDesc: "A collection of single-player arcade games you can play right in your browser — Snake, Tic-Tac-Toe, Fighter, and Space Invaders!",
    arcadePlayLabel: "Enter Arcade",
    nameModalTitle: "Welcome! What is your name?",
    nameModalSub: "Enter your name to start the party and create the room",
    nameModalBtn: "Start Playing Now",
    heroCta: "Start a room",
    heroCtaBusy: "Opening the room...",
    heroJoinHint: "Got a room code?",
    gamesHeading: "What you can play",
    gamesNote: "Every one of these is picked from inside the room \u2014 there is no separate link per game.",
    howToPlay: "How to play",
    hideHow: "Hide",
    arcadeSolo: "Or play solo in the arcade \u2192",
    game1How: [
      "Everyone gets a hand of cards, and a claim is set \u2014 hearts, say.",
      "On your turn, play one or more cards face down and claim they match. You may be lying.",
      "Anyone can call liar. Whoever turns out to be wrong takes the whole pile.",
      "First to empty their hand wins.",
    ],
    game2How: [
      "Two teams. Each has a spymaster who can see which words belong to whom.",
      "The spymaster gives one word and a number \u2014 the number is how many words it points at.",
      "Their team taps words. A wrong one ends the turn; the assassin loses it on the spot.",
      "First team to find all its words wins.",
    ],
    game3How: [
      "Everyone is given a secret number between 1 and 99 \u2014 including you.",
      "On your turn, guess yours. You are told whether the real one is higher or lower.",
      "Your range narrows with every guess, and so does everyone else's.",
      "First to name their own number takes the round.",
    ],
    game4How: [
      "All 28 tiles are dealt. There is no boneyard \u2014 what you hold is what you get.",
      "Double-six opens. After that, match a pip on either open end.",
      "Cannot play? Knock \u2014 and everyone learns what you do not have.",
      "Go out first, or be lowest when the table locks. Race to 101.",
    ],
    rentoHow: [
      "Roll and move around the board, buying the cities you land on.",
      "Land on someone else's city and you pay them rent.",
      "Trade properties and cash with anyone, at any time.",
      "The last player who is not bankrupt wins.",
    ],
    spyfallHow: [
      "Everyone gets the same place and a role in it \u2014 except one spy, who gets nothing.",
      "Go round asking each other questions about where you are.",
      "Answer well enough to prove you belong, without naming the place for the spy.",
      "Accuse when you are sure. The spy wins by guessing the place, or by not being caught.",
    ],
    chameleonHow: [
      "Sixteen words on a grid. Everyone can see which one is secret \u2014 except the chameleon.",
      "Going round, each player says exactly one word about it, out loud.",
      "Too vague and you look guilty; too clear and the chameleon simply learns the word.",
      "Vote. A caught chameleon still gets one guess at the word.",
    ],
    tabooHow: [
      "Teams are drawn for you. One player describes the word on the card out loud.",
      "Their team shouts guesses. Sixty seconds a turn.",
      "The other team is holding the card and can see the four words you may not say.",
      "Right: +1. Caught saying a forbidden word: \u22121. Passing costs only the clock.",
    ],
    bluffHow: [
      "A sentence appears with one word missing. Everyone types an answer they invented.",
      "All the inventions are shuffled in with the real one.",
      "Pick the one you believe \u2014 you cannot pick your own.",
      "Finding the truth: +2. Every friend who falls for your lie: +1.",
    ],
    wyrHow: [
      "One person is the subject. They get an impossible question and answer it in secret.",
      "Everyone else guesses which one they picked.",
      "Guess right and you score \u2014 so it pays to actually know your friends.",
      "The subject scores for every person who got it wrong.",
    ],
    arcadeHow: [
      "Snake, Tic-Tac-Toe, Tetris, Memory, Fighter, Space Invaders, Snakes & Ladders.",
      "All of them are in the room's game picker, same as everything else.",
    ],
    footerText: "© 2026 Safariyat Games — play anytime, anywhere.",
  },
} as const;

const BUTTON_FONT = "'Baloo 2', sans-serif";

export default function Landing() {
  const navigate = useNavigate();
  const { lang, isSwitching, toggleLang, t } = useLanguage();
  const { createRoom, joinRoom, addToast } = useGame();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [pendingGameId, setPendingGameId] = useState<string | null>(null);

  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const textAlign = isAr ? "right" : "left";
  const buttonAlign = isAr ? "flex-end" : "flex-start";
  const badgeSide = isAr ? "left" : "right";
  const font = isAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif";

  useEffect(() => {
    try {
      setName(localStorage.getItem(LS_NAME) ?? "");
    } catch {
      /* private mode */
    }
  }, []);

  const remember = (value: string) => {
    try {
      localStorage.setItem(LS_NAME, value);
    } catch {
      /* ignore */
    }
  };

  /**
   * The new Party play logic: creates a room with the staged game
   * and navigates to the persistent party hub /r/:roomId.
   */
  const startParty = async (gameId?: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      // Prompt user with modal to get name
      setPendingGameId(gameId ?? "party");
      return;
    }

    const targetGame = gameId ?? "party";
    setBusyGameId(targetGame);
    try {
      const { roomId } = await createRoom({
        playerName: trimmed,
        gameId: targetGame,
        maxPlayers: 8,
      });
      remember(trimmed);
      navigate(`/r/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("landing.create_failed"), "error");
    } finally {
      setBusyGameId(null);
    }
  };

  /**
   * Room joining logic: joins existing room code or navigates to join preview.
   */
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\D/g, "").slice(0, 8);
    const trimmedName = name.trim();

    if (!cleanCode) {
      addToast(t("domino.enter_code"), "error");
      return;
    }

    if (!trimmedName) {
      // Direct to preview page where name can be entered
      navigate(`/j/${cleanCode}`);
      return;
    }

    setIsJoining(true);
    try {
      await joinRoom(cleanCode, trimmedName);
      remember(trimmedName);
      navigate(`/r/${cleanCode}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("join.failed"), "error");
    } finally {
      setIsJoining(false);
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    remember(trimmed);
    const target = pendingGameId;
    setPendingGameId(null);
    if (target) {
      void startParty(target);
    }
  };

  const goToArcade = useCallback(() => navigate("/arcade"), [navigate]);

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${url("/")}#website`,
        url: url("/"),
        name: BRAND.name,
        description: BRAND.description[lang],
        inLanguage: ["en", "ar"],
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Games on ${BRAND.name}`,
        itemListElement: GAMES.map((game, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "VideoGame",
            name: game.name[lang],
            url: url(game.path),
            description: game.description[lang],
            playMode: "MultiPlayer",
            gamePlatform: "Web browser",
            applicationCategory: "Game",
            numberOfPlayers: {
              "@type": "QuantitativeValue",
              minValue: game.minPlayers,
              maxValue: game.maxPlayers,
            },
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        })),
      },
    ],
    [lang],
  );

  return (
    <>
      <Seo
        lang={isAr ? "ar" : "en"}
        title={
          isAr
            ? "ألعاب سفريات — ألعاب جماعية أونلاين مجانية"
            : "Safariyat Games — Free online multiplayer party games"
        }
        description={
          isAr
            ? "العب ألعاب جماعية أونلاين مجانية مع أصدقائك — أشك، كودنيمز، دومينو الشارع، والمزيد. شات صوتي مدمج بدون تحميل."
            : "Play free online multiplayer party games with friends — Liar's Bar, Codenames, Egyptian Street Domino, and more. Built-in voice, no download."
        }
        path="/"
        jsonLd={jsonLd}
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
            maxWidth: 1180,
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
            <div
              style={{
                fontFamily: font,
                fontWeight: 800,
                fontSize: 20,
                lineHeight: 1.1,
                color: "#2B2420",
              }}
            >
              {c.siteName}
            </div>
          </div>

          <button
            onClick={toggleLang}
            disabled={isSwitching}
            className="dc-lang-btn"
            style={{
              border: "2px solid #2B2420",
              background: "#FFFFFF",
              color: "#2B2420",
              fontFamily: BUTTON_FONT,
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 999,
              cursor: isSwitching ? "wait" : "pointer",
              opacity: isSwitching ? 0.7 : 1,
              boxShadow: "2px 2px 0 rgba(43,36,32,0.15)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {c.toggleLabel}
          </button>
        </header>

        {/* Main Content */}
        <main
          style={{
            flex: 1,
            maxWidth: 1180,
            width: "100%",
            margin: "0 auto",
            padding: "8px 20px 40px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Hero title & subtitle */}
          <section
            style={{
              textAlign,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingTop: 4,
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
                fontSize: 15,
                lineHeight: 1.6,
                margin: 0,
                color: "#5B5147",
              }}
            >
              {c.heroSubtitle}
            </p>

            {/* Sticker Identity & Room Joining Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 8,
                padding: "10px 16px",
                background: "#FFFFFF",
                borderRadius: 18,
                border: "2.5px solid #2B2420",
                boxShadow: "4px 4px 0 #2B2420",
                boxSizing: "border-box",
              }}
            >
              {/* Player Name Input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: "1 1 240px",
                }}
              >
                <span style={{ fontSize: 20 }}>👤</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    remember(e.target.value);
                  }}
                  placeholder={c.namePlaceholder}
                  maxLength={22}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontFamily: font,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#2B2420",
                    width: "100%",
                  }}
                />
              </div>

              {/* Quick Room Code Input & Join */}
              <form
                onSubmit={handleJoin}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flex: "1 1 240px",
                  justifyContent: isAr ? "flex-start" : "flex-end",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#F5F0E6",
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: "1.5px solid #2B2420",
                    flex: "1 1 140px",
                    maxWidth: 200,
                  }}
                >
                  <span style={{ fontSize: 14 }}>🔑</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder={c.codePlaceholder}
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontFamily: font,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#2B2420",
                      width: "100%",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isJoining || !code.trim()}
                  className="dc-play-btn"
                  style={{
                    background: "#3AA6A6",
                    color: "#FDF6EC",
                    border: "none",
                    fontFamily: BUTTON_FONT,
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "7px 18px",
                    borderRadius: 999,
                    cursor: code.trim() ? "pointer" : "not-allowed",
                    opacity: code.trim() ? 1 : 0.6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isJoining ? (isAr ? "جارٍ الدخول..." : "Joining...") : c.joinBtn}
                </button>
              </form>
            </div>

            {/*
              The one button on this page that starts anything.

              It opens a room with no game chosen, which is the whole point of
              the room: the group arrives first and decides together. Every
              game below is reachable from inside it, so none of them needs an
              entrance of its own — and giving them one is what made the room
              look like a twelfth option rather than the way in.
            */}
            <button
              onClick={() => void startParty()}
              disabled={busyGameId !== null}
              className="dc-play-btn"
              style={{
                marginTop: 14,
                width: "100%",
                background: "#E8574A",
                color: "#FDF6EC",
                border: "none",
                fontFamily: BUTTON_FONT,
                fontWeight: 800,
                fontSize: 18,
                padding: "16px 24px",
                borderRadius: 999,
                boxShadow: "4px 4px 0 #2B2420",
                cursor: busyGameId !== null ? "wait" : "pointer",
                opacity: busyGameId === "party" ? 0.75 : 1,
              }}
            >
              {busyGameId === "party" ? c.heroCtaBusy : c.heroCta}
            </button>
          </section>

          {/* Cards Grid */}
          <div style={{ textAlign, marginTop: 8 }}>
            <h2
              style={{
                fontFamily: font,
                fontWeight: 800,
                fontSize: 22,
                margin: 0,
                color: "#2B2420",
              }}
            >
              {c.gamesHeading}
            </h2>
            <p
              style={{
                fontFamily: font,
                fontSize: 14,
                lineHeight: 1.6,
                margin: "4px 0 0",
                color: "#5B5147",
              }}
            >
              {c.gamesNote}
            </p>
          </div>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            {/* Card 1: Liar's Bar */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
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
                  flex: 1,
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
                <HowToPlay
                  steps={c.game1How}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 2: Codenames */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.08s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
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
                    <div key={i} style={{ background: color, borderRadius: 3, border: "1px solid rgba(43,36,32,0.15)" }} />
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
                  flex: 1,
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
                <HowToPlay
                  steps={c.game2How}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 3: Higher or Lower */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.16s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#FEF3C7",
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
                  flex: 1,
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
                <HowToPlay
                  steps={c.game3How}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 4: Classic Dominoes */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.24s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#D1FAE5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", gap: 10, transform: "rotate(-4deg)" }}>
                  {/* Mini Domino 1 */}
                  <div
                    style={{
                      width: 44,
                      height: 76,
                      background: "#FCFBF7",
                      border: "2.5px solid #2B2420",
                      borderRadius: 6,
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      boxShadow: "2px 2px 0 #2B2420",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderBottom: "1.5px solid #2B2420",
                      }}
                    >
                      <div style={{ width: 5, height: 5, background: "#2B2420", borderRadius: "50%" }} />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexWrap: "wrap",
                        padding: 4,
                        gap: 3,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 4,
                        height: 4,
                        background: "#D4AF37",
                        borderRadius: "50%",
                        border: "0.5px solid #9A7B1C",
                      }}
                    />
                  </div>

                  {/* Mini Domino 2 */}
                  <div
                    style={{
                      width: 44,
                      height: 76,
                      background: "#FCFBF7",
                      border: "2.5px solid #2B2420",
                      borderRadius: 6,
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      boxShadow: "2px 2px 0 #2B2420",
                      transform: "translateY(8px) rotate(8deg)",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexWrap: "wrap",
                        padding: 4,
                        gap: 3,
                        alignItems: "center",
                        justifyContent: "center",
                        borderBottom: "1.5px solid #2B2420",
                      }}
                    >
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexWrap: "wrap",
                        padding: 4,
                        gap: 3,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                      <div style={{ width: 4, height: 4, background: "#2B2420", borderRadius: "50%" }} />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 4,
                        height: 4,
                        background: "#D4AF37",
                        borderRadius: "50%",
                        border: "0.5px solid #9A7B1C",
                      }}
                    />
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
                  flex: 1,
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
                <HowToPlay
                  steps={c.game4How}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 6: Rento */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.4s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 12,
                    background: "#F4C89A",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(-6deg)",
                  }}
                >
                  🏠
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
                  🎲
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
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textAlign,
                }}
              >
                <div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                    {c.rentoTitle}
                  </div>
                  <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                    {c.rentoSubtitle}
                  </div>
                </div>
                <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                  {c.rentoDesc}
                </p>
                <HowToPlay
                  steps={c.rentoHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 7: Spyfall (برا اللعبة) */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.44s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#2B2420",
                    color: "#FFFFFF",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(-7deg)",
                  }}
                >
                  🕶️
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#E8574A",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(7deg)",
                  }}
                >
                  🔍
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
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textAlign,
                }}
              >
                <div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                    {c.spyfallTitle}
                  </div>
                  <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                    {c.spyfallSubtitle}
                  </div>
                </div>
                <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                  {c.spyfallDesc}
                </p>
                <HowToPlay
                  steps={c.spyfallHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 8: Chameleon (الحرباية) */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.48s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
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
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#10B981",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(-6deg)",
                  }}
                >
                  🦎
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#7C3AED",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(6deg)",
                  }}
                >
                  🔤
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
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textAlign,
                }}
              >
                <div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                    {c.chameleonTitle}
                  </div>
                  <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                    {c.chameleonSubtitle}
                  </div>
                </div>
                <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                  {c.chameleonDesc}
                </p>
                <HowToPlay
                  steps={c.chameleonHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 9: Taboo (تابو) */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.52s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#FFE4E6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#F43F5E",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(-6deg)",
                  }}
                >
                  🤐
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#FDF6EC",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(6deg)",
                  }}
                >
                  🚫
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
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textAlign,
                }}
              >
                <div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                    {c.tabooTitle}
                  </div>
                  <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                    {c.tabooSubtitle}
                  </div>
                </div>
                <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                  {c.tabooDesc}
                </p>
                <HowToPlay
                  steps={c.tabooHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 10: Bluff (بلوف) */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.56s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#F59E0B",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(-6deg)",
                  }}
                >
                  🤥
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
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
                  ✍️
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
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textAlign,
                }}
              >
                <div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                    {c.bluffTitle}
                  </div>
                  <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                    {c.bluffSubtitle}
                  </div>
                </div>
                <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                  {c.bluffDesc}
                </p>
                <HowToPlay
                  steps={c.bluffHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 11: Would You Rather (لو خيّروك) */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.6s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
                  background: "#FEF9C3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#FBBF24",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(-6deg)",
                  }}
                >
                  🤔
                </div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#EC4899",
                    border: "3px solid #2B2420",
                    boxShadow: "3px 3px 0 #2B2420",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    transform: "rotate(6deg)",
                  }}
                >
                  ⚖️
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
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textAlign,
                }}
              >
                <div>
                  <div style={{ fontFamily: font, fontWeight: 800, fontSize: 22, color: "#2B2420" }}>
                    {c.wyrTitle}
                  </div>
                  <div style={{ fontFamily: font, fontSize: 14, color: "#8A7F73", marginTop: 2 }}>
                    {c.wyrSubtitle}
                  </div>
                </div>
                <p style={{ fontFamily: font, fontSize: 14, lineHeight: 1.6, color: "#5B5147", margin: 0 }}>
                  {c.wyrDesc}
                </p>
                <HowToPlay
                  steps={c.wyrHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
              </div>
            </article>

            {/* Card 12: Arcade */}
            <article
              className="dc-game-card"
              style={{
                animation: "dc-pop-in 0.5s ease 0.64s both",
                background: "#FFFFFF",
                borderRadius: 24,
                border: "3px solid #2B2420",
                overflow: "hidden",
                boxShadow: "6px 6px 0 #2B2420",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  height: 140,
                  flexShrink: 0,
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
                  flex: 1,
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
                <HowToPlay
                  steps={c.arcadeHow}
                  label={c.howToPlay}
                  hideLabel={c.hideHow}
                  align={buttonAlign}
                  font={font}
                  textAlign={textAlign}
                />
                <button
                  onClick={goToArcade}
                  style={{
                    alignSelf: buttonAlign,
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: font,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#3AA6A6",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {c.arcadeSolo}
                </button>
              </div>
            </article>
          </section>
        </main>

        <footer
          style={{
            textAlign: "center",
            padding: "20px 20px 32px",
            fontFamily: font,
            fontSize: 13,
            color: "#8A7F73",
          }}
        >
          {c.footerText}
        </footer>
      </div>

      {/* Name Prompt Sticker Modal */}
      {pendingGameId && (
        <div
          dir={dir}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(43, 36, 32, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            animation: "dc-overlay-in 0.2s ease forwards",
          }}
          onClick={() => setPendingGameId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              border: "3.5px solid #2B2420",
              boxShadow: "8px 8px 0 #2B2420",
              padding: "28px 32px",
              maxWidth: 420,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              textAlign,
              transform: "scale(1)",
              animation: "dc-pop-in 0.25s ease both",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  background: "#F4C89A",
                  border: "2.5px solid #2B2420",
                  boxShadow: "3px 3px 0 #2B2420",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                👋
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: font,
                    fontWeight: 800,
                    fontSize: 20,
                    margin: 0,
                    color: "#2B2420",
                  }}
                >
                  {c.nameModalTitle}
                </h3>
                <p
                  style={{
                    fontFamily: font,
                    fontSize: 13,
                    color: "#8A7F73",
                    margin: "3px 0 0",
                  }}
                >
                  {c.nameModalSub}
                </p>
              </div>
            </div>

            <form
              onSubmit={handleModalSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#FDF6EC",
                  border: "2.5px solid #2B2420",
                  borderRadius: 14,
                  padding: "10px 14px",
                }}
              >
                <span style={{ fontSize: 18 }}>👤</span>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.namePlaceholder}
                  maxLength={22}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontFamily: font,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#2B2420",
                    width: "100%",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setPendingGameId(null)}
                  style={{
                    background: "transparent",
                    border: "2px solid #2B2420",
                    borderRadius: 999,
                    padding: "8px 18px",
                    fontFamily: BUTTON_FONT,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    color: "#5B5147",
                  }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="dc-play-btn"
                  style={{
                    background: "#E8574A",
                    border: "none",
                    borderRadius: 999,
                    padding: "9px 24px",
                    fontFamily: BUTTON_FONT,
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#FDF6EC",
                    cursor: name.trim() ? "pointer" : "not-allowed",
                    opacity: name.trim() ? 1 : 0.6,
                    boxShadow: "2px 2px 0 #2B2420",
                  }}
                >
                  {c.nameModalBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The rules for one game, folded away until asked for.
 *
 * These cards used to end in a "Play now" button that opened a room with that
 * game already chosen. That is the old shape of the product: decide the game,
 * then find people. The room came first for a reason — you get your friends in
 * and pick afterwards, together — so the cards here are now what a shelf of
 * boxes is: what the game is, and how it goes. Starting is one button, at the
 * top, and it belongs to the room rather than to any game.
 *
 * Collapsed by default because twelve open rule-lists is a wall of text, and
 * inline rather than in a modal because a modal on a phone hides the thing you
 * were comparing it against.
 */
function HowToPlay({
  steps,
  label,
  hideLabel,
  align,
  font,
  textAlign,
}: {
  steps: readonly string[];
  label: string;
  hideLabel: string;
  align: "flex-start" | "flex-end";
  font: string;
  textAlign: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="dc-play-btn"
        style={{
          alignSelf: align,
          background: open ? "#2B2420" : "#FFFFFF",
          color: open ? "#FDF6EC" : "#2B2420",
          border: "2px solid #2B2420",
          fontFamily: BUTTON_FONT,
          fontWeight: 700,
          fontSize: 14,
          padding: "8px 18px",
          borderRadius: 999,
          cursor: "pointer",
        }}
      >
        {open ? hideLabel : label}
      </button>

      {open && (
        <ol
          style={{
            margin: 0,
            paddingInlineStart: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            textAlign,
            fontFamily: font,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "#5B5147",
          }}
        >
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
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
