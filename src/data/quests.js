export const QUESTS = [
  {
    id: "feed",
    icon: "🥣",
    badge: "/assets/svg/badge-feed.svg",
    target: 3,
    coins: 15,
    xp: 10,
  },
  {
    id: "bath",
    icon: "🫧",
    badge: "/assets/svg/badge-bath.svg",
    target: 1,
    coins: 10,
    xp: 6,
  },
  {
    id: "play",
    icon: "🐟",
    badge: "/assets/svg/badge-play.svg",
    target: 1,
    coins: 20,
    xp: 15,
  },
  {
    id: "pet",
    icon: "💗",
    badge: "/assets/svg/badge-pet.svg",
    target: 12,
    coins: 12,
    xp: 8,
  },
  {
    id: "butterfly",
    icon: "🦋",
    badge: "/assets/svg/badge-butterfly.svg",
    target: 5,
    coins: 18,
    xp: 10,
  },
  {
    id: "mpEmote",
    icon: "😺",
    badge: "/assets/svg/badge-emote.svg",
    target: 1,
    coins: 15,
    xp: 8,
  },
];

export const QUEST_IDS = QUESTS.map((quest) => quest.id);

/*
 * Misi mingguan memakai ID aksi yang sama dengan misi harian, jadi satu
 * interaksi (mis. memberi makan) ikut menambah progres keduanya.
 */
export const WEEKLY_QUESTS = [
  {
    id: "feed",
    icon: "🥣",
    target: 15,
    coins: 80,
    xp: 40,
  },
  {
    id: "bath",
    icon: "🫧",
    target: 5,
    coins: 60,
    xp: 30,
  },
  {
    id: "play",
    icon: "🐟",
    target: 5,
    coins: 90,
    xp: 50,
  },
  {
    id: "pet",
    icon: "💗",
    target: 60,
    coins: 70,
    xp: 35,
  },
  {
    id: "butterfly",
    icon: "🦋",
    target: 20,
    coins: 80,
    xp: 40,
  },
  {
    id: "mpEmote",
    icon: "😺",
    target: 5,
    coins: 60,
    xp: 30,
  },
  {
    id: "chat",
    icon: "💬",
    target: 10,
    coins: 50,
    xp: 25,
  },
];

export const WEEKLY_IDS = WEEKLY_QUESTS.map((quest) => quest.id);

export function questById(id) {
  return QUESTS.find((quest) => quest.id === id) || null;
}

export function weeklyById(id) {
  return WEEKLY_QUESTS.find((quest) => quest.id === id) || null;
}
