import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Centralized server configuration, read once from the environment.
 */

/**
 * Load `server/.env` if it exists.
 *
 * The repo documents a `server/.env` file and `.env.example` ships with it —
 * but nothing ever read it. `npm run dev` and `npm start` both ran with
 * PORT and ALLOWED_ORIGINS unset, which combined with the CORS bug below meant
 * a local dev server rejected every request from the Vite dev server with no
 * error on the server side at all. `process.loadEnvFile` is built into Node
 * 20.12+/21.7+, so this costs no dependency.
 */
function loadDotEnv(): void {
  const loader = (
    process as unknown as { loadEnvFile?: (path: string) => void }
  ).loadEnvFile;
  if (typeof loader !== "function") return;

  for (const candidate of [".env", "../.env"]) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) {
      try {
        loader(path);
      } catch {
        /* Malformed file; fall back to the real environment. */
      }
      return;
    }
  }
}

loadDotEnv();

export interface ServerConfig {
  port: number;
  /**
   * CORS origins.
   *
   * `true` means "reflect any origin" — the `cors` package's own way of
   * spelling allow-all. It must NOT be the string "*" inside an array: an
   * array is matched by exact string equality, so `["*"]` allows precisely one
   * origin, the literal text `*`, and therefore allows nobody. That was the
   * previous behaviour when ALLOWED_ORIGINS was unset, and it presented as
   * "the API is up, returns 200 to curl, and every browser request fails".
   */
  allowedOrigins: string[] | true;
  /** How often the stale-room sweeper runs. */
  sweepIntervalMs: number;
  /** Room with no connected humans is removed after this idle time (reconnect grace). */
  emptyRoomGraceMs: number;
  /** Finished games are removed after this idle time. */
  finishedRoomTtlMs: number;
  /** Any room is removed after this much total inactivity. */
  idleRoomTtlMs: number;
  maxNameLength: number;
  maxChatLength: number;
}

function parseOrigins(raw: string | undefined): string[] | true {
  const value = (raw ?? "").trim();
  if (value === "" || value === "*") return true;
  const list = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return list.length > 0 ? list : true;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3001", 10),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  sweepIntervalMs: 60_000,
  emptyRoomGraceMs: 2 * 60_000,
  finishedRoomTtlMs: 10 * 60_000,
  idleRoomTtlMs: 2 * 60 * 60_000,
  maxNameLength: 24,
  maxChatLength: 300,
};

/** For the startup banner: says what the CORS policy actually is. */
export function describeOrigins(): string {
  return config.allowedOrigins === true
    ? "* (any origin — set ALLOWED_ORIGINS in production)"
    : config.allowedOrigins.join(", ");
}
