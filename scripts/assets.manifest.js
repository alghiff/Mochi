/*
 * Manifest aset PNG.
 *
 * Setiap entri punya:
 *   file    - lokasi hasil di folder assets/
 *   prompt  - deskripsi gambar (bahasa Inggris, lebih baik untuk model)
 *   size    - ukuran gambar dalam piksel
 *   base    - (opsional) gambar dasar untuk mode edit, supaya hasilnya konsisten
 *   edit    - (opsional) instruksi edit kalau memakai base
 *
 * Prompt ditulis supaya gaya, sudut pandang, dan pencahayaan sama di semua
 * aset. Kalau asetnya gagal dibuat, file tidak ditulis dan game tetap jalan
 * dengan versi SVG/CSS yang sudah ada.
 */

export const CAT_STYLE =
  "cozy realistic digital painting of a fluffy domestic cat, soft studio lighting, " +
  "warm cream background, gentle shadows, painterly fur detail, full body sitting pose, " +
  "front facing, centered, full body visible, no text, no watermark";

export const ACCESSORY_STYLE =
  "single centered object, product photo of a cozy handmade item, soft studio lighting, " +
  "plain flat pastel background, no cat, no text, no watermark";

export const SCENERY_STYLE =
  "cozy painterly illustration of a small japanese style room at night, warm lamp light, " +
  "wooden floor, large window, plants and shelves, soft shadows, no cat, no text, no watermark";

export const FUR_COLORS = [
  { id: "cream", tone: "cream white fur" },
  { id: "ginger", tone: "orange ginger tabby fur" },
  { id: "grey", tone: "soft blue grey fur" },
  { id: "black", tone: "charcoal black fur" },
  { id: "brown", tone: "warm chocolate brown fur" },
  { id: "pink", tone: "pale pastel pink fur" },
  { id: "mint", tone: "pale mint green fur" },
  { id: "lavender", tone: "soft lavender fur" },
];

export const ACCESSORIES = [
  { id: "beanie", prompt: "a knitted orange beanie hat with a white pom pom" },
  { id: "scarf", prompt: "a mint green knitted scarf" },
  { id: "glasses", prompt: "round golden thin framed glasses" },
  { id: "bow", prompt: "a coral pink ribbon bow" },
  { id: "flowercrown", prompt: "a crown of small pink cherry blossoms" },
  { id: "sunhat", prompt: "a straw sun hat with an orange band" },
  { id: "earmuffs", prompt: "sky blue fluffy earmuffs" },
  { id: "leafcrown", prompt: "a wreath of orange and red autumn maple leaves" },
  { id: "crown", prompt: "a small golden crown with colored gems" },
  { id: "partyhat", prompt: "a purple cone party hat with a yellow pom pom" },
  { id: "bell", prompt: "a red collar with a small golden bell" },
  { id: "medal", prompt: "a purple ribbon with a golden star medal" },
  { id: "raincoat", prompt: "a yellow raincoat with buttons" },
  { id: "backpack", prompt: "a small lavender purple backpack" },
  { id: "headphones", prompt: "a pair of cute pastel headphones" },
  { id: "sunglasses", prompt: "a pair of stylish dark sunglasses" },
  { id: "mask", prompt: "a light blue surgical face mask" },
  { id: "tie", prompt: "a neat red necktie" },
  { id: "wings", prompt: "a pair of small butterfly wings" },
];

export const WEATHER_SCENES = [
  { id: "spring", prompt: "a japanese garden in spring with sakura blossoms and soft sunlight" },
  { id: "hot", prompt: "a sunny japanese garden in summer with bright golden sunlight" },
  { id: "autumn", prompt: "a japanese garden in autumn with red maple leaves falling" },
  { id: "rain", prompt: "a japanese garden on a rainy day with puddles and grey sky" },
  { id: "snow", prompt: "a japanese garden in winter covered with soft snow" },
];

export const SCENERY = [
  { id: "room", prompt: SCENERY_STYLE },
  { id: "garden", prompt: "a wide japanese garden with a stone path, pond and bamboo" },
];

/*
 * Daftar final aset yang digenerate.
 */
export function buildManifest() {
  const items = [];

  for (const fur of FUR_COLORS) {
    items.push({
      group: "cat",
      file: `assets/cat/${fur.id}.png`,
      size: 768,
      prompt: `${CAT_STYLE}, ${fur.tone}`,
    });
  }

  for (const acc of ACCESSORIES) {
    items.push({
      group: "accessory",
      file: `assets/accessories/${acc.id}.png`,
      size: 512,
      prompt: `${ACCESSORY_STYLE}, ${acc.prompt}`,
    });
  }

  for (const scene of WEATHER_SCENES) {
    items.push({
      group: "weather",
      file: `assets/weather/${scene.id}.png`,
      size: 1024,
      prompt: `${
        SCENERY_STYLE.replace(
          "a small japanese style room at night",
          "a japanese garden seen through a window",
        )
      }, ${scene.prompt}`,
    });
  }

  for (const scene of SCENERY) {
    items.push({
      group: "scenery",
      file: `assets/scenery/${scene.id}.png`,
      size: 1280,
      prompt: scene.prompt,
    });
  }

  return items;
}
