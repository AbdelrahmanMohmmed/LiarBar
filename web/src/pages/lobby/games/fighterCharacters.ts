/**
 * Playable fighter characters. "sheet" characters (cat/mon) are one combined
 * multi-row image, row-indexed by actionRow() 0-6. "strips" characters are one
 * separate horizontal-strip image per action; the source packs don't have a
 * dedicated animation for every action, so several actions intentionally fall
 * back to the closest available strip (documented per character below).
 */
export type FighterAction = "idle" | "walk" | "jump" | "hand" | "kick" | "special" | "parry" | "hit" | "dead";

export interface CharacterDef {
  id: string;
  label: string;
  kind: "sheet" | "strips";
  tile: number;
  scale: number;
  // "sheet"
  sheetSrc?: string;
  frameCounts?: number[]; // indexed by actionRow() 0-6
  // "strips"
  stripSrcs?: Partial<Record<FighterAction, string>>;
  stripFrameCounts?: Partial<Record<FighterAction, number>>;
  /**
   * Source-pixel crop rectangle within a single tile×tile frame — some packs
   * (Samurai, Martial Hero) have the actual character occupying only a small
   * region of each frame with lots of transparent padding around it. When set,
   * `scale` sizes this cropped region instead of the full tile, and the crop's
   * bottom edge is treated as the character's ground contact point. Measured
   * directly from the source PNGs' alpha channel (union across idle/walk/attack
   * frames so the fixed crop covers the full range of motion).
   */
  crop?: { x: number; y: number; w: number; h: number };
}

const SAMURAI_DIR = encodeURI("/arcade-assets/fighter/fighters/FREE_Samurai 2D Pixel Art v1.2/Sprites");
const HERO_DIR = encodeURI("/arcade-assets/fighter/fighters/Martial Hero/Sprites");

export const CHARACTERS: CharacterDef[] = [
  {
    id: "cat",
    label: "Cat",
    kind: "sheet",
    tile: 50,
    scale: 4,
    sheetSrc: "/arcade-assets/fighter/fighters/cat_fighter_sprite1.png",
    frameCounts: [4, 2, 4, 6, 1, 4, 4, 6],
  },
  {
    id: "mon",
    label: "Monster",
    kind: "sheet",
    tile: 60,
    scale: 3,
    sheetSrc: "/arcade-assets/fighter/fighters/mon2_sprite_base.png",
    frameCounts: [4, 4, 4, 4, 1, 3, 7, 7],
  },
  {
    // Only IDLE/RUN/ATTACK1/HURT exist — jump/special/parry fall back to idle/attack1,
    // dead holds the last HURT frame (no dedicated death animation in this pack).
    id: "samurai",
    label: "Samurai",
    kind: "strips",
    tile: 96,
    scale: 6.8,
    crop: { x: 34, y: 44, w: 52, h: 38 },
    stripSrcs: {
      idle: `${SAMURAI_DIR}/IDLE.png`,
      walk: `${SAMURAI_DIR}/RUN.png`,
      jump: `${SAMURAI_DIR}/IDLE.png`,
      hand: `${SAMURAI_DIR}/ATTACK%201.png`,
      kick: `${SAMURAI_DIR}/ATTACK%201.png`,
      special: `${SAMURAI_DIR}/ATTACK%201.png`,
      parry: `${SAMURAI_DIR}/IDLE.png`,
      hit: `${SAMURAI_DIR}/HURT.png`,
      dead: `${SAMURAI_DIR}/HURT.png`,
    },
    stripFrameCounts: { idle: 10, walk: 16, jump: 10, hand: 7, kick: 7, special: 7, parry: 10, hit: 4, dead: 4 },
  },
  {
    // No dedicated parry frame — falls back to idle.
    id: "martial-hero",
    label: "Martial Hero",
    kind: "strips",
    tile: 200,
    scale: 3.7,
    crop: { x: 60, y: 60, w: 80, h: 62 },
    stripSrcs: {
      idle: `${HERO_DIR}/Idle.png`,
      walk: `${HERO_DIR}/Run.png`,
      jump: `${HERO_DIR}/Jump.png`,
      hand: `${HERO_DIR}/Attack1.png`,
      kick: `${HERO_DIR}/Attack2.png`,
      special: `${HERO_DIR}/Attack2.png`,
      parry: `${HERO_DIR}/Idle.png`,
      hit: `${HERO_DIR}/Take%20Hit.png`,
      dead: `${HERO_DIR}/Death.png`,
    },
    stripFrameCounts: { idle: 8, walk: 8, jump: 2, hand: 6, kick: 6, special: 6, parry: 8, hit: 4, dead: 6 },
  },
];

export function getCharacter(id: string | undefined, fallbackIndex: number): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[fallbackIndex % CHARACTERS.length];
}

/** Every action row/strip maps to, keyed the same way actionRow() maps a fighter action string. */
export function actionKey(a: string): FighterAction {
  switch (a) {
    case "walk": return "walk";
    case "kick": return "kick";
    case "jump": return "jump";
    case "hand": return "hand";
    case "special": return "special";
    case "parry": return "parry";
    case "hit": return "hit";
    case "dead": return "dead";
    default: return "idle";
  }
}
