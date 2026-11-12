export const WEATHERS = [
  { id: "spring", icon: "🌸", nameKey: "weather.spring" },
  { id: "hot", icon: "☀️", nameKey: "weather.hot" },
  { id: "autumn", icon: "🍂", nameKey: "weather.autumn" },
  { id: "rain", icon: "🌧️", nameKey: "weather.rain" },
  { id: "snow", icon: "❄️", nameKey: "weather.snow" }
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
