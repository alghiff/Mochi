import { clamp, sanitizeName, todayKey, validId, weekKey, xpNeeded } from "./util.js";
import { FURS } from "../data/furs.js";
import { ACCS } from "../data/accessories.js";
import { QUEST_IDS, questById, WEEKLY_IDS, weeklyById } from "../data/quests.js";
import { isWeatherId, WEATHER_DURATION_MS, weatherById } from "../data/weather.js";
import { LANGS } from "../data/langs.js";

export const SAVE_KEY = "mochi.virtualcat.v1";
export const CLOUD_KEY = "mochi.cloud.code.v1";
export const SAVE_VERSION = 3;
export const MAX_OFFLINE_SECONDS = 12 * 60 * 60;
export const STAT_KEYS = ["hunger", "clean", "energy", "happy"];

/* Level tertinggi. Setelah ini XP tetap bisa terkumpul, tapi tidak naik lagi. */
export const MAX_LEVEL = 199;

/* Hadiah tambahan saat level tertentu. */
export const LEVEL_COIN_REWARD = 50;
export const LEVEL_ACC_COIN_REWARD = 100;

export const DECAY = {
  hunger: 0.045,
  clean: 0.03,
  energy: 0.025,
  happy: 0.02,
};

export const SLEEP_REGEN = 0.4;

export function emptyQuests() {
  return { date: todayKey(), progress: {}, claimed: {}, announced: {} };
}

export function emptyWeekly() {
  return { week: weekKey(), progress: {}, claimed: {}, announced: {} };
}

export function freshState() {
  return {
    version: SAVE_VERSION,
    name: "Mochi",
    level: 1,
    xp: 0,
    coins: 20,
    stats: { hunger: 82, clean: 88, energy: 90, happy: 84 },
    fur: "cream",
    acc: null,
    ownedFur: ["cream"],
    ownedAcc: [],
    sound: true,
    music: true,
    musicVol: 0.55,
    lang: "id",
    scene: "inside",
    sleeping: false,
    weather: { id: "spring", nextAt: Date.now() + WEATHER_DURATION_MS },
    quests: emptyQuests(),
    weekly: emptyWeekly(),
    lastSeen: Date.now(),
  };
}

function sanitizeQuests(raw) {
  const clean = emptyQuests();

  if (!raw || typeof raw !== "object") return clean;

  if (typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    clean.date = raw.date;
  }

  for (const id of QUEST_IDS) {
    const quest = questById(id);
    const target = quest ? quest.target : 1;
    const progress = Number(raw.progress && raw.progress[id]);
    const announced = Boolean(raw.announced && raw.announced[id]);

    clean.progress[id] = Number.isFinite(progress) ? clamp(Math.floor(progress), 0, target) : 0;
    clean.claimed[id] = Boolean(raw.claimed && raw.claimed[id]);
    clean.announced[id] = announced;
  }

  return clean;
}

function sanitizeWeekly(raw) {
  const clean = emptyWeekly();

  if (!raw || typeof raw !== "object") return clean;

  if (typeof raw.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.week)) {
    clean.week = raw.week;
  }

  for (const id of WEEKLY_IDS) {
    const quest = weeklyById(id);
    const target = quest ? quest.target : 1;
    const progress = Number(raw.progress && raw.progress[id]);
    const announced = Boolean(raw.announced && raw.announced[id]);

    clean.progress[id] = Number.isFinite(progress) ? clamp(Math.floor(progress), 0, target) : 0;
    clean.claimed[id] = Boolean(raw.claimed && raw.claimed[id]);
    clean.announced[id] = announced;
  }

  return clean;
}

function sanitizeWeather(raw, base) {
  if (!raw || typeof raw !== "object") return base.weather;

  const id = isWeatherId(raw.id) ? raw.id : base.weather.id;
  const nextAt = Number(raw.nextAt);

  return {
    id: weatherById(id).id,
    nextAt: Number.isFinite(nextAt)
      ? clamp(nextAt, 0, Date.now() + WEATHER_DURATION_MS * 2)
      : base.weather.nextAt,
  };
}

export function sanitizeState(raw) {
  const base = freshState();
  if (!raw || typeof raw !== "object") return base;

  const clean = base;

  if (typeof raw.name === "string") clean.name = sanitizeName(raw.name);

  clean.level = clamp(Math.floor(Number(raw.level) || 1), 1, MAX_LEVEL);
  clean.xp = clamp(
    Math.floor(Number(raw.xp) || 0),
    0,
    clean.level >= MAX_LEVEL ? xpNeeded(MAX_LEVEL) - 1 : 1000000,
  );
  clean.coins = clamp(Math.floor(Number(raw.coins) || 0), 0, 999999);

  if (raw.stats && typeof raw.stats === "object") {
    for (const key of STAT_KEYS) {
      const value = Number(raw.stats[key]);
      clean.stats[key] = Number.isFinite(value) ? clamp(value, 0, 100) : base.stats[key];
    }
  }

  if (typeof raw.fur === "string" && validId(FURS, raw.fur)) clean.fur = raw.fur;
  if (typeof raw.acc === "string" && validId(ACCS, raw.acc)) clean.acc = raw.acc;
  else clean.acc = null;

  if (Array.isArray(raw.ownedFur)) {
    // Set membuang duplikat dari cloud save yang rusak/dimodifikasi.
    clean.ownedFur = [
      ...new Set(raw.ownedFur.filter((id) => typeof id === "string" && validId(FURS, id))),
    ];
  }
  if (Array.isArray(raw.ownedAcc)) {
    clean.ownedAcc = [
      ...new Set(raw.ownedAcc.filter((id) => typeof id === "string" && validId(ACCS, id))),
    ];
  }

  if (clean.ownedFur.indexOf("cream") === -1) clean.ownedFur.unshift("cream");
  if (clean.ownedFur.indexOf(clean.fur) === -1) clean.ownedFur.push(clean.fur);
  if (clean.acc && clean.ownedAcc.indexOf(clean.acc) === -1) clean.ownedAcc.push(clean.acc);

  if (typeof raw.sound === "boolean") clean.sound = raw.sound;
  if (typeof raw.music === "boolean") clean.music = raw.music;
  if (Number.isFinite(Number(raw.musicVol))) clean.musicVol = clamp(Number(raw.musicVol), 0, 1);
  if (LANGS.includes(raw.lang)) clean.lang = raw.lang;
  if (raw.scene === "outside" || raw.scene === "inside") clean.scene = raw.scene;
  if (typeof raw.sleeping === "boolean") clean.sleeping = raw.sleeping;
  if (Number.isFinite(Number(raw.lastSeen))) clean.lastSeen = Number(raw.lastSeen);

  clean.weather = sanitizeWeather(raw.weather, base);
  clean.quests = sanitizeQuests(raw.quests);
  clean.weekly = sanitizeWeekly(raw.weekly);

  return clean;
}

export function loadState(win) {
  try {
    const text = win.localStorage.getItem(SAVE_KEY);
    if (!text) return freshState();
    return sanitizeState(JSON.parse(text));
  } catch {
    return freshState();
  }
}

/*
 * Status penyimpanan browser.
 *
 * localStorage bisa diblokir (mode privat, kuota penuh, setelan browser).
 * Kegagalan tidak boleh membuat game crash, tapi pemain layak diberi tahu
 * kalau progresnya tidak tersimpan.
 */
let storageFailed = false;

export function storageAvailable() {
  return !storageFailed;
}

export function saveState(win, state, options) {
  if (!state) return;

  const keepLastSeen = Boolean(options && options.keepLastSeen);

  // Saat tab disembunyikan, lastSeen tidak diperbarui supaya progres
  // offline terhitung benar-benar ketika pemain kembali.
  if (!keepLastSeen) state.lastSeen = Date.now();

  try {
    win.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    storageFailed = false;
  } catch {
    storageFailed = true;
  }
}

export function loadCloudCode(win) {
  try {
    const value = win.localStorage.getItem(CLOUD_KEY);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

export function saveCloudCode(win, code) {
  try {
    if (code) win.localStorage.setItem(CLOUD_KEY, code);
    else win.localStorage.removeItem(CLOUD_KEY);
  } catch {
    /* opsional */
  }
}

export function applyOfflineProgress(state, now) {
  const current = Number(now) || Date.now();
  let seconds = 0;

  if (state.lastSeen && Number.isFinite(state.lastSeen)) {
    seconds = clamp((current - state.lastSeen) / 1000, 0, MAX_OFFLINE_SECONDS);
  }

  if (seconds < 20) return 0;

  if (state.sleeping) {
    state.stats.energy = clamp(state.stats.energy + SLEEP_REGEN * seconds, 0, 100);
    state.stats.hunger = clamp(state.stats.hunger - 0.012 * seconds, 0, 100);
    state.stats.clean = clamp(state.stats.clean - 0.008 * seconds, 0, 100);
    state.stats.happy = clamp(state.stats.happy - 0.006 * seconds, 0, 100);
  } else {
    state.stats.hunger = clamp(state.stats.hunger - DECAY.hunger * seconds, 0, 100);
    state.stats.clean = clamp(state.stats.clean - DECAY.clean * seconds, 0, 100);
    state.stats.energy = clamp(state.stats.energy - DECAY.energy * seconds, 0, 100);
    state.stats.happy = clamp(state.stats.happy - DECAY.happy * seconds, 0, 100);
  }

  return seconds;
}

/*
 * Hadiah per level.
 *
 * - Setiap naik level tetap dapat 10 koin.
 * - Kelipatan 10 dapat bonus koin.
 * - Kelipatan 25 dapat aksesori acak. Kalau aksesorinya sudah dimiliki,
 *   atau semua aksesori sudah lengkap, hadiahnya dikonversi menjadi koin.
 */
function grantLevelRewards(state, level, rewards, random) {
  state.coins = Math.min(999999, state.coins + 10);

  if (level % 10 === 0) {
    state.coins = Math.min(999999, state.coins + LEVEL_COIN_REWARD);
    rewards.push({ type: "coins", level, amount: LEVEL_COIN_REWARD });
  }

  if (level % 25 !== 0) return;

  const allOwned = ACCS.every((item) => state.ownedAcc.includes(item.id));

  if (allOwned) {
    state.coins = Math.min(999999, state.coins + LEVEL_ACC_COIN_REWARD);
    rewards.push({
      type: "coins",
      level,
      amount: LEVEL_ACC_COIN_REWARD,
      allOwned: true,
    });
    return;
  }

  const pool = ACCS;
  const picked = pool[Math.floor(random() * pool.length)] || pool[0];

  if (state.ownedAcc.includes(picked.id)) {
    state.coins = Math.min(999999, state.coins + LEVEL_ACC_COIN_REWARD);
    rewards.push({
      type: "coins",
      level,
      amount: LEVEL_ACC_COIN_REWARD,
      acc: picked.id,
      duplicate: true,
    });
    return;
  }

  state.ownedAcc.push(picked.id);
  rewards.push({ type: "accessory", level, acc: picked.id });
}

export function addXpToState(state, amount, random = Math.random) {
  const gain = Math.max(0, Math.round(amount));
  const rewards = [];

  if (!gain) return { levels: 0, rewards };

  state.xp += gain;
  let levels = 0;

  while (state.level < MAX_LEVEL && state.xp >= xpNeeded(state.level) && levels < 50) {
    state.xp -= xpNeeded(state.level);
    state.level += 1;
    grantLevelRewards(state, state.level, rewards, random);
    levels += 1;
  }

  if (state.level >= MAX_LEVEL) {
    state.xp = Math.min(state.xp, xpNeeded(MAX_LEVEL) - 1);
  }

  return { levels, rewards };
}
