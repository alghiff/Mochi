import { QUESTS, questById } from "../data/quests.js";
import { formatClock, todayKey } from "../core/util.js";

/*
 * Misi harian.
 * Progres disimpan di state.quests dan direset otomatis saat tanggal berubah.
 */
export function createQuests({ doc, els, getState, t, save, onReward, sfx, toast }) {
  function ensureToday() {
    const state = getState();
    if (!state.quests || typeof state.quests !== "object") {
      state.quests = { date: todayKey(), progress: {}, claimed: {}, announced: {} };
      return true;
    }

    const today = todayKey();

    if (state.quests.date === today) return false;

    state.quests = { date: today, progress: {}, claimed: {}, announced: {} };
    return true;
  }

  function progressOf(id) {
    const state = getState();
    const value = Number(state.quests.progress[id]);
    return Number.isFinite(value) ? value : 0;
  }

  function isClaimed(id) {
    return Boolean(getState().quests.claimed[id]);
  }

  function isComplete(id) {
    const quest = questById(id);
    if (!quest) return false;
    return progressOf(id) >= quest.target;
  }

  function isClaimable(id) {
    return isComplete(id) && !isClaimed(id);
  }

  function readyCount() {
    ensureToday();
    return QUESTS.filter((quest) => isClaimable(quest.id)).length;
  }

  function add(id, amount) {
    ensureToday();

    const quest = questById(id);
    if (!quest) return 0;

    const state = getState();

    if (state.quests.claimed[id]) return 0;

    const before = progressOf(id);
    if (before >= quest.target) return 0;

    const step = Math.max(1, Math.floor(Number(amount) || 1));
    const next = Math.min(quest.target, before + step);
    state.quests.progress[id] = next;

    if (next >= quest.target && !state.quests.announced[id]) {
      state.quests.announced[id] = true;
      if (sfx) sfx("quest");
      if (toast) toast(t("quest.ready"));
    }

    render();
    if (save) save();

    return next - before;
  }

  function claim(id) {
    ensureToday();

    const quest = questById(id);
    if (!quest || !isClaimable(id)) return null;

    const state = getState();
    state.quests.claimed[id] = true;

    if (onReward) onReward(quest.coins, quest.xp);

    render();
    if (save) save();

    return quest;
  }

  function rewardText(quest) {
    return t("quest.reward", { coins: quest.coins, xp: quest.xp });
  }

  function render() {
    if (!els.questList) return;

    ensureToday();

    const state = getState();
    els.questList.textContent = "";

    for (const quest of QUESTS) {
      const progress = Math.min(quest.target, progressOf(quest.id));
      const claimed = Boolean(state.quests.claimed[quest.id]);
      const claimable = !claimed && progress >= quest.target;

      const item = doc.createElement("li");
      item.className =
        "quest-item" + (claimed ? " is-claimed" : claimable ? " is-claimable" : "");

      const icon = doc.createElement("span");
      icon.className = "quest-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = quest.icon;

      const body = doc.createElement("div");
      body.className = "quest-body";

      const name = doc.createElement("p");
      name.className = "quest-name";
      name.textContent = t("quest.name." + quest.id);

      const desc = doc.createElement("p");
      desc.className = "quest-desc";
      desc.textContent = t("quest.desc." + quest.id);

      const barWrap = doc.createElement("div");
      barWrap.className = "quest-bar";
      barWrap.setAttribute("role", "progressbar");
      barWrap.setAttribute("aria-valuemin", "0");
      barWrap.setAttribute("aria-valuemax", String(quest.target));
      barWrap.setAttribute("aria-valuenow", String(progress));
      barWrap.setAttribute("aria-label", t("quest.name." + quest.id));

      const bar = doc.createElement("i");
      bar.style.width = ((progress / quest.target) * 100).toFixed(1) + "%";
      barWrap.appendChild(bar);

      body.appendChild(name);
      body.appendChild(desc);
      body.appendChild(barWrap);

      const side = doc.createElement("div");
      side.className = "quest-side";

      const count = doc.createElement("span");
      count.className = "quest-progress";
      count.textContent = t("quest.progress", { n: progress, target: quest.target });
      side.appendChild(count);

      if (claimed) {
        const done = doc.createElement("span");
        done.className = "quest-done";
        done.textContent = t("quest.claimed");
        side.appendChild(done);
      } else if (claimable) {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "gbtn gbtn--primary gbtn--small quest-claim";
        button.setAttribute("data-claim", quest.id);
        button.setAttribute("aria-label", t("quest.claimAria", { name: t("quest.name." + quest.id) }));
        button.textContent = t("quest.claim");
        side.appendChild(button);
      } else {
        const reward = doc.createElement("span");
        reward.className = "quest-reward";
        reward.textContent = rewardText(quest);
        side.appendChild(reward);
      }

      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(side);
      els.questList.appendChild(item);
    }

    const ready = readyCount();

    if (els.questBadge) {
      els.questBadge.hidden = ready === 0;
      els.questBadge.textContent = ready > 9 ? "9+" : String(ready);
      els.questBadge.setAttribute("aria-label", t("quest.badge"));
    }

    if (els.questBtn) {
      els.questBtn.classList.toggle("has-ready", ready > 0);
    }

    updateClock();
  }

  function updateClock() {
    if (!els.questReset) return;

    const state = getState();

    if (QUESTS.every((quest) => state.quests.claimed[quest.id])) {
      els.questReset.textContent = t("quest.done");
      return;
    }

    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const left = next.getTime() - now.getTime();

    const hours = Math.floor(left / 3_600_000);
    const minutes = Math.floor((left % 3_600_000) / 60_000);

    els.questReset.textContent = t("quest.reset", {
      time: hours > 0 ? `${hours}j ${String(minutes).padStart(2, "0")}m` : formatClock(left)
    });
  }

  function tick() {
    const reset = ensureToday();
    updateClock();
    if (reset) render();
  }

  return {
    add,
    claim,
    render,
    tick,
    ensureToday,
    readyCount,
    progressOf,
    isClaimed,
    isComplete,
    isClaimable
  };
}
