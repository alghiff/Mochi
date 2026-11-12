/*
 * Alat admin untuk melihat isi cloud save.
 *
 * Kode cloud disimpan server sebagai hash SHA-256, jadi daftar record hanya
 * menampilkan hash. Untuk mencari record milik sebuah kode, pakai perintah
 * show — skrip ini yang menghitung hash-nya.
 *
 * Pemakaian:
 *   deno task cloud list
 *   deno task cloud list --file
 *   deno task cloud show ABCD-EFGH-JKLM
 *   deno task cloud export backup-cloud.json
 *
 * Sumber data mengikuti server: KV_PATH bila diisi, kalau tidak Deno KV
 * default. --file memaksa membaca fallback data/cloud.json.
 */

import { CLOUD_FILE, KV_PATH } from "../server/config.js";
import { hashCloudCode, KV_PREFIX } from "../server/cloud.js";

const encoder = new TextEncoder();
const args = Deno.args.filter((arg) => arg !== "--file");
const useFile = Deno.args.includes("--file");
const command = args[0] || "list";

function formatDate(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function stateSize(state) {
  if (!state) return 0;
  return encoder.encode(JSON.stringify(state)).byteLength;
}

function formatSize(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

async function readKv() {
  const store = await Deno.openKv(KV_PATH || undefined);
  const records = [];

  for await (const entry of store.list({ prefix: [KV_PREFIX] })) {
    records.push({ hash: String(entry.key[1]), record: entry.value });
  }

  await store.close();
  return records;
}

async function readFile() {
  let text;

  try {
    text = await Deno.readTextFile(CLOUD_FILE);
  } catch {
    return [];
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

  return Object.entries(parsed)
    .filter(([key, value]) => /^[a-f0-9]{64}$/.test(key) && value && typeof value === "object")
    .map(([hash, record]) => ({ hash, record }));
}

async function loadRecords() {
  if (useFile) {
    return { source: `file ${CLOUD_FILE.pathname}`, records: await readFile() };
  }

  try {
    return { source: kvLabel(), records: await readKv() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`KV tidak bisa dibuka (${message}); memakai data/cloud.json.`);
    return { source: `file ${CLOUD_FILE.pathname}`, records: await readFile() };
  }
}

function kvLabel() {
  if (!KV_PATH) return "Deno KV (lokasi default)";

  const root = new URL("../", import.meta.url).pathname;
  const path = KV_PATH.startsWith(root) ? KV_PATH.slice(root.length) : KV_PATH;

  return `Deno KV (${path})`;
}

/* Saat kosong, tampilkan petunjuk agar tidak bingung beda lokasi KV. */
async function printHint(log = console.log) {
  const fileRecords = await readFile();

  log("");

  if (fileRecords.length > 0) {
    log(`Catatan: ada ${fileRecords.length} record di data/cloud.json.`);
    log("Jalankan: deno task cloud list --file");
    return;
  }

  log("Tips: pastikan KV_PATH sama dengan yang dipakai server.");
  log(`Tanpa override, server dan alat ini memakai ${kvLabel()}.`);
}

function printList(records) {
  if (records.length === 0) {
    console.log("Belum ada record cloud save.");
    return;
  }

  const rows = records
    .map(({ hash, record }) => {
      const state = record && record.state ? record.state : null;
      return {
        hash: hash.slice(0, 16) + "…",
        name: state ? state.name || "-" : "(belum disimpan)",
        level: state ? state.level : "-",
        coins: state ? state.coins : "-",
        saved: formatDate(record && record.savedAt),
        size: formatSize(stateSize(state)),
      };
    })
    .sort((a, b) => a.saved.localeCompare(b.saved));

  console.log(
    pad("HASH", 19) +
      pad("NAMA", 18) +
      pad("LV", 5) +
      pad("KOIN", 7) +
      pad("DISIMPAN", 20) +
      "UKURAN",
  );

  for (const row of rows) {
    console.log(
      pad(row.hash, 19) +
        pad(row.name, 18) +
        pad(row.level, 5) +
        pad(row.coins, 7) +
        pad(row.saved, 20) +
        row.size,
    );
  }

  const filled = records.filter((entry) => entry.record && entry.record.state).length;
  console.log("");
  console.log(
    `Total ${records.length} record — ${filled} tersimpan, ${records.length - filled} kosong.`,
  );
}

async function show(code) {
  if (!code) {
    console.error("Masukkan kode cloud, contoh: deno task cloud show ABCD-EFGH-JKLM");
    Deno.exit(2);
  }

  const hash = await hashCloudCode(code);
  const { source, records } = await loadRecords();
  const found = records.find((entry) => entry.hash === hash);

  if (!found) {
    console.error(`Kode tidak ditemukan di ${source}.`);
    console.error(`Hash yang dicari: ${hash}`);
    await printHint((line) => console.error(line));
    Deno.exit(1);
  }

  const { record } = found;

  console.log(`Kode    : ${code.toUpperCase()}`);
  console.log(`Hash    : ${hash}`);
  console.log(`Dibuat  : ${formatDate(record && record.createdAt)}`);
  console.log(`Disimpan: ${formatDate(record && record.savedAt)}`);
  console.log(`Ukuran  : ${formatSize(stateSize(record && record.state))}`);
  console.log("State   :");

  if (record && record.state) {
    console.log(JSON.stringify(record.state, null, 2));
  } else {
    console.log("(belum ada snapshot; kode dibuat tapi belum pernah disimpan)");
  }
}

async function exportRecords(target) {
  const { source, records } = await loadRecords();
  const path = target || `cloud-export-${Date.now()}.json`;
  const payload = {
    exportedAt: new Date().toISOString(),
    source,
    records,
  };

  await Deno.writeTextFile(path, JSON.stringify(payload, null, 2));
  console.log(`Mengekspor ${records.length} record dari ${source} ke ${path}.`);
}

if (command === "list") {
  const { source, records } = await loadRecords();
  console.log(`Sumber: ${source}`);
  console.log("");
  printList(records);
  if (records.length === 0) await printHint();
} else if (command === "show") {
  await show(args[1]);
} else if (command === "export") {
  await exportRecords(args[1]);
} else if (command === "help" || command === "--help" || command === "-h") {
  console.log("Perintah: list | show <kode> | export [file] | help");
  console.log("Flag: --file (paksa baca data/cloud.json)");
} else {
  console.error(`Perintah tidak dikenal: ${command}`);
  console.error("Perintah: list | show <kode> | export [file] | help");
  Deno.exit(2);
}
