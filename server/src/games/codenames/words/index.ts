import { WORDS_EN } from "./en.js";
import { WORDS_AR } from "./ar.js";
import type { Lang } from "../board.js";

export { WORDS_EN, WORDS_AR };

export function getWordPool(lang: Lang): string[] {
  return lang === "ar" ? WORDS_AR : WORDS_EN;
}
