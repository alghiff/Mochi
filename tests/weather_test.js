/*
 * Regression test modul cuaca.
 *
 * Ikon cuaca memakai simbol SVG inline di dalam span. Fungsi apply() harus
 * mengganti atribut href pada <use>, bukan mengisi ulang span.
 */

import { WEATHER_DURATION_MS } from "../src/data/weather.js";
import { createWeather } from "../src/systems/weather.js";

Deno.test("satu siklus cuaca berlangsung 5 menit", () => {
  if (WEATHER_DURATION_MS !== 5 * 60 * 1000) {
    throw new Error(`Durasi cuaca salah: ${WEATHER_DURATION_MS}`);
  }
});

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

  const changes = [];

  const weather = createWeather({
    doc,
    els,
    getState: () => state,
    t: (key) => key,
    onChange: (id, previous, meta) => changes.push({ id, previous, meta }),
    isReducedMotion: () => true,
  });

  return { weather, state, use, icon, els, changes };
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

Deno.test("refresh melaporkan siklus cuaca yang terlewat", () => {
  const { weather, state, changes } = createHarness();

  state.weather.nextAt = Date.now() - WEATHER_DURATION_MS * 2;

  const cycles = weather.refresh({ notify: true });

  if (cycles !== 3) throw new Error(`Siklus salah: ${cycles}`);
  if (changes.length !== 1) throw new Error(`Notifikasi salah: ${changes.length}`);
  if (!changes[0].meta.cycle || changes[0].meta.cycles !== 3) {
    throw new Error("Metadata siklus tidak lengkap");
  }
});
