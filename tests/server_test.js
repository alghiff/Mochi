/*
 * Smoke test server Mochi.
 *
 * Menjalankan server sungguhan di port acak dengan KV sementara, lalu
 * memeriksa perilaku yang penting: allowlist file statis, Range untuk audio,
 * endpoint cloud, dan pemeriksaan Origin.
 *
 * Jalankan: deno task test
 */

const ROOT = new URL("../", import.meta.url).pathname;

function assert(condition, message) {
  if (!condition) throw new Error(`Gagal: ${message}`);
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Gagal: ${message} (dapat ${actual}, harus ${expected})`);
  }
}

async function waitForHealth(port, host, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      if (host) {
        const res = await rawGet(port, "/api/health", host);
        if (res.status === 200) return { ok: true };
      } else {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (res.ok) return await res.json();
      }
    } catch {
      /* server belum siap */
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("Server tidak siap dalam batas waktu.");
}

async function startServer(env = {}) {
  const port = 10_000 + Math.floor(Math.random() * 20_000);
  const kvPath = await Deno.makeTempFile({ suffix: ".sqlite3" });

  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-net",
      "--allow-read=" + ROOT,
      "--allow-write",
      "--allow-env=PORT,KV_PATH,HOST,MAX_PLAYERS,DENO_DEPLOYMENT_ID,TRUSTED_PROXIES,PUBLIC_ORIGIN",
      "--unstable-kv",
      "server.js",
    ],
    env: {
      PORT: String(port),
      KV_PATH: kvPath,
      HOST: "127.0.0.1",
      ...env,
    },
    cwd: ROOT,
    stdout: "null",
    stderr: "piped",
  }).spawn();

  const info = await waitForHealth(
    port,
    env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).host : undefined,
  );

  return {
    port,
    info,
    base: `http://127.0.0.1:${port}`,
    async stop() {
      try {
        child.kill("SIGTERM");
        await child.status;
      } catch {
        /* proses sudah berhenti */
      }

      try {
        await Deno.remove(kvPath);
      } catch {
        /* file sementara */
      }
    },
  };
}

Deno.test("health melaporkan status server", async () => {
  const server = await startServer();

  try {
    assertEquals(server.info.ok, true, "server harus sehat");
    assertEquals(server.info.maxPlayers, 6, "default 6 pemain per room");
  } finally {
    await server.stop();
  }
});

Deno.test("halaman utama memakai header keamanan", async () => {
  const server = await startServer();

  try {
    const res = await fetch(`${server.base}/`);

    assertEquals(res.status, 200, "halaman utama harus 200");
    assert(
      (res.headers.get("content-type") || "").includes("text/html"),
      "content-type harus html",
    );
    assert(res.headers.get("content-security-policy"), "CSP harus ada");
    assertEquals(res.headers.get("x-content-type-options"), "nosniff", "nosniff wajib");
    assertEquals(res.headers.get("x-frame-options"), "DENY", "anti iframe wajib");
  } finally {
    await server.stop();
  }
});

Deno.test("file di luar allowlist tidak dilayani", async () => {
  const server = await startServer();

  try {
    const paths = [
      "/server/main.js",
      "/server/config.js",
      "/deno.json",
      "/scripts/cloud.js",
      "/data/kv.sqlite3",
      "/assets/../server/main.js",
      "/%2e%2e/server/main.js",
      "/src/../../etc/passwd",
      "/styles/../../deno.json",
    ];

    for (const path of paths) {
      const res = await fetch(`${server.base}${path}`);
      assertEquals(res.status, 404, `${path} harus 404`);
    }
  } finally {
    await server.stop();
  }
});

Deno.test("audio dilayani dengan Range", async () => {
  const server = await startServer();

  try {
    const full = await fetch(`${server.base}/assets/bgm.mp3`, { method: "HEAD" });

    assertEquals(full.status, 200, "audio harus 200");
    assertEquals(full.headers.get("accept-ranges"), "bytes", "Range harus diizinkan");

    const size = Number(full.headers.get("content-length") || 0);
    assert(size > 0, "ukuran file harus lebih dari 0");

    const partial = await fetch(`${server.base}/assets/bgm.mp3`, {
      headers: { Range: "bytes=0-99" },
    });

    assertEquals(partial.status, 206, "Range parsial harus 206");
    assertEquals(partial.headers.get("content-range"), `bytes 0-99/${size}`, "content-range benar");

    const invalid = await fetch(`${server.base}/assets/bgm.mp3`, {
      headers: { Range: `bytes=${size + 10}-${size + 20}` },
    });

    assertEquals(invalid.status, 416, "Range di luar file harus 416");
  } finally {
    await server.stop();
  }
});

Deno.test("cloud save create, save, dan load", async () => {
  const server = await startServer();

  try {
    const created = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    });

    assertEquals(created.status, 200, "create harus 200");

    const { code } = await created.json();
    assert(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), "format kode salah");

    const saved = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save",
        code,
        state: { version: 3, name: "Uji", level: 2, coins: 33 },
      }),
    });

    assertEquals(saved.status, 200, "save harus 200");

    const loaded = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "load", code }),
    });

    assertEquals(loaded.status, 200, "load harus 200");

    const payload = await loaded.json();
    assertEquals(payload.state.coins, 33, "koin harus tersimpan");
    assertEquals(payload.state.name, "Uji", "nama harus tersimpan");

    const missing = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "load", code: "ZZZZ-ZZZZ-ZZZZ" }),
    });

    assertEquals(missing.status, 404, "kode asing harus 404");
  } finally {
    await server.stop();
  }
});

Deno.test("permintaan cloud dari origin lain ditolak", async () => {
  const server = await startServer();

  try {
    const res = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ action: "create" }),
    });

    assertEquals(res.status, 403, "origin asing harus 403");
  } finally {
    await server.stop();
  }
});

Deno.test("method yang tidak diizinkan ditolak", async () => {
  const server = await startServer();

  try {
    const res = await fetch(`${server.base}/`, { method: "POST" });
    assertEquals(res.status, 405, "POST ke / harus 405");

    const api = await fetch(`${server.base}/api/nope`);
    assertEquals(api.status, 404, "api tak dikenal harus 404");

    const apiPost = await fetch(`${server.base}/api/nope`, { method: "POST" });
    assertEquals(apiPost.status, 404, "POST ke api tak dikenal harus 404");
  } finally {
    await server.stop();
  }
});

Deno.test("header proxy palsu tidak melewati rate limit", async () => {
  // Tanpa proxy yang dipercaya, spoofing CF-Connecting-IP harus diabaikan.
  const server = await startServer({ TRUSTED_PROXIES: "none" });

  try {
    const statuses = [];

    for (let index = 0; index < 8; index += 1) {
      const res = await fetch(`${server.base}/api/cloud`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": `9.9.9.${index + 1}`,
          "x-forwarded-for": `8.8.8.${index + 1}`,
        },
        body: JSON.stringify({ action: "create" }),
      });

      statuses.push(res.status);
    }

    const limited = statuses.filter((status) => status === 429).length;

    if (limited === 0) {
      throw new Error(`Rate limit dilewati oleh header palsu: ${statuses.join(",")}`);
    }
  } finally {
    await server.stop();
  }
});

Deno.test("simpan tanpa state tidak menghapus savean", async () => {
  const server = await startServer();

  try {
    const created = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    });

    const { code } = await created.json();

    await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", code, state: { version: 3, name: "Awan", level: 4 } }),
    });

    const kosong = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", code }),
    });

    assertEquals(kosong.status, 400, "tanpa state harus 400");

    const loaded = await fetch(`${server.base}/api/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "load", code }),
    });

    const payload = await loaded.json();

    assertEquals(payload.state.name, "Awan", "savean lama harus utuh");
    assertEquals(payload.state.level, 4, "level lama harus utuh");
  } finally {
    await server.stop();
  }
});

/*
 * Permintaan HTTP mentah.
 *
 * fetch() tidak bisa mengubah header Host, jadi untuk menguji validasi Host
 * dipakai koneksi TCP langsung.
 */
async function rawGet(port, path, host) {
  const conn = await Deno.connect({ hostname: "127.0.0.1", port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  await conn.write(
    encoder.encode(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`),
  );

  const buffer = new Uint8Array(65_536);
  let raw = "";

  while (raw.length < 200_000) {
    const read = await conn.read(buffer);

    if (read === null) break;

    raw += decoder.decode(buffer.subarray(0, read));
  }

  conn.close();

  const status = Number((raw.split("\r\n")[0] || "").split(" ")[1] || 0);
  return { status, raw };
}

Deno.test("PUBLIC_ORIGIN menolak host lain", async () => {
  const server = await startServer({ PUBLIC_ORIGIN: "https://extion.site" });

  try {
    const salah = await rawGet(server.port, "/", "evil.example");
    assertEquals(salah.status, 421, "host lain harus 421");

    const benar = await rawGet(server.port, "/", "extion.site");
    assertEquals(benar.status, 200, "host yang cocok harus 200");
    assert(
      benar.raw.includes("wss://extion.site"),
      "CSP harus memakai host publik",
    );
    assert(!benar.raw.includes("evil.example"), "CSP tidak boleh memakai host request");
  } finally {
    await server.stop();
  }
});
