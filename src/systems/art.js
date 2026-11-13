/*
 * Lapisan aset realistis (PNG).
 *
 * Semua gambar di sini OPSIONAL. Kalau file PNG belum ada (belum di-generate),
 * elemen gambarnya disembunyikan dan game tetap memakai ilustrasi SVG/CSS
 * seperti biasa. Jadi aset realistis bisa ditambahkan tanpa risiko merusak
 * tampilan.
 *
 * Cara membuat asetnya: deno task assets (lihat scripts/gen-assets.js).
 */

export const CAT_DIR = "/assets/cat/";
export const ACCESSORY_DIR = "/assets/accessories/";
export const WEATHER_DIR = "/assets/weather/";

export function createArt({ win, els }) {
  const cache = new Map();

  /* Cek apakah file gambar ada, tanpa menampilkannya dulu. */
  function probe(src) {
    if (cache.has(src)) return cache.get(src);

    const promise = new Promise((resolve) => {
      const img = new win.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });

    cache.set(src, promise);
    return promise;
  }

  function show(el, src) {
    if (!el) return;

    el.setAttribute("src", src);
    el.hidden = false;
    el.classList.add("is-loaded");
  }

  function hide(el) {
    if (!el) return;

    el.hidden = true;
    el.classList.remove("is-loaded");
    el.removeAttribute("src");
  }

  /* ---------- Kucing ---------- */

  async function cat(fur) {
    const el = els.catPhoto;
    const cat = els.cat;

    if (!el || !cat) return;

    if (!fur) {
      hide(el);
      cat.classList.remove("has-photo");
      return;
    }

    const src = `${CAT_DIR}${fur}.png`;
    const ok = await probe(src);

    if (!ok) {
      hide(el);
      cat.classList.remove("has-photo");
      return;
    }

    show(el, src);
    cat.classList.add("has-photo");
  }

  /* ---------- Aksesori ---------- */

  async function accessory(id, slot) {
    const el = els.catAccPhoto;
    const cat = els.cat;

    if (!el || !cat) return;

    if (!id) {
      hide(el);
      cat.removeAttribute("data-acc-photo");
      return;
    }

    const src = `${ACCESSORY_DIR}${id}.png`;
    const ok = await probe(src);

    if (!ok) {
      hide(el);
      cat.removeAttribute("data-acc-photo");
      return;
    }

    show(el, src);
    cat.setAttribute("data-acc-photo", id);
    cat.setAttribute("data-acc-slot", slot || "");
  }

  /* ---------- Cuaca ---------- */

  async function weather(id) {
    if (!id) return;

    const src = `${WEATHER_DIR}${id}.png`;
    const ok = await probe(src);

    if (!ok) {
      hide(els.windowPhoto);
      hide(els.outPhoto);
      return;
    }

    show(els.windowPhoto, src);
    show(els.outPhoto, src);
  }

  return { cat, accessory, weather, probe };
}
