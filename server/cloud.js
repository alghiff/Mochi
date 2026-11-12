import {
  CLOUD_CREATE_LIMIT,
  CLOUD_FILE,
  CLOUD_RATE_LIMIT,
  CLOUD_RATE_WINDOW_MS,
  KV_PATH,
  MAX_CLOUD_BYTES,
  MAX_CLOUD_STATE_BYTES
} from "./config.js";
import { createRateLimiter, clientKey, jsonResponse } from "./security.js";
import { sanitizeState } from "../src/core/state.js";

/*
 * Cloud save.
 *
 * Kode cloud berfungsi sebagai bearer token. Server hanya menyimpan
 * SHA-256 dari kode tersebut, jadi kalau isi database bocor, kode asli
 * tidak bisa dipulihkan. Data disimpan di Deno KV bila tersedia
 * (jalankan dengan --unstable-kv); jika tidak, fallback ke data/cloud.json.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
export const KV_PREFIX = "mochi-cloud";
const encoder = new TextEncoder();

const requestLimiter = createRateLimiter({
  windowMs: CLOUD_RATE_WINDOW_MS,
  limit: CLOUD_RATE_LIMIT
});

const createLimiter = createRateLimiter({
  windowMs: 10 * 60_000,
  limit: CLOUD_CREATE_LIMIT
});

class CloudError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function normalizeCloudCode(value) {
  const raw = String(value == null ? "" : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);

  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

function plainCode(value) {
  return String(value == null ? "" : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function makeCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = "";

  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export async function hashCloudCode(code) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(plainCode(code)));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- Penyimpanan: Deno KV ---------- */

let kv = null;
let kvChecked = false;

async function getKv() {
  if (kvChecked) return kv;
  kvChecked = true;

  if (typeof Deno.openKv !== "function") return null;

  try {
    kv = KV_PATH ? await Deno.openKv(KV_PATH) : await Deno.openKv();
  } catch {
    kv = null;
  }

  return kv;
}

/* ---------- Penyimpanan: file JSON ---------- */

const fileStore = {
  loaded: false,
  data: Object.create(null),
  queue: Promise.resolve()
};

async function loadFileStore() {
  if (fileStore.loaded) return;
  fileStore.loaded = true;

  try {
    const text = await Deno.readTextFile(CLOUD_FILE);
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (/^[a-f0-9]{64}$/.test(key) && value && typeof value === "object") {
          fileStore.data[key] = value;
        }
      }
    }
  } catch {
    /* file belum ada atau rusak; mulai kosong */
  }
}

function writeFileStore() {
  fileStore.queue = fileStore.queue.then(async () => {
    try {
      await Deno.mkdir(new URL("./", CLOUD_FILE), { recursive: true });

      const tmp = new URL(`cloud-${crypto.randomUUID()}.tmp`, CLOUD_FILE);
      const text = JSON.stringify(fileStore.data);

      await Deno.writeTextFile(tmp, text);

      try {
        await Deno.rename(tmp, CLOUD_FILE);
      } catch {
        await Deno.writeTextFile(CLOUD_FILE, text);
        try {
          await Deno.remove(tmp);
        } catch {
          /* opsional */
        }
      }
    } catch (error) {
      console.error("Cloud save gagal menulis file:", error instanceof Error ? error.message : error);
    }
  });

  return fileStore.queue;
}

/* ---------- API penyimpanan ---------- */

async function readRecord(key) {
  const store = await getKv();

  if (store) {
    const entry = await store.get([KV_PREFIX, key]);
    return entry.value || null;
  }

  await loadFileStore();
  return fileStore.data[key] || null;
}

async function writeRecord(key, record) {
  const store = await getKv();

  if (store) {
    await store.set([KV_PREFIX, key], record);
    return;
  }

  await loadFileStore();
  fileStore.data[key] = record;
  await writeFileStore();
}

/* ---------- Validasi ---------- */

function parseCode(value) {
  const code = normalizeCloudCode(value);

  if (plainCode(code).length !== CODE_LENGTH) {
    throw new CloudError("invalid_code", 400);
  }

  return code;
}

async function readJson(req) {
  const declared = Number(req.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > MAX_CLOUD_BYTES) {
    throw new CloudError("too_large", 413);
  }

  const reader = req.body ? req.body.getReader() : null;

  if (!reader) throw new CloudError("bad_request", 400);

  const chunks = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    total += value.byteLength;

    if (total > MAX_CLOUD_BYTES) {
      try {
        await reader.cancel();
      } catch {
        /* opsional */
      }
      throw new CloudError("too_large", 413);
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CloudError("bad_json", 400);
  }
}

function stateBytes(state) {
  return encoder.encode(JSON.stringify(state)).byteLength;
}

/* ---------- Handler ---------- */

async function createRecord() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeCode();
    const key = await hashCloudCode(code);

    if (await readRecord(key)) continue;

    const now = Date.now();

    await writeRecord(key, {
      state: null,
      createdAt: now,
      savedAt: 0
    });

    return { code };
  }

  throw new CloudError("server_full", 503);
}

async function saveRecord(codeValue, rawState) {
  const code = parseCode(codeValue);
  const key = await hashCloudCode(code);
  const existing = await readRecord(key);

  if (!existing) throw new CloudError("not_found", 404);

  const state = sanitizeState(rawState);
  const size = stateBytes(state);

  if (size > MAX_CLOUD_STATE_BYTES) throw new CloudError("too_large", 413);

  const now = Date.now();

  await writeRecord(key, {
    state,
    createdAt: existing.createdAt || now,
    savedAt: now
  });

  return { ok: true, savedAt: now };
}

async function loadRecord(codeValue) {
  const code = parseCode(codeValue);
  const key = await hashCloudCode(code);
  const record = await readRecord(key);

  if (!record || !record.state) throw new CloudError("not_found", 404);

  return {
    ok: true,
    state: sanitizeState(record.state),
    savedAt: Number(record.savedAt) || 0
  };
}

export async function handleCloud(req, host) {
  const key = clientKey(req);

  if (!requestLimiter.take(key)) {
    return jsonResponse(429, { error: "rate_limit" }, host);
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" }, host, {
      Allow: "POST"
    });
  }

  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

  if (type !== "application/json") {
    return jsonResponse(415, { error: "unsupported_media_type" }, host);
  }

  try {
    const body = await readJson(req);

    if (!body || typeof body !== "object" || typeof body.action !== "string") {
      throw new CloudError("bad_request", 400);
    }

    if (body.action === "create") {
      if (!createLimiter.take(key)) {
        throw new CloudError("rate_limit", 429);
      }

      return jsonResponse(200, await createRecord(), host);
    }

    if (body.action === "save") {
      return jsonResponse(200, await saveRecord(body.code, body.state), host);
    }

    if (body.action === "load") {
      return jsonResponse(200, await loadRecord(body.code), host);
    }

    throw new CloudError("bad_action", 400);
  } catch (error) {
    if (error instanceof CloudError) {
      return jsonResponse(error.status, { error: error.code }, host);
    }

    console.error("Cloud error:", error instanceof Error ? error.message : error);
    return jsonResponse(500, { error: "cloud_error" }, host);
  }
}
