/*
 * Regression test sanitasi state dan progres level.
 *
 * Cloud save menerima state dari klien. Array kepemilikan harus dibersihkan
 * dari ID asing dan duplikat supaya UI tidak menggambar item yang sama
 * berulang-ulang. Level juga dibatasi dan hadiahnya harus konsisten.
 */

import { addXpToState, freshState, MAX_LEVEL, sanitizeState } from "../src/core/state.js";
import { ACCS } from "../src/data/accessories.js";
import { xpNeeded } from "../src/core/util.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Gagal: ${message}`);
}

function stateAt(level) {
  const state = freshState();

  state.level = level;
  state.xp = 0;
  state.coins = 0;
  state.ownedAcc = [];

  return state;
}

Deno.test("sanitizeState membuang item duplikat dan ID asing", () => {
  const state = sanitizeState({
    ownedFur: ["cream", "cream", "mint", "mint", "bukan-bulu"],
    ownedAcc: ["beanie", "beanie", "bukan-aksesori"],
    fur: "mint",
    acc: "beanie",
  });

  const cream = state.ownedFur.filter((id) => id === "cream").length;
  const mint = state.ownedFur.filter((id) => id === "mint").length;
  const beanie = state.ownedAcc.filter((id) => id === "beanie").length;

  assert(cream === 1, "cream harus muncul sekali");
  assert(mint === 1, "mint harus muncul sekali");
  assert(beanie === 1, "beanie harus muncul sekali");
  assert(!state.ownedFur.includes("bukan-bulu"), "ID bulu asing harus dibuang");
  assert(!state.ownedAcc.includes("bukan-aksesori"), "ID aksesori asing harus dibuang");
  assert(state.fur === "mint", "bulu aktif harus tetap dipakai");
  assert(state.acc === "beanie", "aksesori aktif harus tetap dipakai");
});

Deno.test("level dibatasi sampai MAX_LEVEL", () => {
  const state = sanitizeState({ level: 9999, xp: 999999 });

  assert(state.level === MAX_LEVEL, `level harus ${MAX_LEVEL}`);
  assert(state.xp <= xpNeeded(MAX_LEVEL) - 1, "XP di atas batas harus dipotong");
});

Deno.test("naik level memberi koin dasar dan bonus kelipatan 10", () => {
  const state = stateAt(9);
  state.xp = xpNeeded(9) - 1;

  const result = addXpToState(state, 1, () => 0);

  assert(result.levels === 1, "harus naik satu level");
  assert(state.level === 10, "level harus menjadi 10");
  assert(state.coins === 60, `koin harus 60, bukan ${state.coins}`);
  assert(result.rewards.some((item) => item.type === "coins" && item.amount === 50), "bonus koin");
});

Deno.test("level kelipatan 25 memberi aksesori acak", () => {
  const state = stateAt(24);
  state.xp = xpNeeded(24) - 1;

  const result = addXpToState(state, 1, () => 0);
  const expected = ACCS[0].id;

  assert(state.level === 25, "level harus menjadi 25");
  assert(state.ownedAcc.includes(expected), `aksesori ${expected} harus didapat`);
  assert(state.coins === 10, `koin harus 10, bukan ${state.coins}`);
  assert(
    result.rewards.some((item) => item.type === "accessory" && item.acc === expected),
    "hadiah aksesori harus dilaporkan",
  );
});

Deno.test("aksesori duplikat dikonversi menjadi koin", () => {
  const state = stateAt(24);
  state.xp = xpNeeded(24) - 1;
  state.ownedAcc = [ACCS[0].id];

  const result = addXpToState(state, 1, () => 0);

  assert(state.level === 25, "level harus menjadi 25");
  assert(state.coins === 110, `koin harus 110, bukan ${state.coins}`);
  assert(
    result.rewards.some((item) => item.type === "coins" && item.duplicate),
    "hadiah duplikat harus dilaporkan",
  );
});

Deno.test("semua aksesori dimiliki dikonversi menjadi koin", () => {
  const state = stateAt(24);
  state.xp = xpNeeded(24) - 1;
  state.ownedAcc = ACCS.map((item) => item.id);

  const result = addXpToState(state, 1, () => 0);

  assert(state.level === 25, "level harus menjadi 25");
  assert(state.coins === 110, `koin harus 110, bukan ${state.coins}`);
  assert(
    result.rewards.some((item) => item.type === "coins" && item.allOwned),
    "hadiah semua-aksesori harus dilaporkan",
  );
});

Deno.test("XP tetap terkumpul tapi level berhenti di MAX_LEVEL", () => {
  const state = stateAt(MAX_LEVEL);
  const result = addXpToState(state, 100000, () => 0);

  assert(result.levels === 0, "tidak boleh naik level lagi");
  assert(state.level === MAX_LEVEL, `level harus tetap ${MAX_LEVEL}`);
  assert(state.xp === xpNeeded(MAX_LEVEL) - 1, "XP harus dipotong ke batas");
});
