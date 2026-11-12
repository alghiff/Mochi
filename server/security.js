/*
 * Header keamanan, respons JSON/teks, dan pembatas laju sederhana.
 * Semua respons HTTP melewati modul ini supaya CSP dan nosniff konsisten.
 */

const HOST_PATTERN = /^[A-Za-z0-9.\-:[\]]+$/;

function safeHost(host) {
  return typeof host === "string" && HOST_PATTERN.test(host) ? host : "";
}

export function securityHeaders(extra, host) {
  const headers = new Headers(extra || {});
  const safe = safeHost(host);

  const connect = safe
    ? `'self' ws://${safe} wss://${safe}`
    : "'self' ws: wss:";

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
      "frame-ancestors 'none'"
    ].join("; ")
  );

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(self), payment=(), usb=()"
  );

  return headers;
}

export function textResponse(status, message, host, extra) {
  return new Response(message + "\n", {
    status,
    headers: securityHeaders(
      Object.assign({ "Content-Type": "text/plain; charset=utf-8" }, extra || {}),
      host
    )
  });
}

export function jsonResponse(status, data, host, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: securityHeaders(
      Object.assign(
        {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        },
        extra || {}
      ),
      host
    )
  });
}

/*
 * Cek Origin untuk WebSocket dan POST.
 * Permintaan tanpa Origin (klien non-browser) tetap diizinkan, tetapi
 * permintaan browser dari origin lain ditolak.
 */
export function originAllowed(req) {
  const origin = req.headers.get("origin");

  if (!origin) return true;

  let originHost;

  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const requestHost = req.headers.get("host") || "";

  return Boolean(requestHost) && originHost === requestHost;
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

export function clientKey(req) {
  const forwarded = req.headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first.slice(0, 64);
  }

  const real = req.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);

  return "local";
}
