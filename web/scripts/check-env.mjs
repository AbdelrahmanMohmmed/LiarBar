/**
 * Build-time sanity check on the environment variables that only matter in
 * production and are invisible when they're wrong.
 *
 *   node scripts/check-env.mjs      (runs as part of `npm run build`)
 *
 * ## Why this exists
 *
 * Vite bakes `VITE_*` variables into the bundle at build time. A deploy that
 * forgot one does not fail, does not warn, and does not behave differently in
 * any way a developer would notice — because the developer is testing on one
 * wifi network, where the missing thing isn't needed.
 *
 * The specific case that motivated this is TURN. With no relay configured,
 * voice works perfectly between two people in the same house and fails for a
 * meaningful share of people on mobile data, because the symmetric NAT most
 * carriers use cannot be traversed by STUN alone. The failure arrives days
 * later as "voice is broken for my cousin", which is unfalsifiable from the
 * outside and untraceable back to a build setting.
 *
 * So the build log says it. The build log is the one place an operator
 * reliably looks after a deploy, and this costs nothing.
 *
 * ## Why it warns rather than fails
 *
 * A build that refuses to run without TURN would be wrong: STUN-only is a
 * perfectly reasonable state for a preview deploy, a local build, or a
 * first launch before coturn exists. The point is that it should be a choice
 * somebody made, not a thing nobody noticed.
 */

const RED = "[31m";
const YELLOW = "[33m";
const DIM = "[2m";
const RESET = "[0m";

const env = process.env;
const problems = [];

const turnUrl = (env.VITE_TURN_URL ?? "").trim();
const turnUser = (env.VITE_TURN_USERNAME ?? "").trim();
const turnCred = (env.VITE_TURN_CREDENTIAL ?? "").trim();

if (!turnUrl) {
  problems.push({
    level: "warn",
    what: "VITE_TURN_URL is not set — this build ships STUN only.",
    why: "Voice will work on one shared network and fail for some players on mobile data.",
    fix: "Set VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL. See docs/VOICE.md §4.",
  });
} else if (!turnCred) {
  problems.push({
    level: "error",
    what: "VITE_TURN_URL is set but VITE_TURN_CREDENTIAL is not.",
    why: "A TURN entry with no credential is dropped at runtime, so this is STUN only — while looking configured, which is worse than not configuring it.",
    fix: "Set VITE_TURN_CREDENTIAL (and VITE_TURN_USERNAME), or unset VITE_TURN_URL.",
  });
} else if (!turnUser) {
  problems.push({
    level: "warn",
    what: "VITE_TURN_URL and credential are set, but VITE_TURN_USERNAME is empty.",
    why: "Most TURN servers, coturn included, require a username.",
    fix: "Set VITE_TURN_USERNAME to match your coturn user.",
  });
}

if (problems.length === 0) {
  console.log(`${DIM}check-env: TURN relay configured.${RESET}`);
  process.exit(0);
}

console.log("");
for (const p of problems) {
  const colour = p.level === "error" ? RED : YELLOW;
  const tag = p.level === "error" ? "ERROR" : "WARN ";
  console.log(`${colour}${tag}${RESET} check-env: ${p.what}`);
  console.log(`      ${DIM}${p.why}${RESET}`);
  console.log(`      ${DIM}${p.fix}${RESET}`);
}
console.log("");

// Never fails the build: STUN-only is a legitimate choice for a preview or a
// first launch. It just has to be a choice.
process.exit(0);
