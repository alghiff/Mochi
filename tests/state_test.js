/*
 * Regression test sanitasi state.
 *
 * Cloud save menerima state dari klien. Array kepemilikan harus dibersihkan
 * dari ID asing dan duplikat supaya UI tidak menggambar item yang sama
 * berulang-ulang.
 */

import { sanitizeState } from "../src/core/state.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Gagal: ${message}`);
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
