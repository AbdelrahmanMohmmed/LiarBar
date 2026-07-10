import type { Lang } from "./board.js";

const TASHKEEL = /[ً-ْ]/g;
const TATWEEL = /ـ/g;

/**
 * Normalize a word for comparison purposes only (clue checks, dedupe).
 * Stored/displayed words are never mutated by this.
 */
export function normalizeWord(word: string, lang: Lang): string {
  const trimmed = word.trim();
  if (lang === "en") {
    return trimmed.toLowerCase();
  }
  return trimmed
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

export function validateClue(
  word: string,
  count: number,
  unrevealedWords: string[],
  lang: Lang,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(count) || count < 1 || count > 9) {
    return { ok: false, error: "Count must be between 1 and 9" };
  }

  const normalized = normalizeWord(word, lang);
  if (!normalized || /\s/.test(normalized) || normalized.length > 30) {
    return { ok: false, error: "Clue must be a single word, 1-30 characters" };
  }

  const normalizedBoardWords = unrevealedWords.map((w) => normalizeWord(w, lang));
  if (normalizedBoardWords.includes(normalized)) {
    return { ok: false, error: "Clue cannot match a word on the board" };
  }

  return { ok: true };
}
