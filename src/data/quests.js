export const QUESTS = [
  { id: "feed", icon: "🥣", target: 3, coins: 15, xp: 10 },
  { id: "bath", icon: "🫧", target: 1, coins: 10, xp: 6 },
  { id: "play", icon: "🐟", target: 1, coins: 20, xp: 15 },
  { id: "pet", icon: "💗", target: 12, coins: 12, xp: 8 },
  { id: "butterfly", icon: "🦋", target: 5, coins: 18, xp: 10 },
  { id: "mpEmote", icon: "😺", target: 1, coins: 15, xp: 8 }
];

export const QUEST_IDS = QUESTS.map((quest) => quest.id);

export function questById(id) {
  return QUESTS.find((quest) => quest.id === id) || null;
}

export function emptyQuestState() {
  return {
    date: "",
    progress: {},
    claimed: {},
    announced: {}
  };
}
