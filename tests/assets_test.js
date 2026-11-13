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

Deno.test("setiap cuaca punya simbol SVG inline", async () => {
  const html = await readText("index.html");

  for (const weather of WEATHERS) {
    if (!weather.symbol) throw new Error(`Cuaca ${weather.id} tidak punya symbol`);

    if (!html.includes(`id="${weather.symbol}"`)) {
      throw new Error(`Simbol cuaca tidak ada di index.html: ${weather.symbol}`);
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

  if (count < 6) throw new Error(`Hanya ada ${count} file SVG, seharusnya lebih banyak`);
});

Deno.test("tidak ada atribut style inline (diblokir CSP)", async () => {
  const html = await readText("index.html");
  const inline = html.match(/\sstyle="/g);

  if (inline) {
    throw new Error(
      `Ada ${inline.length} atribut style inline. CSP "style-src 'self'" memblokirnya, ` +
        "jadi atributnya diabaikan. Pakai atribut presentasi (fill, stroke, ...).",
    );
  }
});

Deno.test("warna gradient memakai atribut stop-color", async () => {
  const html = await readText("index.html");

  if (html.includes('style="stop-color')) {
    throw new Error("stop-color harus pakai atribut presentasi, bukan style inline");
  }

  const gradients = html.match(/<(linear|radial)Gradient/g) || [];

  if (gradients.length < 5) throw new Error("Gradient SVG tiba-tiba hilang");
});
