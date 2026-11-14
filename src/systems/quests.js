import { questById, QUESTS, WEEKLY_QUESTS, weeklyById } from "../data/quests.js";
import { formatClock, todayKey, weekKey } from "../core/util.js";

const PERIODS = {
  daily: {
    defs: QUESTS,
    byId: questById,
    stamp: "date",
    stampValue: todayKey,
  },
  weekly: {
    defs: WEEKLY_QUESTS,
    byId: weeklyById,
    stamp: "week",
    stampValue: weekKey,
  },
};

function emptyStore(period) {
  const info = PERIODS[period];
  return { [info.stamp]: info.stampValue(), progress: {}, claimed: {}, announced: {} };
}

/*
 * Misi harian dan mingguan.
 *
 * Keduanya disimpan terpisah di state. Aksi yang sama (mis. memberi makan)
 * menambah progres misi harian dan mingguan sekaligus. Reset harian terjadi
 * saat tanggal berganti; reset mingguan setiap Senin.
 */
export function createQuests({ doc, els, getState, t, save, onReward, sfx, toast }) {
  function ensurePeriods() {
    const state = getState();
    let dailyReset = false;
    let weeklyReset = false;

    if (!state.quests || typeof state.quests !== "object") {
      state.quests = emptyStore("daily");
      dailyReset = true;
    } else if (state.quests.date !== todayKey()) {
      state.quests = emptyStore("daily");
      dailyReset = true;
    }

    if (!state.weekly || typeof state.weekly !== "object") {
      state.weekly = emptyStore("weekly");
      weeklyReset = true;
    } else if (state.weekly.week !== weekKey()) {
      state.weekly = emptyStore("weekly");
      weeklyReset = true;
    }

    return { dailyReset, weeklyReset };
  }

  function ensureToday() {
    return ensurePeriods().dailyReset;
  }

  function storeFor(period) {
    const state = getState();
    return period === "weekly" ? state.weekly : state.quests;
  }

  function infoFor(period) {
    return PERIODS[period] || PERIODS.daily;
  }

  function progressOf(id, period = "daily") {
    ensurePeriods();

    const store = storeFor(period);
    const value = Number(store.progress[id]);
    return Number.isFinite(value) ? value : 0;
  }

  function isClaimed(id, period = "daily") {
    return Boolean(storeFor(period).claimed[id]);
  }

  function isComplete(id, period = "daily") {
    const quest = infoFor(period).byId(id);
    if (!quest) return false;
    return progressOf(id, period) >= quest.target;
  }

  function isClaimable(id, period = "daily") {
    return isComplete(id, period) && !isClaimed(id, period);
  }

  function readyCount() {
    ensurePeriods();

    let total = 0;

    for (const period of Object.keys(PERIODS)) {
      for (const quest of infoFor(period).defs) {
        if (isClaimable(quest.id, period)) total += 1;
      }
    }

    return total;
  }

  function add(id, amount) {
    ensurePeriods();

    const step = Math.max(1, Math.floor(Number(amount) || 1));
    let added = 0;
    let completed = false;

    for (const period of Object.keys(PERIODS)) {
      const info = infoFor(period);
      const quest = info.byId(id);

      if (!quest) continue;

      const store = storeFor(period);

      if (store.claimed[id]) continue;

      const before = progressOf(id, period);
      if (before >= quest.target) continue;

      const next = Math.min(quest.target, before + step);
      store.progress[id] = next;
      added += next - before;

      if (next >= quest.target && !store.announced[id]) {
        store.announced[id] = true;
        completed = true;
      }
    }

    if (added > 0) {
      if (completed) {
        if (sfx) sfx("quest");
        if (toast) toast(t("quest.ready"));
      }

      render();
      if (save) save();
    }

    return added;
  }

  function claim(id, period = "daily") {
    ensurePeriods();

    const info = infoFor(period);
    const quest = info.byId(id);

    if (!quest || !isClaimable(id, period)) return null;

    const store = storeFor(period);
    store.claimed[id] = true;

    if (onReward) onReward(quest.coins, quest.xp, period, quest);

    render();
    if (save) save();

    return quest;
  }

  function rewardText(quest) {
    return t("quest.reward", { coins: quest.coins, xp: quest.xp });
  }

  function renderList(list, defs, period) {
    if (!list) return;

    const store = storeFor(period);
    const namePrefix = period === "weekly" ? "quest.weekly." : "quest.name.";
    const descPrefix = period === "weekly" ? "quest.weekly.desc." : "quest.desc.";
    list.textContent = "";

    for (const quest of defs) {
      const progress = Math.min(quest.target, progressOf(quest.id, period));
      const claimed = Boolean(store.claimed[quest.id]);
      const claimable = !claimed && progress >= quest.target;
      const questName = t(namePrefix + quest.id);

      const item = doc.createElement("li");
      item.className = "quest-item" + (claimed ? " is-claimed" : claimable ? " is-claimable" : "");

      const icon = doc.createElement("span");
      icon.className = "quest-icon";
      icon.setAttribute("aria-hidden", "true");

      if (quest.badge) {
        const badge = doc.createElement("img");
        badge.src = quest.badge;
        badge.alt = "";
        badge.width = 34;
        badge.height = 34;
        badge.decoding = "async";
        badge.addEventListener(
          "error",
          () => {
            // Jangan tinggalkan ikon rusak kalau file badge gagal dimuat.
            badge.remove();
            icon.textContent = quest.icon;
          },
          { once: true },
        );
        icon.appendChild(badge);
      } else {
        icon.textContent = quest.icon;
      }

      const body = doc.createElement("div");
      body.className = "quest-body";

      const name = doc.createElement("p");
      name.className = "quest-name";
      name.textContent = questName;

      const desc = doc.createElement("p");
      desc.className = "quest-desc";
      desc.textContent = t(descPrefix + quest.id);

      const barWrap = doc.createElement("div");
      barWrap.className = "quest-bar";
      barWrap.setAttribute("role", "progressbar");
      barWrap.setAttribute("aria-valuemin", "0");
      barWrap.setAttribute("aria-valuemax", String(quest.target));
      barWrap.setAttribute("aria-valuenow", String(progress));
      barWrap.setAttribute("aria-label", questName);

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
        button.setAttribute("data-period", period);
        button.setAttribute("aria-label", t("quest.claimAria", { name: questName }));
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
      list.appendChild(item);
    }
  }

  function render() {
    ensurePeriods();

    renderList(els.questList, QUESTS, "daily");
    renderList(els.weeklyList, WEEKLY_QUESTS, "weekly");

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

  function formatLeft(ms) {
    const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));

    if (totalMinutes >= 1440) {
      return t("quest.timeDays", {
        d: Math.floor(totalMinutes / 1440),
        h: Math.floor((totalMinutes % 1440) / 60),
      });
    }

    if (totalMinutes >= 60) {
      return t("quest.timeHours", {
        h: Math.floor(totalMinutes / 60),
        m: totalMinutes % 60,
      });
    }

    return formatClock(ms);
  }

  function allClaimed(period) {
    const store = storeFor(period);
    return infoFor(period).defs.every((quest) => store.claimed[quest.id]);
  }

  function updateClock() {
    const now = new Date();

    if (els.questReset) {
      if (allClaimed("daily")) {
        els.questReset.textContent = t("quest.done");
      } else {
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
        els.questReset.textContent = t("quest.reset", {
          time: formatLeft(next.getTime() - now.getTime()),
        });
      }
    }

    if (els.weeklyReset) {
      if (allClaimed("weekly")) {
        els.weeklyReset.textContent = t("quest.weeklyDone");
      } else {
        const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const day = (next.getDay() + 6) % 7;
        next.setDate(next.getDate() - day + 7);

        els.weeklyReset.textContent = t("quest.weeklyReset", {
          time: formatLeft(next.getTime() - now.getTime()),
        });
      }
    }
  }

  function tick() {
    const reset = ensurePeriods();
    updateClock();

    if (reset.dailyReset || reset.weeklyReset) render();
  }

  return {
    add,
    claim,
    render,
    tick,
    ensureToday,
    ensurePeriods,
    readyCount,
    progressOf,
    isClaimed,
    isComplete,
    isClaimable,
  };
}
