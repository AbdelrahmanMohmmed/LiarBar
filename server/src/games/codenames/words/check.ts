import { WORDS_EN, WORDS_AR } from "./index.js";
import { normalizeWord } from "../validation.js";

const EN_REGEX = /^[a-z]{3,12}$/;
const AR_REGEX = /^[ء-ي]{2,10}$/;

function check(name: string, words: string[], regex: RegExp, lang: "en" | "ar"): void {
  if (words.length !== 400) {
    throw new Error(`${name}: expected 400 entries, got ${words.length}`);
  }
  const invalid = words.filter((w) => !regex.test(w));
  if (invalid.length > 0) {
    throw new Error(`${name}: ${invalid.length} invalid entries, e.g. ${invalid.slice(0, 5).join(", ")}`);
  }
  const normalized = new Set(words.map((w) => normalizeWord(w, lang)));
  if (normalized.size !== words.length) {
    throw new Error(`${name}: duplicates after normalization (${words.length - normalized.size} collisions)`);
  }
  console.log(`${name}: OK (${words.length} entries)`);
}

check("WORDS_EN", WORDS_EN, EN_REGEX, "en");
check("WORDS_AR", WORDS_AR, AR_REGEX, "ar");
