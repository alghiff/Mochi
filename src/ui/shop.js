import { ACCS, accById } from "../data/accessories.js";
import { FURS } from "../data/furs.js";
import { weatherById } from "../data/weather.js";

export function createShop({
  doc,
  els,
  getState,
  t,
  confirm,
  toast,
  sfx,
  spawnFx,
  addXp,
  save,
  render,
  sendMpState
}) {
  let currentTab = "fur";
  let busy = false;

  function weatherName() {
    const state = getState();
    return t(weatherById(state.weather.id).nameKey);
  }

  function itemsFor(tab) {
    if (tab === "fur") return FURS;
    if (tab === "season") return ACCS.filter((item) => Boolean(item.season));
    return ACCS.filter((item) => !item.season);
  }

  function ownedList(kind) {
    return kind === "fur" ? getState().ownedFur : getState().ownedAcc;
  }

  function switchTab(tab) {
    currentTab = tab === "acc" || tab === "season" ? tab : "fur";

    const tabs = doc.querySelectorAll(".tab");

    for (const button of tabs) {
      const selected = button.getAttribute("data-tab") === currentTab;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    }

    render();
  }

  function cardLabel(item, owned, equipped) {
    const name = t(item.nameKey);

    if (equipped) return `${name} (${t("shop.equippedTag")})`;
    if (owned) return `${name} (${t("shop.ownedTag")})`;
    if (item.season) return `${name} · ${t("shop.seasonLock", { name: t(weatherById(item.season).nameKey) })}`;
    return `${name} (${t("food.coins", { n: item.price })})`;
  }

  function render() {
    if (!els.shopGrid) return;

    const state = getState();
    els.shopGrid.textContent = "";

    if (els.shopCoins) els.shopCoins.textContent = String(state.coins);
    if (els.shopSeasonNow) {
      els.shopSeasonNow.textContent = t("shop.seasonNow", { name: weatherName() });
    }

    const list = itemsFor(currentTab);
    const owned = ownedList(currentTab === "fur" ? "fur" : "acc");

    for (const item of list) {
      const isOwned = owned.includes(item.id);
      const isEquipped =
        currentTab === "fur" ? state.fur === item.id : state.acc === item.id;
      const locked = Boolean(item.season) && item.season !== state.weather.id;

      const card = doc.createElement("button");
      card.type = "button";
      card.className =
        "shop-card" +
        (isOwned ? " is-owned" : "") +
        (isEquipped ? " is-equipped" : "") +
        (locked ? " is-locked" : "");
      card.setAttribute("aria-pressed", isEquipped ? "true" : "false");
      card.setAttribute("data-id", item.id);
      card.setAttribute("data-kind", currentTab === "fur" ? "fur" : "acc");
      card.setAttribute("aria-label", cardLabel(item, isOwned, isEquipped));

      const swatch = doc.createElement("span");
      swatch.className = "shop-swatch swatch-" + item.id;
      swatch.setAttribute("aria-hidden", "true");

      if (currentTab !== "fur") {
        swatch.textContent = item.icon;
      }

      const name = doc.createElement("span");
      name.className = "shop-name";
      name.textContent = t(item.nameKey);

      const price = doc.createElement("span");
      price.className = "shop-price";

      if (isEquipped) price.textContent = t("shop.equippedTag");
      else if (isOwned) price.textContent = t("shop.equip");
      else if (locked) {
        price.textContent = t("shop.seasonLock", {
          name: t(weatherById(item.season).nameKey)
        });
      } else {
        price.textContent = t("shop.buy", { n: item.price });
      }

      card.appendChild(swatch);
      card.appendChild(name);
      card.appendChild(price);

      if (locked) {
        const lock = doc.createElement("span");
        lock.className = "shop-lock";
        lock.setAttribute("aria-hidden", "true");
        lock.textContent = "🔒";
        card.appendChild(lock);
      }

      card.addEventListener("click", () => select(item));
      els.shopGrid.appendChild(card);
    }
  }

  async function select(item) {
    if (busy) return;

    const state = getState();
    const kind = currentTab === "fur" ? "fur" : "acc";
    const owned = ownedList(kind);
    const name = t(item.nameKey);

    if (item.season && item.season !== state.weather.id) {
      toast(t("shop.seasonalOnly", { name: t(weatherById(item.season).nameKey) }));
      sfx("error");
      return;
    }

    let justBought = false;

    if (!owned.includes(item.id)) {
      if (state.coins < item.price) {
        toast(t("shop.notEnough"));
        sfx("error");
        return;
      }

      busy = true;

      let ok = false;

      try {
        ok = await confirm({
          title: t("shop.confirmTitle", { name }),
          text: t("shop.confirmText", {
            price: item.price,
            left: Math.max(0, state.coins - item.price)
          }),
          okLabel: t("shop.confirmOk"),
          cancelLabel: t("shop.cancel")
        });
      } finally {
        busy = false;
      }

      if (!ok) return;

      if (state.coins < item.price) {
        toast(t("shop.notEnough"));
        sfx("error");
        return;
      }

      if (item.season && item.season !== state.weather.id) {
        toast(t("shop.seasonalOnly", { name: t(weatherById(item.season).nameKey) }));
        sfx("error");
        return;
      }

      state.coins -= item.price;
      owned.push(item.id);
      addXp(5);
      toast(t("shop.bought", { name }));
      spawnFx("✦", 5, "fx-star");
      sfx("buy");
      justBought = true;
    }

    if (kind === "fur") {
      state.fur = item.id;
      if (!justBought) {
        toast(t("shop.equippedToast", { name }));
        sfx("pet");
      }
    } else if (state.acc === item.id) {
      state.acc = null;
      toast(t("shop.removed", { name }));
      sfx("pet");
    } else {
      state.acc = item.id;
      if (!justBought) {
        toast(t("shop.equippedToast", { name }));
        sfx("pet");
      }
    }

    render();
    save();
    sendMpState();

    const refreshed = els.shopGrid.querySelector('[data-id="' + item.id + '"]');
    if (refreshed) {
      try {
        refreshed.focus();
      } catch {
        /* fokus opsional */
      }
    }
  }

  function bind() {
    const tabs = doc.querySelectorAll(".tab");

    for (const button of tabs) {
      button.addEventListener("click", () => switchTab(button.getAttribute("data-tab")));
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();

        const order = ["fur", "acc", "season"];
        const index = order.indexOf(currentTab);
        const next = order[(index + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];

        switchTab(next);

        const target = doc.querySelector('.tab[data-tab="' + next + '"]');
        if (target) target.focus();
      });
    }
  }

  bind();

  return {
    render,
    switchTab,
    open: () => {
      switchTab(currentTab);
    },
    getTab: () => currentTab,
    select
  };
}
