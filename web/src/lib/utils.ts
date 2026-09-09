import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Map a BCP-47 locale (e.g. "en-US", "ar-SA") to a 2-letter ISO region code, or "" if unknown. */
export function localeToFlag(locale?: string): string {
  const region = (locale || navigator.language || "en-US").split("-")[1];
  if (!region || !/^[A-Za-z]{2}$/.test(region)) return "";
  return region.toUpperCase();
}

/** Convert a 2-letter ISO region code to its flag emoji (regional indicators). */
export function codeToEmoji(code?: string): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "🌐";
  const cps = code
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...cps);
}

/** Real flag image URL for a 2-letter ISO region code, via flagsapi.com. */
export function flagImageUrl(code?: string, size: 16 | 24 | 32 | 48 | 64 = 32, style: "flat" | "shiny" = "flat"): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return `https://flagsapi.com/${code.toUpperCase()}/${style}/${size}.png`;
}

