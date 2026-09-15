/**
 * ============================================================================
 *  THE BRAND LIVES HERE. NOWHERE ELSE.
 * ============================================================================
 *
 * Every user-visible piece of identity — the name, the tagline, the domain,
 * the colours, the social handles, the share text — is read from this file.
 * Renaming the product is editing the constants below; it is never a grep.
 *
 * Three files cannot import TypeScript because crawlers must read them without
 * running JavaScript (`web/index.html`, `web/public/sitemap.xml`,
 * `web/public/site.webmanifest`). They are GENERATED from this file by
 * `npm run brand:sync` — see `web/scripts/sync-brand.mjs`. Run it after any
 * change here.
 *
 * See docs/BRANDING.md for the naming rationale and the domain shortlist.
 */

export type Lang = "en" | "ar";

/** A string that exists in both languages. */
export interface Bilingual {
  en: string;
  ar: string;
}

export function pick(text: Bilingual, lang: Lang): string {
  return text[lang];
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const BRAND = {
  /** Machine id: used for localStorage key prefixes and analytics. */
  id: "lamma",

  /** Display name, Latin script. */
  name: "Lamma",
  /** Display name, Arabic script. */
  nameAr: "لمّة",

  /**
   * Apex domain, no protocol, no trailing slash.
   *
   * This is still `games.safariyat.live` until the new domain is registered.
   * Changing it here updates canonical URLs, OG tags, share links and the
   * sitemap — then run `npm run brand:sync`.
   */
  domain: "games.safariyat.live",

  /** What the product is, in one line. Used in OG descriptions and the hero. */
  tagline: {
    en: "Get the gang together.",
    ar: "اللمة على بعد لينك",
  } satisfies Bilingual,

  /** Second-line tagline, used where the first is already the headline. */
  subTagline: {
    en: "One link. Everyone's in.",
    ar: "لينك واحد، والباقي علينا",
  } satisfies Bilingual,

  /** Full sentence for meta descriptions. Keep under ~155 characters. */
  description: {
    en: "Free online party games you can play with friends in one browser tab — domino, bluffing card games, word games and more. Voice chat built in. No download, no sign-up.",
    ar: "ألعاب جماعية أونلاين تلعبها مع أصحابك من المتصفح — دومينو، ألعاب ورق، ألعاب كلمات وأكتر. شات صوتي جوّه اللعبة. من غير تحميل ولا تسجيل.",
  } satisfies Bilingual,

  /**
   * Where to reach the product. Empty string = not set up yet; the UI hides
   * any link whose handle is empty rather than rendering a dead link.
   */
  social: {
    tiktok: "",
    instagram: "",
    x: "",
    discord: "",
  },

  /** Contact address shown in the footer, or "" to hide it. */
  supportEmail: "",
} as const;

/** `https://lamma.gg` — protocol included, no trailing slash. */
export const SITE_URL = `https://${BRAND.domain}`;

/** Absolute URL for a path like `/domino`. */
export function url(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * The palette, as raw hex. `web/src/index.css` mirrors these as CSS custom
 * properties — that file is the runtime source of truth for styling; this
 * object is for the places CSS can't reach (canvas games, meta theme-color,
 * SVG generation, the manifest).
 *
 * KEEP THE TWO IN SYNC. The design rationale is in docs/DESIGN_SYSTEM.md.
 */
export const COLORS = {
  /** Page ground. Warm near-black — never #000, which looks like a void on OLED. */
  ink900: "#14100E",
  ink800: "#1C1714",
  /** Raised surfaces: cards, sheets, the table. */
  ink700: "#251E1A",
  ink600: "#332A24",
  /** Hairlines and dividers. */
  ink500: "#43382F",

  /** Body text on dark. */
  cream: "#F5EDE2",
  /** Secondary text; passes AA on ink900. */
  sand: "#B9A895",

  /** THE accent. Every primary action is this colour and nothing else is. */
  coral: "#E8563F",
  coralDim: "#B83E2C",
  coralGlow: "rgba(232, 86, 63, 0.35)",

  /** Reserved for realtime/"live" state only: connected, voice on, your turn. */
  mint: "#3BD9A4",
  mintDim: "#1F9B72",

  /** Scores, wins, the room code. Used sparingly so it stays special. */
  gold: "#F2B441",

  /** Errors, elimination, "liar!". */
  ruby: "#E23D57",
  /** Teams / secondary game accents. */
  violet: "#9A6BF0",
  sky: "#4EA8F5",
} as const;

// ---------------------------------------------------------------------------
// Game catalogue
// ---------------------------------------------------------------------------

export type GameCategory = "party" | "duel" | "solo";

export type GameStatus = "live" | "beta" | "soon";

export interface GameMeta {
  /** Must match the server's gameId in `server/src/games/registry.ts`. */
  id: string;
  name: Bilingual;
  /** One line shown on the game card. */
  blurb: Bilingual;
  /** Longer copy for the game's own page and its JSON-LD description. */
  description: Bilingual;
  /** `party` = everyone together; `duel` = head-to-head; `solo` = single player. */
  category: GameCategory;
  status: GameStatus;
  minPlayers: number;
  maxPlayers: number;
  /** Rough minutes for one full game. Shown on the card. */
  minutes: [number, number];
  /** Route to the game's own home/setup page. */
  path: string;
  /** Emoji fallback used until the illustrated art in docs/IMAGE_BRIEFS.md exists. */
  emoji: string;
  /** One of COLORS' accent keys — tints the card. */
  accent: keyof typeof COLORS;
  /** Does the game get better with voice on? Drives the "voice recommended" badge. */
  voiceMatters: boolean;
  /** Can be played usefully with bots filling empty seats. */
  supportsBots: boolean;
  /** Path under /public for the illustrated card art. Generated later; see IMAGE_BRIEFS.md. */
  art: string;
}

export const GAMES: GameMeta[] = [
  {
    id: "domino",
    name: { en: "Domino", ar: "دومينو" },
    blurb: {
      en: "Street rules, partners, and a table that talks back.",
      ar: "دومينو الشارع — بالطقم، وبالكلام اللي مالوش لازمة.",
    },
    description: {
      en: "Egyptian street domino played the way it's played on the pavement: partners across the table, a race to 101, and a knock that ends the round and reveals everyone's hand at once.",
      ar: "دومينو مصري بقواعد الشارع: الطقم قصاد بعضه، السباق لـ101، والحجر الأخير اللي يقفل الدور ويكشف إيد الكل مرة واحدة.",
    },
    category: "party",
    status: "live",
    minPlayers: 2,
    maxPlayers: 4,
    minutes: [10, 25],
    path: "/domino",
    emoji: "🁫",
    accent: "mint",
    voiceMatters: true,
    supportsBots: true,
    art: "/art/games/domino.webp",
  },
  {
    id: "spyfall",
    name: { en: "Spyfall", ar: "برا اللعبة" },
    blurb: {
      en: "Everyone knows where they are. One of you is guessing.",
      ar: "الكل عارف هما فين. واحد فيكم بيخمّن.",
    },
    description: {
      en: "Everyone gets the same place and a role in it — except the spy, who gets nothing. Ask each other questions until someone gives themselves away. The whole game is the conversation, so it lives or dies on voice chat.",
      ar: "الكل بياخد نفس المكان ودور فيه — ما عدا الجاسوس، اللي مبياخدش حاجة. اسألوا بعض لحد ما حد يفضح نفسه. اللعبة كلها كلام، فهي عايزة المايك مفتوح.",
    },
    category: "party",
    status: "live",
    minPlayers: 3,
    maxPlayers: 10,
    minutes: [8, 20],
    path: "/spyfall",
    emoji: "🕶️",
    accent: "ruby",
    voiceMatters: true,
    supportsBots: false,
    art: "/art/games/spyfall.webp",
  },
  {
    id: "liars-bar",
    name: { en: "Liar's Bar", ar: "أشك" },
    blurb: {
      en: "Lie with a straight face. Get caught, lose everything.",
      ar: "اكدب وانت مبتسم. لو اتمسكت، تخسر الكل.",
    },
    description: {
      en: "Play cards face down and declare what they are. Anyone can call you a liar — if they're wrong they take the pile, if they're right you do. The last player holding cards loses.",
      ar: "ارمي ورقك مقلوب واعلن إنه إيه. أي حد يقدر يقول لك 'أشك' — لو غلط ياخد الكومة، لو صح انت اللي تاخدها. آخر واحد ماسك ورق هو الخسران.",
    },
    category: "party",
    status: "live",
    minPlayers: 2,
    maxPlayers: 6,
    minutes: [8, 20],
    path: "/play",
    emoji: "🃏",
    accent: "coral",
    voiceMatters: true,
    supportsBots: true,
    art: "/art/games/liars-bar.webp",
  },
  {
    id: "codenames",
    name: { en: "Codenames", ar: "كودنيمز" },
    blurb: {
      en: "One word, two meanings, four confused friends.",
      ar: "كلمة واحدة، معنيين، وأربع أصحاب تايهين.",
    },
    description: {
      en: "Two teams, one grid of words, and a spymaster who can only say one word at a time. Fully bilingual — the whole board plays in Arabic or English.",
      ar: "فريقين، شبكة كلمات، وقائد مايقدرش يقول غير كلمة واحدة. اللعبة كاملة بالعربي أو بالإنجليزي.",
    },
    category: "party",
    status: "live",
    minPlayers: 4,
    maxPlayers: 10,
    minutes: [15, 30],
    path: "/codenames",
    emoji: "🕵️",
    accent: "sky",
    voiceMatters: true,
    supportsBots: false,
    art: "/art/games/codenames.webp",
  },
  {
    id: "higher-lower",
    name: { en: "Higher or Lower", ar: "أعلى ولا أقل" },
    blurb: {
      en: "Everyone's guessing. Only one range is yours.",
      ar: "الكل بيخمّن. مدى واحد بس بتاعك.",
    },
    description: {
      en: "A fast number-guessing race. Every guess narrows the range for everyone, so you're reading the room as much as the numbers.",
      ar: "سباق تخمين سريع. كل تخمينة بتضيّق المدى على الكل، فانت بتقرا اللاعيبة زي ما بتقرا الأرقام.",
    },
    category: "party",
    status: "live",
    minPlayers: 2,
    maxPlayers: 6,
    minutes: [5, 10],
    path: "/higher-lower",
    emoji: "🔢",
    accent: "gold",
    voiceMatters: false,
    supportsBots: false,
    art: "/art/games/higher-lower.webp",
  },
  {
    id: "rento",
    name: { en: "Rento", ar: "رينتو" },
    blurb: {
      en: "Buy the street. Charge your friends to walk on it.",
      ar: "اشتري الشارع، وخلّي أصحابك يدفعوا عشان يمشوا فيه.",
    },
    description: {
      en: "The property-trading board game, online and on a timer so nobody's turn takes nine minutes. Trade, build, and bankrupt the group.",
      ar: "لعبة شراء وبيع العقارات، أونلاين وبمؤقّت عشان محدش ياخد دوره تسع دقايق. قايض، ابني، وفلّس الكل.",
    },
    category: "party",
    status: "live",
    minPlayers: 2,
    maxPlayers: 6,
    minutes: [25, 60],
    path: "/rento",
    emoji: "🏘️",
    accent: "violet",
    voiceMatters: true,
    supportsBots: true,
    art: "/art/games/rento.webp",
  },
];

/** Games available inside a party room, in the order they should be offered. */
export const PARTY_GAME_IDS = [
  "domino",
  "spyfall",
  "liars-bar",
  "codenames",
  "higher-lower",
  "rento",
  "tictactoe",
  "snake",
  "tetris",
  "memory-puzzle",
  "space-invaders",
  "fighter",
  "snake-ladder",
] as const;

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}

// ---------------------------------------------------------------------------
// Share text
// ---------------------------------------------------------------------------

/**
 * The message that gets pasted into WhatsApp. This is the single most
 * important string in the product — it is how every new player arrives.
 *
 * Kept deliberately short: WhatsApp truncates the preview, and a long message
 * reads like spam. The room code is repeated in text because link previews are
 * often stripped in group chats.
 */
export function inviteText(roomCode: string, lang: Lang, gameName?: string): string {
  const link = url(`/j/${roomCode}`);
  if (lang === "ar") {
    return gameName
      ? `يلا نلعب ${gameName} 🎮\nالكود: ${roomCode}\n${link}`
      : `يلا لمّة 🎮\nالكود: ${roomCode}\n${link}`;
  }
  return gameName
    ? `Let's play ${gameName} 🎮\nCode: ${roomCode}\n${link}`
    : `${BRAND.name} time 🎮\nCode: ${roomCode}\n${link}`;
}

/** Short invite link for a room. Short because it gets typed by hand. */
export function inviteUrl(roomCode: string): string {
  return url(`/j/${roomCode}`);
}
