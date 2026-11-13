/*
 * Cuaca game.
 *
 * `icon` dipakai sebagai fallback (emoji), `svg` menunjuk file gambar vektor
 * di assets/svg/ yang dipakai di pil cuaca.
 */
export const WEATHERS = [
  {
    id: "spring",
    icon: "🌸",
    svg: "/assets/svg/weather-spring.svg",
    nameKey: "weather.spring",
  },
  {
    id: "hot",
    icon: "☀️",
    svg: "/assets/svg/weather-hot.svg",
    nameKey: "weather.hot",
  },
  {
    id: "autumn",
    icon: "🍂",
    svg: "/assets/svg/weather-autumn.svg",
    nameKey: "weather.autumn",
  },
  {
    id: "rain",
    icon: "🌧️",
    svg: "/assets/svg/weather-rain.svg",
    nameKey: "weather.rain",
  },
  {
    id: "snow",
    icon: "❄️",
    svg: "/assets/svg/weather-snow.svg",
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
