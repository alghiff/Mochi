/*
 * Regression test modul cuaca.
 *
 * Ikon cuaca memakai simbol SVG inline di dalam span. Fungsi apply() harus
 * mengganti atribut href pada <use>, bukan mengisi ulang span.
 */

import { createWeather } from "../src/systems/weather.js";

function createHarness() {
  const state = {
    weather: { id: "spring", nextAt: Date.now() + 600_000 },
  };

  const use = {
    attrs: { href: "#wx-spring" },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    getAttribute(key) {
      return key in this.attrs ? this.attrs[key] : null;
    },
  };

  const icon = {
    textContent: "",
    querySelector: (selector) => (selector === "use" ? use : null),
  };

  const els = {
    weatherIcon: icon,
    weatherLabel: { textContent: "" },
    weatherPill: {
      attrs: {},
      setAttribute(key, value) {
        this.attrs[key] = value;
      },
    },
    room: {
      attrs: {},
      setAttribute(key, value) {
        this.attrs[key] = value;
      },
    },
  };

  const doc = {
    createElement: () => ({
      style: { setProperty() {} },
      appendChild() {},
      classList: { add() {} },
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
  };

  const weather = createWeather({
    doc,
    els,
    getState: () => state,
    t: (key) => key,
    onChange: () => {},
    isReducedMotion: () => true,
  });

  return { weather, state, use, icon, els };
}

Deno.test("ikon cuaca diganti lewat atribut href", () => {
  const { weather, use } = createHarness();

  weather.setWeather("rain");

  if (use.getAttribute("href") !== "#wx-rain") {
    throw new Error(`Href ikon salah: ${use.getAttribute("href")}`);
  }
});

Deno.test("span ikon tidak dihapus isinya", () => {
  const { weather, icon } = createHarness();

  weather.setWeather("snow");

  if (icon.textContent !== "") {
    throw new Error(`Isi span ikon berubah: ${icon.textContent}`);
  }
});

Deno.test("label cuaca ikut berubah", () => {
  const { weather, els } = createHarness();

  weather.setWeather("hot");

  if (els.weatherLabel.textContent !== "weather.hot") {
    throw new Error(`Label salah: ${els.weatherLabel.textContent}`);
  }
});
