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

export function questById(id) {
  return QUESTS.find((quest) => quest.id === id) || null;
}
