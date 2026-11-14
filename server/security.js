/*
 * Header keamanan, respons JSON/teks, dan pembatas laju sederhana.
 * Semua respons HTTP melewati modul ini supaya CSP dan nosniff konsisten.
 */

import { PUBLIC_ORIGIN, TRUSTED_PROXIES } from "./config.js";

const HOST_PATTERN = /^[A-Za-z0-9.\-:[\]]+$/;

function safeHost(host) {
  return typeof host === "string" && HOST_PATTERN.test(host) ? host : "";
}

/*
 * Host publik yang dipakai untuk CSP dan pemeriksaan Origin.
 *
 * Kalau PUBLIC_ORIGIN diisi (mis. "https://mochi.example.com"), nilai itu yang
 * dipakai. Dengan begitu Host header dari permintaan tidak bisa menyuntik
 * CSP atau membypass pemeriksaan Origin (host-header injection / DNS
 * rebinding).
 */
function publicHost() {
  if (!PUBLIC_ORIGIN) return "";

  try {
    return new URL(PUBLIC_ORIGIN).host;
  } catch {
    return "";
  }
}

export function securityHeaders(extra, host) {
  const headers = new Headers(extra || {});
  const safe = safeHost(publicHost() || host);

  const connect = safe ? `'self' ws://${safe} wss://${safe}` : "'self'";

  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      `connect-src ${connect}`,
      "media-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(self), payment=(), usb=()",
  );

  // HTTPS sudah dihentikan Cloudflare di edge, jadi HSTS cukup diumosi
  // di origin publik saja.
  if (PUBLIC_ORIGIN.startsWith("https://")) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return headers;
}

export function textResponse(status, message, host, extra) {
  return new Response(message + "\n", {
    status,
    headers: securityHeaders(
      Object.assign(
        { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        extra || {},
      ),
      host,
    ),
  });
}

export function jsonResponse(status, data, host, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: securityHeaders(
      Object.assign(
        {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
        extra || {},
      ),
      host,
    ),
  });
}

/*
 * Host yang boleh dilayani.
 *
 * Dengan PUBLIC_ORIGIN, permintaan dengan Host lain ditolak (421) supaya
 * tidak ada cache poisoning lewat Host header.
 */
export function hostAllowed(req) {
  const expected = publicHost();

  if (!expected) return true;

  const requestHost = req.headers.get("host") || "";

  return requestHost === expected;
}

/*
 * Cek Origin untuk WebSocket dan POST.
 * Permintaan tanpa Origin (klien non-browser) tetap diizinkan, tetapi
 * permintaan browser dari origin lain ditolak.
 */
export function originAllowed(req) {
  const origin = req.headers.get("origin");

  if (!origin) return true;

  let originUrl;

  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const expected = publicHost();

  // Mode produksi: Origin harus sama persis dengan origin publik.
  if (expected) return originUrl.origin === PUBLIC_ORIGIN;

  // Mode pengembangan: cocokkan host saja.
  const requestHost = req.headers.get("host") || "";

  return Boolean(requestHost) && originUrl.host === requestHost;
}

export function createRateLimiter({ windowMs, limit }) {
  const buckets = new Map();
  let lastPrune = Date.now();

  function prune(now) {
    if (now - lastPrune < windowMs) return;
    lastPrune = now;

    for (const [key, times] of buckets) {
      const kept = times.filter((time) => now - time < windowMs);
      if (kept.length === 0) buckets.delete(key);
      else buckets.set(key, kept);
    }
  }

  function take(key) {
    const now = Date.now();
    prune(now);

    const times = (buckets.get(key) || []).filter((time) => now - time < windowMs);

    if (times.length >= limit) {
      buckets.set(key, times);
      return false;
    }

    times.push(now);
    buckets.set(key, times);
    return true;
  }

  return { take };
}

/* ---------- Identitas klien ---------- */

function normalizeAddress(value) {
  const address = String(value || "").trim().toLowerCase();

  if (address === "0:0:0:0:0:0:0:1") return "::1";

  // IPv4-mapped IPv6 (::ffff:172.18.0.1) -> IPv4.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);

  return mapped ? mapped[1] : address;
}

function ipv4ToNumber(value) {
  const parts = parseIpv4(value);

  if (!parts) return null;

  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function ipv4InCidr(value, rule) {
  const slash = rule.indexOf("/");

  if (slash === -1) return false;

  const base = rule.slice(0, slash);
  const bits = Number(rule.slice(slash + 1));

  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ip = ipv4ToNumber(value);
  const network = ipv4ToNumber(base);

  if (ip === null || network === null) return false;
  if (bits === 0) return true;

  const mask = (0xffffffff << (32 - bits)) >>> 0;

  return ((ip & mask) >>> 0) === ((network & mask) >>> 0);
}

function isTrustedProxy(address) {
  if (!address) return false;

  const value = normalizeAddress(address);

  return TRUSTED_PROXIES.some((entry) => {
    const rule = normalizeAddress(entry);

    if (!rule) return false;
    if (rule === value) return true;
    if (rule.includes("/")) return ipv4InCidr(value, rule);

    return false;
  });
}

function parseIpv4(value) {
  const parts = value.split(".");

  if (parts.length !== 4) return null;

  const numbers = parts.map((part) => Number(part));

  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;

  return numbers;
}

function isPrivateIp(value) {
  const ip = String(value || "").trim().toLowerCase();

  if (!ip) return true;

  // IPv4-mapped IPv6 (::ffff:1.2.3.4) -> ipv4.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);

  if (mapped) return isPrivateIp(mapped[1]);

  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip === "::") return true;
  if (/^f[cd]/.test(ip)) return true;
  if (ip.startsWith("fe80:")) return true;

  const parts = parseIpv4(ip);

  if (!parts) return false;

  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;

  return false;
}

/*
 * Identitas klien untuk rate limit.
 *
 * Header proxy (X-Forwarded-For, CF-Connecting-IP) bisa dipalsukan klien,
 * jadi HANYA dipakai kalau koneksi langsung datang dari proxy yang
 * dipercaya. Selain itu, alamat peer dipakai apa adanya.
 */
export function clientKey(req, connInfo) {
  const peer = connInfo && connInfo.remoteAddr ? connInfo.remoteAddr.hostname : "";

  if (isTrustedProxy(peer)) {
    const cf = req.headers.get("cf-connecting-ip");

    if (cf && cf.trim()) return cf.trim().slice(0, 64);

    const forwarded = req.headers.get("x-forwarded-for");

    if (forwarded) {
      const list = forwarded.split(",").map((value) => value.trim()).filter(Boolean);

      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (!isPrivateIp(list[index])) return list[index].slice(0, 64);
      }

      if (list.length > 0) return list[list.length - 1].slice(0, 64);
    }

    const real = req.headers.get("x-real-ip");

    if (real && real.trim()) return real.trim().slice(0, 64);
  }

  return (peer || "local").slice(0, 64);
}
