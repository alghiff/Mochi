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

  function particle(container, kind, count, small) {
    if (!container) return;

    container.textContent = "";
    const reduced = isReducedMotion ? isReducedMotion() : false;
    const total = reduced ? Math.max(4, Math.round(count * 0.35)) : count;

    const fragment = doc.createDocumentFragment();

    for (let i = 0; i < total; i += 1) {
      const node = doc.createElement("span");
      node.className = `wx wx-${kind}${small ? " wx--small" : ""}`;
      node.style.setProperty("--left", (Math.random() * 100).toFixed(2) + "%");
      node.style.setProperty("--delay", (-Math.random() * 8).toFixed(2) + "s");
      node.style.setProperty(
        "--dur",
        (small ? 3.2 : 3.8) + Math.random() * (small ? 3 : 4.2) + "s",
      );
      node.style.setProperty("--size", (small ? 3 : 4) + Math.random() * (small ? 4 : 7) + "px");
      node.style.setProperty("--drift", (Math.random() * 30 - 15).toFixed(1) + "px");
      node.style.setProperty("--hue", String(Math.floor(Math.random() * 40) + 15));
      fragment.appendChild(node);
    }

    container.appendChild(fragment);
  }

  function renderEffects(id) {
    if (els.weatherFx) {
      if (id === "rain") particle(els.weatherFx, "rain", 46, false);
      else if (id === "snow") particle(els.weatherFx, "snow", 42, false);
      else if (id === "autumn") particle(els.weatherFx, "leaf", 22, false);
      else if (id === "spring") particle(els.weatherFx, "petal", 20, false);
      else els.weatherFx.textContent = "";
    }

    if (els.windowFx) {
      if (id === "rain") particle(els.windowFx, "rain", 12, true);
      else if (id === "snow") particle(els.windowFx, "snow", 12, true);
      else if (id === "autumn") particle(els.windowFx, "leaf", 5, true);
      else if (id === "spring") particle(els.windowFx, "petal", 5, true);
      else els.windowFx.textContent = "";
    }
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
