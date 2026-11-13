/*
 * Regression test konfigurasi keamanan.
 *
 * Dockerfile membatasi environment yang boleh dibaca Deno. Kalau daftar ini
 * tertinggal, PUBLIC_ORIGIN/TRUSTED_PROXIES diabaikan tanpa error dan server
 * diam-diam kembali ke mode pengembangan.
 */

const ROOT = new URL("../", import.meta.url);

async function readText(path) {
  return await Deno.readTextFile(new URL(path, ROOT));
}

Deno.test("Dockerfile mengizinkan semua environment keamanan", async () => {
  const dockerfile = await readText("Dockerfile");
  const required = [
    "PUBLIC_ORIGIN",
    "TRUSTED_PROXIES",
    "MAX_ROOMS",
    "MAX_CONNECTIONS",
    "MAX_CONNECTIONS_PER_IP",
    "WS_IP_RATE_LIMIT",
    "CLOUD_CREATE_WINDOW_MS",
    "ROOM_IDLE_MS",
    "CLOUD_MAX_RECORDS",
  ];

  for (const name of required) {
    if (!dockerfile.includes(name)) {
      throw new Error(`Dockerfile tidak mengizinkan env ${name}`);
    }
  }
});

Deno.test("gitignore menutup data runtime dan kredensial", async () => {
  const ignore = await readText(".gitignore");
  const required = ["data/*", ".env", "*.pem", "*.key", ".cloudflared/"];

  for (const pattern of required) {
    if (!ignore.includes(pattern)) {
      throw new Error(`.gitignore tidak menutup pola ${pattern}`);
    }
  }
});

Deno.test("dockerignore tidak membawa kredensial ke image", async () => {
  const ignore = await readText(".dockerignore");
  const required = ["data", ".env", "*.pem", "*.key", ".cloudflared"];

  for (const pattern of required) {
    if (!ignore.includes(pattern)) {
      throw new Error(`.dockerignore tidak menutup pola ${pattern}`);
    }
  }
});
