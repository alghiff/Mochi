/*
 * Regression test modul cuaca.
 *
 * Ikon cuaca memakai gambar SVG di dalam span. Fungsi apply() harus
 * mengganti atribut src, bukan mengisi ulang span (textContent = "" akan
 * menghapus elemen gambarnya).
 */

import { createWeather } from "../src/systems/weather.js";

function createHarness() {
  const state = {
    weather: { id: "spring", nextAt: Date.now() + 600_000 },
  };

  const image = {
    attrs: { src: "/assets/svg/weather-spring.svg" },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    getAttribute(key) {
      return key in this.attrs ? this.attrs[key] : null;
    },
  };

  const icon = {
    textContent: "",
    querySelector: (selector) => (selector === "img" ? image : null),
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

  return { weather, state, image, icon, els };
}

Deno.test("ikon cuaca diganti lewat atribut src", () => {
  const { weather, image } = createHarness();

  weather.setWeather("rain");

  if (image.getAttribute("src") !== "/assets/svg/weather-rain.svg") {
    throw new Error(`Src ikon salah: ${image.getAttribute("src")}`);
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
