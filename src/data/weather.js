/*
 * Cuaca game.
 *
 * `icon` dipakai sebagai fallback (emoji), `symbol` menunjuk simbol SVG inline
 * di index.html yang dipakai di pil cuaca.
 */
export const WEATHERS = [
  {
    id: "spring",
    icon: "🌸",
    symbol: "wx-spring",
    nameKey: "weather.spring",
  },
  {
    id: "hot",
    icon: "☀️",
    symbol: "wx-hot",
    nameKey: "weather.hot",
  },
  {
    id: "autumn",
    icon: "🍂",
    symbol: "wx-autumn",
    nameKey: "weather.autumn",
  },
  {
    id: "rain",
    icon: "🌧️",
    symbol: "wx-rain",
    nameKey: "weather.rain",
  },
  {
    id: "snow",
    icon: "❄️",
    symbol: "wx-snow",
    nameKey: "weather.snow",
  },
];

export const WEATHER_ORDER = ["spring", "hot", "autumn", "rain", "snow"];
export const WEATHER_DURATION_MS = 4 * 60 * 1000;

export function weatherById(id) {
  return WEATHERS.find((item) => item.id === id) || WEATHERS[0];
}

export function nextWeatherId(id) {
  const index = WEATHER_ORDER.indexOf(id);
  return WEATHER_ORDER[(index + 1) % WEATHER_ORDER.length];
}

export function isWeatherId(id) {
  return WEATHER_ORDER.includes(id);
}
