import { nextWeatherId, WEATHER_DURATION_MS, weatherById } from "../data/weather.js";

export function createWeather({ doc, els, getState, t, onChange, isReducedMotion }) {
  let lastId = null;

  function current() {
    return weatherById(getState().weather.id);
  }

  function advance(now) {
    const state = getState();
    const weather = state.weather || { id: "spring", nextAt: now + WEATHER_DURATION_MS };

    if (!Number.isFinite(weather.nextAt) || weather.nextAt <= 0) {
      weather.nextAt = now + WEATHER_DURATION_MS;
    }

    let changed = false;
    let guard = 0;

    while (now >= weather.nextAt && guard < 40) {
      weather.id = nextWeatherId(weather.id);
      weather.nextAt += WEATHER_DURATION_MS;
      changed = true;
      guard += 1;
    }

    if (weather.nextAt < now) {
      weather.nextAt = now + WEATHER_DURATION_MS;
    }

    state.weather = weather;
    return changed;
  }

  /*
   * Partikel atmosfer.
   *
   * Tiap jenis punya bentuk dan gerak sendiri: hujan = garis miring, salju =
   * kristal berputar, daun = helai yang berayun, kelopak = kelopak sakura
   * yang jatuh berputar, dan panas = butiran debu yang melayang naik.
   */
  const PARTICLES = {
    rain: { count: 60, size: [2, 4], dur: [1.1, 1.8], drift: [8, 22] },
    snow: { count: 46, size: [4, 11], dur: [5.5, 11], drift: [26, 54] },
    leaf: { count: 20, size: [7, 13], dur: [6, 10], drift: [30, 70] },
    petal: { count: 18, size: [6, 11], dur: [6.5, 11], drift: [24, 58] },
    mote: { count: 22, size: [2, 5], dur: [9, 16], drift: [10, 30] },
  };

  function particle(container, kind, count, small) {
    if (!container) return;

    container.textContent = "";

    const reduced = isReducedMotion ? isReducedMotion() : false;
    const config = PARTICLES[kind] || PARTICLES.rain;
    const total = reduced ? Math.max(4, Math.round(config.count * 0.35)) : count || config.count;

    const fragment = doc.createDocumentFragment();

    for (let i = 0; i < total; i += 1) {
      const node = doc.createElement("span");
      const size = config.size[0] + Math.random() * (config.size[1] - config.size[0]);
      const depth = Math.random();

      node.className = `wx wx-${kind}${small ? " wx--small" : ""}`;
      node.style.setProperty("--left", (Math.random() * 104 - 2).toFixed(2) + "%");
      node.style.setProperty("--delay", (-Math.random() * 12).toFixed(2) + "s");
      node.style.setProperty(
        "--dur",
        (config.dur[0] + Math.random() * (config.dur[1] - config.dur[0])).toFixed(2) + "s",
      );
      node.style.setProperty("--size", (small ? size * 0.6 : size).toFixed(2) + "px");
      node.style.setProperty(
        "--drift",
        (Math.random() * config.drift[1] - config.drift[0]).toFixed(1) + "px",
      );
      node.style.setProperty("--hue", String(Math.floor(Math.random() * 40) + 15));
      node.style.setProperty("--depth", depth.toFixed(2));

      fragment.appendChild(node);
    }

    container.appendChild(fragment);
  }

  /*
   * Efek di tanah: genangan + riak saat hujan, salju menumpuk, daun kering
   * bertaburan saat gugur, dan bunga kecil saat semi.
   */
  function groundEffects(id) {
    const container = els.outGroundFx;

    if (!container) return;

    container.textContent = "";

    const items = [];

    if (id === "rain") {
      for (let i = 0; i < 5; i += 1) {
        items.push({
          className: "gf-puddle",
          left: 8 + Math.random() * 84,
          size: 18 + Math.random() * 26,
        });
      }
    } else if (id === "snow") {
      for (let i = 0; i < 4; i += 1) {
        items.push({
          className: "gf-snow",
          left: 4 + Math.random() * 90,
          size: 40 + Math.random() * 70,
        });
      }
    } else if (id === "autumn") {
      for (let i = 0; i < 12; i += 1) {
        items.push({
          className: "gf-leaf",
          left: Math.random() * 98,
          size: 6 + Math.random() * 6,
          hue: String(Math.floor(Math.random() * 40) + 15),
        });
      }
    } else if (id === "spring") {
      for (let i = 0; i < 14; i += 1) {
        items.push({
          className: "gf-flower",
          left: Math.random() * 98,
          size: 5 + Math.random() * 5,
          hue: String(Math.floor(Math.random() * 60) + 300),
        });
      }
    }

    const fragment = doc.createDocumentFragment();

    for (const item of items) {
      const node = doc.createElement("span");
      node.className = item.className;
      node.style.setProperty("--left", item.left.toFixed(2) + "%");
      node.style.setProperty("--size", item.size.toFixed(2) + "px");

      if (item.hue) node.style.setProperty("--hue", item.hue);

      fragment.appendChild(node);
    }

    container.appendChild(fragment);
  }

  function renderEffects(id) {
    if (els.weatherFx) {
      if (id === "rain") particle(els.weatherFx, "rain");
      else if (id === "snow") particle(els.weatherFx, "snow");
      else if (id === "autumn") particle(els.weatherFx, "leaf");
      else if (id === "spring") particle(els.weatherFx, "petal");
      else if (id === "hot") particle(els.weatherFx, "mote");
      else els.weatherFx.textContent = "";
    }

    if (els.windowFx) {
      if (id === "rain") particle(els.windowFx, "rain", 12, true);
      else if (id === "snow") particle(els.windowFx, "snow", 14, true);
      else if (id === "autumn") particle(els.windowFx, "leaf", 5, true);
      else if (id === "spring") particle(els.windowFx, "petal", 5, true);
      else els.windowFx.textContent = "";
    }

    groundEffects(id);
  }

  function apply() {
    const state = getState();
    const weather = weatherById(state.weather.id);
    const name = t(weather.nameKey);

    if (els.room) els.room.setAttribute("data-weather", weather.id);

    if (els.weatherIcon) {
      // Ikon vektor kalau elemen gambarnya ada, emoji sebagai cadangan.
      const image = els.weatherIcon.querySelector("img");

      if (weather.svg && image) {
        image.setAttribute("src", weather.svg);
      } else {
        els.weatherIcon.textContent = weather.icon;
      }
    }
    if (els.weatherLabel) els.weatherLabel.textContent = name;
    if (els.weatherPill) {
      els.weatherPill.setAttribute("data-weather", weather.id);
      els.weatherPill.setAttribute("aria-label", t("weather.aria", { name }));
      els.weatherPill.setAttribute("title", t("weather.aria", { name }));
    }

    if (lastId !== weather.id) {
      renderEffects(weather.id);
      lastId = weather.id;
    }
  }

  function refresh(options) {
    const now = Date.now();
    const previous = getState().weather.id;
    const changed = advance(now);
    apply();

    if (changed && options && options.notify && onChange) {
      onChange(getState().weather.id, previous);
    }

    return changed;
  }

  function setWeather(id) {
    const state = getState();
    const previous = state.weather.id;
    const next = weatherById(id);
    state.weather = { id: next.id, nextAt: Date.now() + WEATHER_DURATION_MS };
    apply();
    if (previous !== next.id && onChange) onChange(next.id, previous);
  }

  function timeLeft() {
    return Math.max(0, getState().weather.nextAt - Date.now());
  }

  apply();

  return { apply, refresh, setWeather, current, timeLeft };
}
