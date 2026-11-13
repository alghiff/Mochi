/*
 * Pemeriksaan file terjemahan.
 *
 * Menastikan:
 *  - id/ja/ko punya key yang sama (tanpa key hilang atau typo).
 *  - Semua key yang dipakai kode ada di kamus Indonesia.
 *  - Placeholder {name} pada tiap bahasa konsisten dengan versi Indonesia.
 */

import { I18N } from "../src/data/i18n/index.js";

const SRC_FILES = [
  "src/app.js",
  "src/ui/feedback.js",
  "src/ui/overlay.js",
  "src/ui/shop.js",
  "src/systems/audio.js",
  "src/systems/cloud.js",
  "src/systems/mic.js",
  "src/systems/multiplayer.js",
  "src/systems/quests.js",
  "src/systems/weather.js",
  "src/game/minigame.js",
];

const ROOT = new URL("../", import.meta.url);

function placeholders(text) {
  const found = String(text).match(/\{[a-zA-Z0-9_]+\}/g);
  return found ? found.slice().sort() : [];
}

Deno.test("semua bahasa punya key yang sama", () => {
  const base = Object.keys(I18N.id).sort();

  for (const lang of ["ja", "ko"]) {
    const keys = Object.keys(I18N[lang]).sort();
    const missing = base.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !base.includes(key));

    if (missing.length > 0) {
      throw new Error(`Bahasa ${lang} kehilangan key: ${missing.join(", ")}`);
    }

    if (extra.length > 0) {
      throw new Error(`Bahasa ${lang} punya key tambahan: ${extra.join(", ")}`);
    }
  }
});

Deno.test("placeholder tiap bahasa konsisten", () => {
  for (const [lang, dict] of Object.entries(I18N)) {
    for (const [key, value] of Object.entries(dict)) {
      const expected = placeholders(I18N.id[key]);
      const actual = placeholders(value);

      if (expected.join("|") !== actual.join("|")) {
        throw new Error(
          `Placeholder tidak cocok pada ${lang}.${key}: ` +
            `harus ${expected.join(",") || "-"}, ada ${actual.join(",") || "-"}`,
        );
      }
    }
  }
});

Deno.test("key yang dipakai di kode selalu ada", async () => {
  const known = new Set(Object.keys(I18N.id));
  const missing = new Set();

  for (const file of SRC_FILES) {
    const text = await Deno.readTextFile(new URL(file, ROOT));
    const pattern = /\bt\(\s*"([a-zA-Z0-9_.]+)"/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const key = match[1];

      // Key dinamis seperti "quest.name." + id dicek terpisah di bawah.
      if (key.endsWith(".")) continue;

      if (!known.has(key)) missing.add(`${file}: ${key}`);
    }
  }

  if (missing.size > 0) {
    throw new Error(`Key terjemahan hilang:\n${[...missing].join("\n")}`);
  }
});

Deno.test("key misi dinamis tersedia untuk semua quest", async () => {
  const { QUESTS } = await import("../src/data/quests.js");
  const known = new Set(Object.keys(I18N.id));
  const missing = [];

  for (const quest of QUESTS) {
    for (const prefix of ["quest.name.", "quest.desc."]) {
      const key = prefix + quest.id;

      if (!known.has(key)) missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Key terjemahan misi hilang: ${missing.join(", ")}`);
  }
});

Deno.test("key di index.html ada di kamus", async () => {
  const known = new Set(Object.keys(I18N.id));
  const text = await Deno.readTextFile(new URL("index.html", ROOT));
  const pattern = /data-i18n(?:-aria|-placeholder)?="([a-zA-Z0-9_.]+)"/g;
  const missing = new Set();
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (!known.has(match[1])) missing.add(match[1]);
  }

  if (missing.size > 0) {
    throw new Error(`Key terjemahan hilang: ${[...missing].join(", ")}`);
  }
});
