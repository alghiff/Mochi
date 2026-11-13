/*
 * Integritas aset.
 *
 * Memastikan file SVG yang dirujuk data (cuaca, badge misi) benar-benar ada,
 * dan setiap aksesori SVG punya bagian gambar di dalam SVG kucing.
 */

import { ACCS } from "../src/data/accessories.js";
import { QUESTS } from "../src/data/quests.js";
import { WEATHERS } from "../src/data/weather.js";

const ROOT = new URL("../", import.meta.url);

/* Path aset mulai dengan "/" (path URL), jadi slash pertama dibuang. */
function toRepoPath(path) {
  return String(path).replace(/^\/+/, "");
}

async function exists(path) {
  try {
    const info = await Deno.stat(new URL(toRepoPath(path), ROOT));
    return info.isFile;
  } catch {
    return false;
  }
}

async function readText(path) {
  return await Deno.readTextFile(new URL(toRepoPath(path), ROOT));
}

Deno.test("setiap cuaca punya file SVG", async () => {
  for (const weather of WEATHERS) {
    if (!weather.svg) throw new Error(`Cuaca ${weather.id} tidak punya svg`);

    if (!weather.svg.startsWith("/assets/svg/")) {
      throw new Error(`Path svg cuaca ${weather.id} salah: ${weather.svg}`);
    }

    if (!(await exists(weather.svg))) {
      throw new Error(`File svg cuaca tidak ada: ${weather.svg}`);
    }
  }
});

Deno.test("setiap misi punya file badge", async () => {
  for (const quest of QUESTS) {
    if (!quest.badge) throw new Error(`Misi ${quest.id} tidak punya badge`);

    if (!(await exists(quest.badge))) {
      throw new Error(`File badge tidak ada: ${quest.badge}`);
    }
  }
});

Deno.test("aksesori SVG digambar di dalam SVG kucing", async () => {
  const html = await readText("index.html");
  const css = await readText("styles/scene.css");

  for (const acc of ACCS) {
    if (!acc.svg) continue;

    const marker = `acc acc-${acc.id}`;

    if (!html.includes(marker)) {
      throw new Error(`Aksesori ${acc.id} tidak ada di index.html (${marker})`);
    }

    if (!css.includes(`[data-acc="${acc.id}"]`)) {
      throw new Error(`Aksesori ${acc.id} tidak punya aturan CSS`);
    }
  }
});

Deno.test("semua file SVG valid dan punya viewBox", async () => {
  const dir = new URL("assets/svg/", ROOT);
  let count = 0;

  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".svg")) continue;

    const text = await readText(`assets/svg/${entry.name}`);

    if (!text.includes("<svg") || !text.includes("viewBox=")) {
      throw new Error(`SVG tidak valid: ${entry.name}`);
    }

    count += 1;
  }

  if (count < 10) throw new Error(`Hanya ada ${count} file SVG, seharusnya lebih banyak`);
});
