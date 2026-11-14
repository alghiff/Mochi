export const ROOT = new URL("../", import.meta.url);

/*
 * Baca environment variable dengan aman.
 *
 * Deno.env.get melempar error (NotCapable) kalau variabelnya tidak ada di
 * daftar izin --allow-env. Tanpa penjaga, satu env yang terlewat membuat
 * server mati total saat start. Di sini error itu diabaikan dan fallback
 * dipakai, jadi permission bisa dipersempit tanpa risiko crash.
 */
function env(name, fallback = "") {
  try {
    const value = Deno.env.get(name);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function numberFromEnv(name, fallback, min, max) {
  const text = env(name, "").trim();

  // Kosong berarti variabel tidak diset: pakai fallback, jangan dipaksa ke min.
  if (!text) return fallback;

  const raw = Number(text);
  if (!Number.isFinite(raw)) return fallback;

  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function listFromEnv(name, fallback) {
  const text = env(name, "").trim();

  if (!text) return fallback;

  // "none" berarti tidak ada proxy yang dipercaya.
  if (text.toLowerCase() === "none") return [];

  const list = text.split(",").map((item) => item.trim()).filter(Boolean);
  return list.length > 0 ? list : fallback;
}

export const PORT = numberFromEnv("PORT", 8000, 1, 65535);

/*
 * Alamat bind.
 *
 * Nilai yang tidak valid membuat Deno.serve gagal start, jadi pola yang
 * aman dulu; kalau tidak cocok, kembali ke 0.0.0.0.
 */
const HOST_PATTERN = /^[A-Za-z0-9.:[\]_-]{1,255}$/;
const rawHost = env("HOST", "0.0.0.0");

export const HOST = HOST_PATTERN.test(rawHost) ? rawHost : "0.0.0.0";
export const MAX_PLAYERS = numberFromEnv("MAX_PLAYERS", 6, 2, 12);

/* Batas jumlah room multiplayer yang boleh aktif bersamaan. */
export const MAX_ROOMS = numberFromEnv("MAX_ROOMS", 100, 5, 1000);

/* Batas koneksi WebSocket yang boleh aktif bersamaan. */
export const MAX_CONNECTIONS = numberFromEnv("MAX_CONNECTIONS", 200, 10, 5000);

/* Batas koneksi WebSocket dari satu alamat IP. */
export const MAX_CONNECTIONS_PER_IP = numberFromEnv("MAX_CONNECTIONS_PER_IP", 10, 1, 200);

/* Batas jumlah pesan WebSocket per IP (semua koneksi dari IP itu). */
export const WS_IP_RATE_LIMIT = numberFromEnv("WS_IP_RATE_LIMIT", 300, 20, 2000);

/*
 * Proxy yang dipercaya.
 *
 * Header seperti X-Forwarded-For atau CF-Connecting-IP bisa dipalsukan klien,
 * jadi ONLY dipakai kalau koneksi langsung datang dari proxy yang terdaftar.
 * Default: loopback (Caddy dan cloudflared di host yang sama).
 */
export const TRUSTED_PROXIES = listFromEnv("TRUSTED_PROXIES", ["127.0.0.1", "::1"]);

/*
 * Origin publik (mis. "https://mochi.example.com").
 *
 * Kalau diisi, CSP dan pemeriksaan Origin memakai nilai ini, bukan Host header
 * yang datang dari permintaan. Ini menutup celah host-header injection dan
 * DNS rebinding. Nilai yang tidak valid dianggap kosong supaya tidak diam-diam
 * memakai Host header; server memberi peringatan saat start.
 */
function originFromEnv(name) {
  const raw = env(name, "").trim();

  if (!raw) return "";

  try {
    const url = new URL(raw);

    if (url.protocol !== "http:" && url.protocol !== "https:") return "";

    return url.origin;
  } catch {
    return "";
  }
}

export const PUBLIC_ORIGIN = originFromEnv("PUBLIC_ORIGIN");

/* SDP WebRTC bisa beberapa kilobyte; chat tetap dibatasi terpisah. */
export const MAX_MESSAGE_BYTES = 8192;
export const MAX_CLOUD_BYTES = 32 * 1024;
export const MAX_CLOUD_STATE_BYTES = 24 * 1024;

export const WS_RATE_WINDOW_MS = 10_000;
export const WS_RATE_LIMIT = 90;
export const CLOUD_RATE_WINDOW_MS = 60_000;
export const CLOUD_RATE_LIMIT = 40;
export const CLOUD_CREATE_LIMIT = 5;
export const CLOUD_CREATE_WINDOW_MS = numberFromEnv(
  "CLOUD_CREATE_WINDOW_MS",
  10 * 60_000,
  60_000,
  3_600_000,
);

export const IDLE_MS = 75_000;
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/* Room tanpa aktivitas akan dibuang setelah durasi ini. */
export const ROOM_IDLE_MS = numberFromEnv("ROOM_IDLE_MS", 10 * 60_000, 60_000, 3_600_000);

export const CLOUD_FILE = new URL("../data/cloud.json", import.meta.url);

/* Batas jumlah record cloud save supaya storage tidak tumbuh tanpa batas. */
export const CLOUD_MAX_RECORDS = numberFromEnv("CLOUD_MAX_RECORDS", 50_000, 100, 1_000_000);

/*
 * Lokasi Deno KV.
 *
 * - Deno Deploy tidak punya filesystem tulis, jadi biarkan kosong dan pakai KV
 *   bawaan platform (DENO_DEPLOYMENT_ID selalu di-set di sana).
 * - Di lokal dan Docker, pakai file di data/ supaya server dan `deno task cloud`
 *   selalu membaca database yang sama.
 * - KV_PATH tetap bisa dioverride lewat environment variable.
 */
const deployed = Boolean(env("DENO_DEPLOYMENT_ID"));
const localKv = new URL("../data/kv.sqlite3", import.meta.url);
const localKvPath = Deno.build.os === "windows" ? localKv.pathname.slice(1) : localKv.pathname;

export const KV_PATH = env("KV_PATH") || (deployed ? "" : localKvPath);
