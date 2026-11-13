/*
 * Regression test modul toko.
 *
 * Fokus: setelah membeli atau memakai item, tampilan keseluruhan (koin HUD,
 * aksesori kucing) harus ikut diperbarui. Sebelumnya parameter `render`
 * tertutup oleh fungsi lokal dengan nama sama, sehingga HUD tidak pernah
 * diperbarui.
 */

import { createShop } from "../src/ui/shop.js";

function createEl(tag) {
  const el = {
    tag,
    className: "",
    textContent: "",
    hidden: false,
    disabled: false,
    value: "",
    children: [],
    attributes: {},
    parentNode: null,
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    getAttribute(key) {
      return key in this.attributes ? this.attributes[key] : null;
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    focus() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 0, height: 0 };
    },
  };

  return el;
}

function createHarness() {
  const state = {
    name: "Mochi",
    level: 1,
    coins: 100,
    fur: "cream",
    acc: null,
    ownedFur: ["cream"],
    ownedAcc: [],
    weather: { id: "spring", nextAt: 0 },
  };

  const calls = { renderApp: 0, save: 0, mp: 0 };

  const doc = {
    createElement: createEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    activeElement: null,
    body: createEl("body"),
  };

  const els = {
    shopGrid: createEl("div"),
    shopCoins: createEl("b"),
    shopSeasonNow: createEl("span"),
  };

  const shop = createShop({
    doc,
    els,
    getState: () => state,
    t: (key) => key,
    confirm: () => Promise.resolve(true),
    toast() {},
    sfx() {},
    spawnFx() {},
    addXp() {},
    save() {
      calls.save += 1;
    },
    renderApp() {
      calls.renderApp += 1;
    },
    sendMpState() {
      calls.mp += 1;
    },
  });

  return { shop, state, calls };
}

Deno.test("beli item memanggil render aplikasi", async () => {
  const { shop, state, calls } = createHarness();

  await shop.select({ id: "rose", nameKey: "fur.rose", price: 30 });

  assertEquals(state.coins, 70, "koin harus berkurang");
  assertEquals(state.fur, "rose", "bulu harus dipakai");
  assertEquals(calls.renderApp, 1, "render aplikasi harus dipanggil");
  assertEquals(calls.save, 1, "progres harus disimpan");
  assertEquals(calls.mp, 1, "state multiplayer harus dikirim");
});

Deno.test("pakai item yang sudah dimiliki tetap memperbarui tampilan", async () => {
  const { shop, state, calls } = createHarness();

  await shop.select({ id: "rose", nameKey: "fur.rose", price: 30 });
  await shop.select({ id: "cream", nameKey: "fur.cream", price: 0 });

  assertEquals(state.fur, "cream", "bulu lama harus dipakai lagi");
  assertEquals(calls.renderApp, 2, "render aplikasi harus dipanggil dua kali");
});

Deno.test("item yang tidak bisa dibeli tidak mengubah state", async () => {
  const { shop, state, calls } = createHarness();

  state.coins = 5;

  await shop.select({ id: "rose", nameKey: "fur.rose", price: 30 });

  assertEquals(state.coins, 5, "koin tidak boleh berubah");
  assertEquals(state.fur, "cream", "bulu tidak boleh berubah");
  assertEquals(calls.renderApp, 0, "render tidak boleh dipanggil");
});

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Gagal: ${message} (dapat ${actual}, harus ${expected})`);
  }
}
