export const ROOT = new URL("../", import.meta.url);

function numberFromEnv(name, fallback, min, max) {
  const raw = Number(Deno.env.get(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

export const PORT = numberFromEnv("PORT", 8000, 1, 65535);
export const HOST = Deno.env.get("HOST") || "0.0.0.0";
export const MAX_PLAYERS = numberFromEnv("MAX_PLAYERS", 6, 2, 12);

export const MAX_MESSAGE_BYTES = 4096;
export const MAX_CLOUD_BYTES = 32 * 1024;
export const MAX_CLOUD_STATE_BYTES = 24 * 1024;

export const WS_RATE_WINDOW_MS = 10_000;
export const WS_RATE_LIMIT = 45;
export const CLOUD_RATE_WINDOW_MS = 60_000;
export const CLOUD_RATE_LIMIT = 40;
export const CLOUD_CREATE_LIMIT = 5;

export const IDLE_MS = 75_000;
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

export const CLOUD_FILE = new URL("../data/cloud.json", import.meta.url);

/*
 * Lokasi Deno KV.
 *
 * - Deno Deploy tidak punya filesystem tulis, jadi biarkan kosong dan pakai KV
 *   bawaan platform (DENO_DEPLOYMENT_ID selalu di-set di sana).
 * - Di lokal dan Docker, pakai file di data/ supaya server dan `deno task cloud`
 *   selalu membaca database yang sama.
 * - KV_PATH tetap bisa dioverride lewat environment variable.
 */
const deployed = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
const localKv = new URL("../data/kv.sqlite3", import.meta.url);
const localKvPath = Deno.build.os === "windows" ? localKv.pathname.slice(1) : localKv.pathname;

export const KV_PATH = Deno.env.get("KV_PATH") || (deployed ? "" : localKvPath);
