/*
 * slot: head | face | neck | body | back
 * svg: true berarti aksesorinya digambar langsung di SVG kucing.
 * season: hanya bisa dibeli saat cuaca tersebut aktif.
 */
export const ACCS = [
  { id: "beanie", nameKey: "acc.beanie", price: 20, icon: "🧢", slot: "head", svg: true },
  { id: "scarf", nameKey: "acc.scarf", price: 25, icon: "🧣", slot: "neck", svg: true },
  { id: "glasses", nameKey: "acc.glasses", price: 30, icon: "👓", slot: "face", svg: true },
  { id: "bow", nameKey: "acc.bow", price: 15, icon: "🎀", slot: "head", svg: true },

  {
    id: "flowercrown",
    nameKey: "acc.flowercrown",
    price: 35,
    icon: "🌸",
    slot: "head",
    season: "spring",
  },
  { id: "sunhat", nameKey: "acc.sunhat", price: 35, icon: "👒", slot: "head", season: "hot" },
  { id: "earmuffs", nameKey: "acc.earmuffs", price: 35, icon: "❄️", slot: "head", season: "snow" },
  {
    id: "leafcrown",
    nameKey: "acc.leafcrown",
    price: 35,
    icon: "🍁",
    slot: "head",
    season: "autumn",
  },
  { id: "raincoat", nameKey: "acc.raincoat", price: 40, icon: "🧥", slot: "body", season: "rain" },

  { id: "partyhat", nameKey: "acc.partyhat", price: 28, icon: "🎩", slot: "head" },
  { id: "crown", nameKey: "acc.crown", price: 70, icon: "👑", slot: "head" },
  { id: "headphones", nameKey: "acc.headphones", price: 32, icon: "🎧", slot: "head" },
  { id: "sunglasses", nameKey: "acc.sunglasses", price: 32, icon: "🕶️", slot: "face" },
  { id: "mask", nameKey: "acc.mask", price: 18, icon: "😷", slot: "face" },
  { id: "backpack", nameKey: "acc.backpack", price: 38, icon: "🎒", slot: "body" },
  { id: "bell", nameKey: "acc.bell", price: 22, icon: "🔔", slot: "neck" },
  { id: "tie", nameKey: "acc.tie", price: 26, icon: "👔", slot: "neck" },
  { id: "medal", nameKey: "acc.medal", price: 45, icon: "🏅", slot: "neck" },
  { id: "wings", nameKey: "acc.wings", price: 60, icon: "🦋", slot: "back" },
];

export function accById(id) {
  return ACCS.find((item) => item.id === id) || null;
}
