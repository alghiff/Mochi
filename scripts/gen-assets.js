/*
 * Generator aset PNG.
 *
 * Sumber gambar (pilih salah satu lewat env):
 *   GEMINI_API_KEY  -> Google Gemini 2.5 Flash Image (gratis, tanpa watermark,
 *                      mendukung edit gambar sehingga aksesori bisa ditempel
 *                      ke kucing yang sama persis)
 *   HF_TOKEN        -> Hugging Face Inference (FLUX.1-schnell, gratis)
 *   (tanpa key)     -> Pollinations (gratis, TAPI ada watermark di pojok)
 *
 * Contoh:
 *   GEMINI_API_KEY=xxx deno run -A scripts/gen-assets.js
 *   GEMINI_API_KEY=xxx deno run -A scripts/gen-assets.js --group cat
 *   deno run -A scripts/gen-assets.js --list
 *
 * File yang sudah ada tidak digenerate ulang (pakai --force untuk memaksa).
 */

import { buildManifest } from "./assets.manifest.js";

const args = Deno.args;
const force = args.includes("--force");
const listOnly = args.includes("--list");
const groupIndex = args.indexOf("--group");
const group = groupIndex >= 0 ? args[groupIndex + 1] : null;

const MANIFEST = buildManifest();

function env(name) {
  try {
    return Deno.env.get(name) || "";
  } catch {
    return "";
  }
}

function provider() {
  if (env("GEMINI_API_KEY")) return "gemini";
  if (env("HF_TOKEN")) return "hf";
  return "pollinations";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------- Gemini ---------- */

async function generateGemini(prompt) {
  const key = env("GEMINI_API_KEY");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`;

  const body = {
    contents: [
      {
        parts: [{ text: `${prompt}. Square composition, subject centered with margin around it.` }],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const inline = parts.find((part) => part.inlineData?.data);

  if (!inline) throw new Error("Gemini tidak mengembalikan gambar");

  const mime = inline.inlineData.mimeType || "image/png";
  const ext = mime.includes("jpeg") ? "jpg" : "png";

  return { bytes: Uint8Array.from(atob(inline.inlineData.data), (c) => c.charCodeAt(0)), ext };
}

/* ---------- Hugging Face ---------- */

async function generateHf(prompt, size) {
  const token = env("HF_TOKEN");
  const url = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { width: size, height: size, num_inference_steps: 4 },
    }),
  });

  if (!res.ok) {
    throw new Error(`HF ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const type = res.headers.get("content-type") || "";

  if (type.includes("application/json")) {
    throw new Error(`HF: ${(await res.text()).slice(0, 300)}`);
  }

  return { bytes: new Uint8Array(await res.arrayBuffer()), ext: "png" };
}

/* ---------- Pollinations (fallback, ada watermark) ---------- */

async function generatePollinations(prompt, size) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${size}&height=${size}&nologo=true&seed=42&model=sana`;

  const res = await fetch(url);

  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const type = res.headers.get("content-type") || "";
  const ext = type.includes("jpeg") ? "jpg" : "png";

  return { bytes: new Uint8Array(await res.arrayBuffer()), ext };
}

/* ---------- Jalankan ---------- */

const generators = {
  gemini: generateGemini,
  hf: generateHf,
  pollinations: generatePollinations,
};

if (listOnly) {
  for (const item of MANIFEST) {
    console.log(`${item.group}\t${item.file}\t${item.size}`);
  }

  Deno.exit(0);
}

const chosen = provider();
const generate = generators[chosen];

console.log(`Provider: ${chosen}`);

if (chosen === "pollinations") {
  console.warn(
    "PERINGATAN: Pollinations gratis menaruh watermark di pojok gambar. " +
      "Set GEMINI_API_KEY atau HF_TOKEN untuk hasil tanpa watermark.",
  );
}

const targets = group ? MANIFEST.filter((item) => item.group === group) : MANIFEST;
let done = 0;
let skipped = 0;
const failed = [];

for (const item of targets) {
  const target = item.file.replace(/\.(png|jpg)$/, "");
  const existing = [];

  for (const ext of ["png", "jpg"]) {
    try {
      await Deno.stat(`${target}.${ext}`);
      existing.push(ext);
    } catch {
      /* belum ada */
    }
  }

  if (existing.length > 0 && !force) {
    skipped += 1;
    console.log(`skip   ${item.file} (sudah ada)`);
    continue;
  }

  try {
    const { bytes, ext } = await generate(item.prompt, item.size);
    const path = `${target}.${ext}`;

    await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await Deno.writeFile(path, bytes);

    done += 1;
    console.log(`ok     ${path} (${(bytes.length / 1024).toFixed(0)} KB)`);
  } catch (error) {
    failed.push([item.file, error instanceof Error ? error.message : String(error)]);
    console.error(`gagal  ${item.file}: ${error instanceof Error ? error.message : error}`);
  }

  await sleep(1200);
}

console.log("");
console.log(`Selesai: ${done} dibuat, ${skipped} dilewati, ${failed.length} gagal.`);

if (failed.length > 0) {
  console.log("");
  for (const [file, message] of failed) console.log(`- ${file}: ${message}`);
  Deno.exit(1);
}
