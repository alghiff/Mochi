import { securityHeaders, textResponse } from "./security.js";

/*
 * Server statis dengan allowlist ketat.
 * Hanya index.html, styles/*.css, src/**\/*.js, file audio di assets/, dan
 * gambar SVG di assets/svg/ yang boleh diakses. Folder server/, data/,
 * deno.json, deno.lock, dan file titik tidak pernah disajikan, meskipun
 * URL-nya ditebak.
 */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
};

const AUDIO_EXT = new Set([".mp3", ".m4a", ".ogg", ".opus", ".wav"]);

const ALLOWED = [
  /^\/$/,
  /^\/index\.html$/,
  /^\/styles\/[a-z0-9][a-z0-9-]*\.css$/,
  /^\/src\/(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9-]*\.js$/,
  /^\/assets\/[^/\\]+\.(?:mp3|m4a|ogg|opus|wav)$/i,
  /^\/assets\/svg\/[a-z0-9][a-z0-9-]*\.svg$/i,
];

function resolvePath(pathname) {
  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (!decoded || decoded.includes("\0") || decoded.includes("\\")) return null;
  if (decoded.length > 240) return null;

  const normalized = decoded === "/" ? "/index.html" : decoded;

  if (!ALLOWED.some((pattern) => pattern.test(normalized))) return null;

  return normalized.slice(1);
}

function etagFor(size, mtime) {
  return `W/\"${size.toString(16)}-${Math.floor(mtime || 0).toString(16)}\"`;
}

/*
 * Range sederhana untuk audio. Browser memakai Range agar lagu bisa diputar
 * bertahap tanpa mengunduh seluruh file sekaligus.
 */
function parseRange(header, size) {
  if (typeof header !== "string") return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);

  if (start === null && end === null) return null;

  if (start === null) {
    const suffix = Math.min(end, size);
    start = size - suffix;
    end = size - 1;
  } else {
    end = end === null ? size - 1 : Math.min(end, size - 1);
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { invalid: true };
  }

  return { start, end };
}

function streamFile(file, start, end) {
  const CHUNK = 64 * 1024;
  let offset = start;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;

    try {
      file.close();
    } catch {
      /* sudah tertutup */
    }
  }

  return new ReadableStream({
    async pull(controller) {
      if (offset > end) {
        close();
        controller.close();
        return;
      }

      const buffer = new Uint8Array(Math.min(CHUNK, end - offset + 1));

      try {
        const read = await file.read(buffer);

        if (read === null) {
          close();
          controller.close();
          return;
        }

        offset += read;
        controller.enqueue(buffer.subarray(0, read));

        if (offset > end) {
          close();
          controller.close();
        }
      } catch (error) {
        close();
        controller.error(error);
      }
    },
    cancel() {
      close();
    },
  });
}

export async function serveStatic(req, root, host) {
  const url = new URL(req.url);
  const relative = resolvePath(url.pathname);

  if (!relative) return textResponse(404, "Not found", host);

  const fileUrl = new URL(relative, root);
  let info;

  try {
    // lstat tidak mengikuti symlink, jadi symlink di dalam folder yang
    // diizinkan tidak bisa dipakai untuk keluar dari root.
    info = await Deno.lstat(fileUrl);
  } catch {
    return textResponse(404, "Not found", host);
  }

  if (info.isSymlink) return textResponse(404, "Not found", host);
  if (!info.isFile) return textResponse(404, "Not found", host);

  const ext = relative.slice(relative.lastIndexOf(".")).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const isHtml = ext === ".html";
  const isAudio = AUDIO_EXT.has(ext);
  const mtimeMs = info.mtime ? info.mtime.getTime() : 0;
  const tag = etagFor(info.size, mtimeMs);
  const cacheControl = isHtml
    ? "no-cache"
    : isAudio
    ? "public, max-age=3600"
    : "public, max-age=120";

  const rangeHeader = req.headers.get("range");
  const range = isAudio ? parseRange(rangeHeader, info.size) : null;

  if (range && range.invalid) {
    return textResponse(416, "Range not satisfiable", host, {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${info.size}`,
    });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : info.size - 1;
  const length = range ? end - start + 1 : info.size;

  if (!range) {
    const inm = req.headers.get("if-none-match");
    const ims = req.headers.get("if-modified-since");
    const lastModified = info.mtime ? info.mtime.toUTCString() : new Date().toUTCString();
    const etagMatch = inm && inm.split(",").some((value) => value.trim() === tag);
    const timeMatch = ims && mtimeMs > 0 && new Date(ims).getTime() >= mtimeMs;

    if (etagMatch || timeMatch) {
      return new Response(null, {
        status: 304,
        headers: securityHeaders(
          { ETag: tag, "Cache-Control": cacheControl, "Last-Modified": lastModified },
          host,
        ),
      });
    }
  }

  const headers = securityHeaders(
    {
      "Content-Type": type,
      "Content-Length": String(length),
      "Cache-Control": cacheControl,
      ETag: tag,
      "Last-Modified": info.mtime ? info.mtime.toUTCString() : new Date().toUTCString(),
    },
    host,
  );

  if (isAudio) {
    headers.set("Accept-Ranges", "bytes");
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }

  if (req.method === "HEAD") {
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  let file;

  try {
    file = await Deno.open(fileUrl, { read: true });
  } catch (error) {
    // File hilang = 404, error lain (izin, I/O) = 500 supaya tidak menyamar
    // sebagai file tidak ada.
    const name = error && error.name ? error.name : "";

    if (name === "NotFound") return textResponse(404, "Not found", host);

    console.error("Gagal membuka file:", error instanceof Error ? error.message : error);
    return textResponse(500, "Internal error", host);
  }

  if (start > 0) {
    try {
      await file.seek(start, Deno.SeekMode.Start);
    } catch {
      try {
        file.close();
      } catch {
        /* sudah tertutup */
      }
      return textResponse(416, "Range not satisfiable", host, {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${info.size}`,
      });
    }
  }

  return new Response(streamFile(file, start, end), {
    status: range ? 206 : 200,
    headers,
  });
}
