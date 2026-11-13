/*
 * Test modul aset PNG.
 *
 * Semua aset PNG bersifat opsional. Modul art hanya memunculkan gambar kalau
 * file-nya benar-benar bisa dimuat; kalau gagal, ilustrasi SVG tetap dipakai.
 */

import { createArt } from "../src/systems/art.js";

function createElement() {
  return {
    attrs: {},
    hidden: false,
    classList: {
      items: new Set(),
      add(name) {
        this.items.add(name);
      },
      remove(name) {
        this.items.delete(name);
      },
      contains(name) {
        return this.items.has(name);
      },
    },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    getAttribute(key) {
      return key in this.attrs ? this.attrs[key] : null;
    },
    removeAttribute(key) {
      delete this.attrs[key];
    },
  };
}

/* Stub win.Image: file yang ada dimuat, selain itu gagal. */
function createHarness(available) {
  const cat = createElement();
  const els = {
    cat,
    catPhoto: createElement(),
    catAccPhoto: createElement(),
    windowPhoto: createElement(),
    outPhoto: createElement(),
  };

  const win = {
    Image: class {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }

      set src(value) {
        this._src = value;

        queueMicrotask(() => {
          if (available(value)) {
            if (this.onload) this.onload();
          } else if (this.onerror) {
            this.onerror();
          }
        });
      }

      get src() {
        return this._src;
      }
    },
  };

  return { art: createArt({ win, els }), cat, els };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

Deno.test("kucing pakai foto kalau file PNG ada", async () => {
  const { art, cat, els } = createHarness((src) => src.endsWith("/cat/cream.png"));

  await art.cat("cream");
  await tick();

  if (!cat.classList.contains("has-photo")) {
    throw new Error("Kucing harus memakai mode foto");
  }

  if (els.catPhoto.getAttribute("src") !== "/assets/cat/cream.png") {
    throw new Error(`Src foto salah: ${els.catPhoto.getAttribute("src")}`);
  }
});

Deno.test("kucing tetap ilustrasi kalau PNG belum ada", async () => {
  const { art, cat, els } = createHarness(() => false);

  await art.cat("cream");
  await tick();

  if (cat.classList.contains("has-photo")) {
    throw new Error("Mode foto tidak boleh aktif tanpa file");
  }

  if (els.catPhoto.hidden !== true) {
    throw new Error("Gambar kucing harus tersembunyi");
  }
});

Deno.test("aksesori foto mencatat slotnya", async () => {
  const { art, cat, els } = createHarness((src) => src.endsWith("/accessories/beanie.png"));

  await art.accessory("beanie", "head");
  await tick();

  if (cat.getAttribute("data-acc-photo") !== "beanie") {
    throw new Error(`Slot aksesori salah: ${cat.getAttribute("data-acc-photo")}`);
  }

  if (els.catAccPhoto.getAttribute("src") !== "/assets/accessories/beanie.png") {
    throw new Error("Src aksesori salah");
  }
});

Deno.test("cuaca memuat foto untuk jendela dan halaman luar", async () => {
  const { art, els } = createHarness((src) => src.endsWith("/weather/rain.png"));

  await art.weather("rain");
  await tick();

  if (els.windowPhoto.getAttribute("src") !== "/assets/weather/rain.png") {
    throw new Error("Foto jendela salah");
  }

  if (els.outPhoto.getAttribute("src") !== "/assets/weather/rain.png") {
    throw new Error("Foto halaman luar salah");
  }
});

Deno.test("cuaca tanpa file tidak merusak tampilan", async () => {
  const { art, els } = createHarness(() => false);

  await art.weather("snow");
  await tick();

  if (els.windowPhoto.hidden !== true || els.outPhoto.hidden !== true) {
    throw new Error("Foto cuaca harus tersembunyi");
  }
});
