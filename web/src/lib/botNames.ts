import type { Lang } from "./brand";

/**
 * Names for the bots a host adds to fill a room.
 *
 * Every screen used to roll its own list — three of them, each a different
 * length, each prefixing "Bot " or "آلي " onto the result, and the party hub
 * had no list at all and fell through to the server's `Bot 2`, `Bot 3`. A room
 * of one human therefore read as a spreadsheet, which is the opposite of the
 * thing being sold: friends around a table.
 *
 * Two rules the lists follow:
 *
 *   1. **No prefix.** The roster and every game table already mark a bot with
 *      its own icon, so "Bot" in the name is a label repeated twice — and it
 *      is the half that kills the joke. `زقزوق` is a character at the table.
 *      `آلي زقزوق` is a machine with a costume on.
 *   2. **Not translations of each other.** The Arabic names are Egyptian
 *      street nicknames — what you'd actually shout across a café — and the
 *      English ones are their own joke rather than a transliteration, which
 *      would land as neither.
 *
 * Kept under `maxNameLength` (24) so the server's `cleanName` never truncates
 * one mid-word.
 */

const NAMES: Record<Lang, readonly string[]> = {
  ar: [
    "الحريف",
    "المعلم",
    "زقزوق",
    "عبده موتة",
    "أبو حميد",
    "نص كم",
    "بيبو",
    "شيكو",
    "الباشمهندس",
    "عم سيد",
    "حمادة الفلاح",
    "الليثي",
    "فيفي",
    "زيزي",
    "سعدية",
    "الشبح",
    "كوكا",
    "أبو الفصاد",
    "بمبم",
    "الكابتن",
  ],
  en: [
    "Beep Bopson",
    "Sir Loses-a-Lot",
    "Captain Obvious",
    "Lord Shufflebottom",
    "Tin Can Tony",
    "Wobbly Steve",
    "Doctor Dice",
    "Grandmaster Bleep",
    "Sneaky Pete",
    "Rusty",
    "Nibbles",
    "The Intern",
    "Fumbles",
    "Sparkplug",
    "Cousin Chip",
    "Big Circuit",
    "Clanky",
    "Professor Ping",
    "Bolt",
    "Mr. Reasonable",
  ],
};

/**
 * One name for a new bot, avoiding the ones already in the room.
 *
 * `taken` matters more than it looks: a host adding three bots in three taps
 * hit the same `Math.random()` list every time, and two seats called `الحريف`
 * are genuinely confusing once they're both playing dominoes against you.
 * When the list is exhausted (20 names, 12 seats — it isn't), the numbered
 * fallback returns, because a duplicate name is worse than a dull one.
 */
export function pickBotName(lang: Lang, taken: Iterable<string> = []): string {
  const used = new Set(Array.from(taken, (n) => n.trim()));
  const pool = NAMES[lang] ?? NAMES.en;
  const free = pool.filter((n) => !used.has(n));

  if (free.length > 0) {
    return free[Math.floor(Math.random() * free.length)];
  }

  for (let i = 2; ; i++) {
    const name = `${pool[Math.floor(Math.random() * pool.length)]} ${i}`;
    if (!used.has(name)) return name;
  }
}
