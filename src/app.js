import { collectDom } from "./core/dom.js";
import {
  DECAY,
  SLEEP_REGEN,
  addXpToState,
  applyOfflineProgress,
  freshState,
  loadCloudCode,
  loadState,
  sanitizeState,
  saveCloudCode,
  saveState
} from "./core/state.js";
import { clamp, nowMs, pick, sanitizeName, xpNeeded } from "./core/util.js";
import { LANGS, LANG_LABELS, translate } from "./data/i18n/index.js";
import { FOODS } from "./data/foods.js";
import { ACCS, accById } from "./data/accessories.js";
import { weatherById } from "./data/weather.js";
import { createFeedback } from "./ui/feedback.js";
import { createOverlays } from "./ui/overlay.js";
import { createAudio } from "./systems/audio.js";
import { createMic } from "./systems/mic.js";
import { createWeather } from "./systems/weather.js";
import { createQuests } from "./systems/quests.js";
import { createMultiplayer } from "./systems/multiplayer.js";
import { createCloud, normalizeCloudCode } from "./systems/cloud.js";
import { createShop } from "./ui/shop.js";
import { createMinigame } from "./game/minigame.js";

export function createApp({ win = globalThis.window, doc = globalThis.document } = {}) {
  const { els, statEls } = collectDom(doc);

  let state = loadState(win);
  let moodOverride = null;
  let moodTimer = 0;
  let tickTimer = 0;
  let saveTimer = 0;
  let butterflyTimer = 0;
  let lastPetAt = 0;
  let lastPetSave = 0;
  let lastReactAt = 0;
  let mic = null;
  let quests = null;
  let weather = null;
  let shop = null;
  let mp = null;
  let cloud = null;
  let minigame = null;
  let feedback = null;
  let overlays = null;
  let audio = null;

  const drag = {
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    moved: 0,
    awarded: 0,
    lastFx: 0
  };

  function t(key, params) {
    return translate(state.lang, key, params);
  }

  function save() {
    saveState(win, state);
  }

  function sendMpState() {
    if (mp) mp.sendState();
  }

  function addXp(amount) {
    const levels = addXpToState(state, amount);

    if (levels > 0) {
      if (audio) audio.sfx("level");
      if (feedback) {
        feedback.toast(t("speech.level", { level: state.level }));
        feedback.spawnFx("★", 5, "fx-star");
      }
    }

    return levels;
  }

  function applyMood() {
    if (!els.cat) return;

    let mood;

    if (state.sleeping) {
      mood = "sleep";
    } else if (moodOverride) {
      mood = moodOverride;
    } else {
      const lowest = Math.min(
        state.stats.hunger,
        state.stats.clean,
        state.stats.energy,
        state.stats.happy
      );

      if (lowest < 30) mood = "sad";
      else if (state.stats.happy >= 70) mood = "happy";
      else mood = "idle";
    }

    if (els.cat.getAttribute("data-mood") !== mood) {
      els.cat.setAttribute("data-mood", mood);
    }
  }

  function setMood(mood, duration) {
    moodOverride = mood;
    win.clearTimeout(moodTimer);
    moodTimer = 0;

    if (duration) {
      moodTimer = win.setTimeout(() => {
        moodOverride = null;
        applyMood();
      }, duration);
    }

    applyMood();
  }

  function renderStats() {
    for (const key of Object.keys(statEls)) {
      const el = statEls[key];
      if (!el) continue;

      const value = Math.round(state.stats[key]);

      if (el.value) el.value.textContent = String(value);
      if (el.bar) el.bar.style.width = value + "%";
      if (el.wrap) el.wrap.setAttribute("aria-valuenow", String(value));
      if (el.card) el.card.classList.toggle("is-low", value < 30);
    }

    if (els.cat) {
      els.cat.classList.toggle("is-dirty", state.stats.clean < 45);
    }

    applyMood();
  }

  function updateFeedPrices() {
    const buttons = doc.querySelectorAll("[data-food]");

    for (const button of buttons) {
      const food = FOODS[button.getAttribute("data-food")];
      if (!food) continue;

      const price = button.querySelector(".food-price");
      if (price) {
        price.textContent =
          food.price === 0 ? t("food.free") : t("food.coins", { n: food.price });
      }

      button.classList.toggle("is-unaffordable", food.price > state.coins);
    }
  }

  function updateHint() {
    if (!els.hint) return;

    if (mp && mp.playerCount() > 0) els.hint.textContent = t("hint.mp");
    else if (state.scene === "outside") els.hint.textContent = t("hint.outside");
    else els.hint.textContent = t("hint.pet");
  }

  function render() {
    if (els.petName) els.petName.textContent = state.name;
    if (els.level) els.level.textContent = String(state.level);
    if (els.coins) els.coins.textContent = String(state.coins);

    if (els.xpFill) {
      const need = xpNeeded(state.level);
      const percent = need > 0 ? (state.xp / need) * 100 : 0;
      els.xpFill.style.width = clamp(percent, 0, 100).toFixed(1) + "%";
    }

    if (els.cat) {
      const acc = accById(state.acc);

      els.cat.setAttribute("data-fur", state.fur);
      els.cat.setAttribute("data-acc", state.acc || "");
      els.cat.setAttribute("data-acc-slot", acc ? acc.slot : "");

      if (els.catAccEmoji) {
        els.catAccEmoji.textContent = acc && !acc.svg ? acc.icon : "";
      }
    }

    if (els.room) {
      els.room.setAttribute("data-scene", state.scene);
      els.room.classList.toggle("is-night", state.sleeping);
    }

    if (els.catWrap) {
      els.catWrap.classList.toggle("is-sleeping", state.sleeping);
      els.catWrap.setAttribute("aria-label", t("cat.petAria", { name: state.name }));
    }

    if (els.sleepBtn) {
      els.sleepBtn.setAttribute("aria-pressed", state.sleeping ? "true" : "false");
    }

    if (els.sleepLabel) {
      els.sleepLabel.textContent = state.sleeping ? t("dock.wake") : t("dock.sleep");
    }

    if (els.outsideBtn) {
      const outside = state.scene === "outside";
      els.outsideBtn.setAttribute("aria-pressed", outside ? "true" : "false");
      els.outsideBtn.setAttribute("aria-label", outside ? t("dock.inside") : t("dock.outside"));
    }

    if (els.outsideLabel) {
      els.outsideLabel.textContent = state.scene === "outside" ? t("dock.inside") : t("dock.outside");
    }

    if (els.soundSwitch) els.soundSwitch.setAttribute("aria-pressed", state.sound ? "true" : "false");
    if (els.musicSwitch) els.musicSwitch.setAttribute("aria-pressed", state.music ? "true" : "false");

    if (els.musicVol) {
      els.musicVol.value = String(Math.round(clamp(state.musicVol, 0, 1) * 100));
    }

    const langButtons = doc.querySelectorAll(".lang-btn");

    for (const button of langButtons) {
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("data-lang") === state.lang ? "true" : "false"
      );
    }

    if (els.feedHunger) els.feedHunger.textContent = String(Math.round(state.stats.hunger));
    if (els.feedCoins) els.feedCoins.textContent = String(state.coins);
    if (els.shopCoins) els.shopCoins.textContent = String(state.coins);

    renderStats();
    updateFeedPrices();
    updateHint();
    updateMicUi();

    if (quests) quests.render();
    if (weather) weather.apply();
    if (mp) mp.render();

    if (shop && els.styleOverlay && !els.styleOverlay.hidden) shop.render();
  }

  function applyLanguage() {
    doc.documentElement.lang = state.lang;

    for (const node of doc.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.getAttribute("data-i18n"));
    }

    for (const node of doc.querySelectorAll("[data-i18n-aria]")) {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria")));
    }

    for (const node of doc.querySelectorAll("[data-i18n-placeholder]")) {
      node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
    }

    render();
  }

  /* ---------- Scene & kupu-kupu ---------- */

  function clearButterflies() {
    if (els.butterflies) els.butterflies.textContent = "";
  }

  function makeButterfly() {
    if (!els.butterflies || state.scene !== "outside" || state.sleeping) return;
    if (els.butterflies.children.length >= 4) return;

    const button = doc.createElement("button");
    button.type = "button";
    button.className = "butterfly";
    button.setAttribute("aria-label", t("outdoor.layerAria"));
    button.style.setProperty("--left", (8 + Math.random() * 80).toFixed(1) + "%");
    button.style.setProperty("--top", (22 + Math.random() * 52).toFixed(1) + "%");
    button.style.setProperty("--dur", (7 + Math.random() * 5).toFixed(1) + "s");
    button.style.setProperty("--drift", (Math.random() * 40 - 20).toFixed(1) + "px");
    button.style.setProperty("--hue", String(Math.floor(Math.random() * 360)));

    const wings = doc.createElement("span");
    wings.className = "butterfly-wings";
    wings.setAttribute("aria-hidden", "true");

    button.appendChild(wings);

    button.addEventListener("click", () => {
      if (state.scene !== "outside") return;

      state.coins = Math.min(999999, state.coins + 1);
      state.stats.happy = clamp(state.stats.happy + 2, 0, 100);
      addXp(1);

      if (feedback) {
        feedback.spawnFx("✨", 4, "fx-star");
        feedback.say(t("speech.butterfly"));
      }
      if (audio) audio.sfx("butterfly");

      button.remove();
      if (quests) quests.add("butterfly");
      render();
      save();
      scheduleButterfly();
    });

    els.butterflies.appendChild(button);
  }

  function scheduleButterfly() {
    win.clearTimeout(butterflyTimer);
    butterflyTimer = win.setTimeout(() => {
      makeButterfly();
      scheduleButterfly();
    }, 4200 + Math.random() * 2600);
  }

  function setScene(scene, silent) {
    state.scene = scene === "outside" ? "outside" : "inside";

    if (state.scene === "inside") {
      clearButterflies();
      win.clearTimeout(butterflyTimer);
    } else {
      clearButterflies();
      makeButterfly();
      makeButterfly();
      scheduleButterfly();
    }

    render();
    save();
    sendMpState();

    if (!silent) {
      if (feedback) {
        feedback.say(t(state.scene === "outside" ? "speech.outside" : "speech.inside"));
      }
      if (audio) audio.sfx("pet");
    }
  }

  function toggleScene() {
    if (state.sleeping) wakeUp(true);
    setScene(state.scene === "outside" ? "inside" : "outside");
  }

  /* ---------- Aksi ---------- */

  function wakeUp(silent) {
    if (!state.sleeping) return;

    state.sleeping = false;
    moodOverride = null;
    win.clearTimeout(moodTimer);

    render();
    sendMpState();

    if (!silent) {
      if (feedback) feedback.say(t("speech.wake"));
      if (audio) audio.sfx("wake");
    }

    save();
  }

  function feed(foodId) {
    const food = FOODS[foodId];
    if (!food) return;

    if (state.sleeping) wakeUp(true);

    if (food.price > state.coins) {
      if (feedback) feedback.toast(t("toast.notEnough"));
      if (audio) audio.sfx("error");
      return;
    }

    if (state.stats.hunger >= 98) {
      if (feedback) feedback.toast(t("toast.full"));
      if (audio) audio.sfx("error");
      return;
    }

    state.coins -= food.price;

    for (const key of Object.keys(food.stats)) {
      state.stats[key] = clamp(state.stats[key] + food.stats[key], 0, 100);
    }

    addXp(food.xp);
    setMood("eat", 1800);

    if (feedback) {
      feedback.spawnFx(food.icon, 5);
      feedback.say(t(food.speech));
    }
    if (audio) audio.sfx("eat");

    if (quests) quests.add("feed");

    overlays.close(els.feedOverlay);
    render();
    save();
    sendMpState();
  }

  function bath() {
    if (state.sleeping) wakeUp(true);

    if (state.stats.clean >= 98) {
      if (feedback) feedback.toast(t("toast.clean"));
      if (audio) audio.sfx("error");
      return;
    }

    state.stats.clean = clamp(state.stats.clean + 42, 0, 100);
    state.stats.happy = clamp(state.stats.happy + 4, 0, 100);
    state.stats.energy = clamp(state.stats.energy - 4, 0, 100);

    addXp(6);
    setMood("bath", 2200);

    if (feedback) {
      feedback.spawnBubbles();
      feedback.say(t("speech.bath"));
    }
    if (audio) audio.sfx("bath");

    if (quests) quests.add("bath");

    render();
    save();
    sendMpState();
  }

  function sleepToggle() {
    state.sleeping = !state.sleeping;
    moodOverride = null;
    win.clearTimeout(moodTimer);

    if (state.sleeping) {
      if (feedback) {
        feedback.say(t("speech.sleep"));
        feedback.toast(t("toast.sleep"));
        feedback.spawnFx("z", 3, "fx-note");
      }
      if (audio) audio.sfx("sleep");
      clearButterflies();
    } else {
      if (feedback) feedback.say(t("speech.wake"));
      if (audio) audio.sfx("wake");
      setMood("happy", 1400);

      if (state.scene === "outside") {
        makeButterfly();
        scheduleButterfly();
      }
    }

    render();
    save();
    sendMpState();
  }

  function awardPet(force) {
    if (state.sleeping) {
      if (feedback) feedback.toast(t("toast.sleeping"));
      return false;
    }

    const now = Date.now();
    if (!force && now - lastPetAt < 300) return false;

    lastPetAt = now;
    drag.awarded += 1;

    state.stats.happy = clamp(state.stats.happy + 1.5, 0, 100);
    addXp(1);
    setMood("happy", 1400);

    if (feedback) {
      feedback.spawnFx("♥", force ? 4 : 2);

      if (drag.awarded === 1) feedback.say(t("speech.petStart"));
      else if (drag.awarded % 5 === 0) feedback.say(t("speech.petDrag"));
    }

    if (audio && (drag.awarded === 1 || Math.random() < 0.35)) audio.sfx("pet");

    if (quests) quests.add("pet");

    renderStats();

    if (now - lastPetSave > 1500) {
      save();
      lastPetSave = now;
    }

    return true;
  }

  function disturbCat() {
    if (state.sleeping) {
      if (feedback) feedback.toast(t("toast.sleeping"));
      return;
    }

    state.stats.happy = clamp(state.stats.happy - 2, 0, 100);

    setMood("annoyed", 2200);

    if (feedback) {
      feedback.say(t("speech.disturb"));
      feedback.spawnFx("!", 3, "fx-star");
    }
    if (audio) audio.sfx("annoyed");

    renderStats();
    save();
    sendMpState();
  }

  /* ---------- Petting: tekan + geser ---------- */

  function resetDrag() {
    drag.active = false;

    if (els.cat) {
      els.cat.classList.remove("is-petting");
      els.cat.style.setProperty("--pet-x", "0px");
      els.cat.style.setProperty("--pet-y", "0px");
    }

    if (els.catWrap && typeof els.catWrap.releasePointerCapture === "function" && drag.id != null) {
      try {
        els.catWrap.releasePointerCapture(drag.id);
      } catch {
        /* pointer capture opsional */
      }
    }

    drag.id = null;
  }

  function onCatPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    if (state.sleeping) {
      if (feedback) feedback.toast(t("toast.sleeping"));
      return;
    }

    drag.active = true;
    drag.id = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.moved = 0;
    drag.awarded = 0;

    if (els.cat) els.cat.classList.add("is-petting");

    if (els.catWrap && typeof els.catWrap.setPointerCapture === "function") {
      try {
        els.catWrap.setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture opsional */
      }
    }
  }

  function onCatPointerMove(event) {
    if (!drag.active || event.pointerId !== drag.id) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.moved = Math.max(drag.moved, Math.sqrt(dx * dx + dy * dy));

    if (els.cat && drag.moved > 8) {
      els.cat.style.setProperty("--pet-x", clamp(dx * 0.12, -10, 10).toFixed(1) + "px");
      els.cat.style.setProperty("--pet-y", clamp(dy * 0.1, -8, 8).toFixed(1) + "px");
      awardPet(false);
    }
  }

  function onCatPointerUp(event) {
    if (!drag.active || event.pointerId !== drag.id) return;

    const moved = drag.moved;
    const awarded = drag.awarded;
    resetDrag();

    if (moved < 10) {
      disturbCat();
    } else if (awarded === 0) {
      awardPet(true);
    }
  }

  function onCatPointerCancel(event) {
    if (!drag.active || event.pointerId !== drag.id) return;
    resetDrag();
  }

  /* ---------- Overlay ---------- */

  function openFeed() {
    if (state.sleeping) wakeUp(true);
    render();
    overlays.open(els.feedOverlay);
  }

  function openStyle() {
    if (shop) shop.open();
    overlays.open(els.styleOverlay);
  }

  function updateCloudUi() {
    if (!els.cloudCode) return;

    const stored = normalizeCloudCode(loadCloudCode(win));

    if (!els.cloudCode.value) els.cloudCode.value = stored;

    if (els.cloudCopy) {
      els.cloudCopy.disabled = !normalizeCloudCode(els.cloudCode.value);
    }

    if (els.cloudStatus && !els.cloudStatus.textContent) {
      els.cloudStatus.textContent = t("cloud.hint");
    }
  }

  function openSettings() {
    if (els.nameInput) els.nameInput.value = state.name;
    updateCloudUi();
    render();
    overlays.open(els.settingsOverlay);
  }

  function openQuests() {
    if (quests) quests.render();
    overlays.open(els.questOverlay);
  }

  function openMp() {
    if (mp) mp.open();
    overlays.open(els.mpOverlay);
  }

  /* ---------- Pengaturan ---------- */

  async function requestReset() {
    if (!overlays) return;

    const ok = await overlays.confirm({
      title: t("settings.reset"),
      text: t("settings.resetDesc"),
      okLabel: t("settings.reset"),
      cancelLabel: t("common.cancel"),
      danger: true
    });

    if (!ok) return;

    const keep = {
      lang: state.lang,
      sound: state.sound,
      music: state.music,
      musicVol: state.musicVol
    };

    state = freshState();
    Object.assign(state, keep);

    moodOverride = null;
    win.clearTimeout(moodTimer);

    overlays.close(els.settingsOverlay);
    applyLanguage();
    save();

    if (feedback) feedback.toast(t("toast.resetDone"));
    if (feedback) feedback.say(t("speech.reset", { name: state.name }));
    if (audio) audio.sfx("pet");

    sendMpState();
  }

  function saveName() {
    if (!els.nameInput) return;

    const name = sanitizeName(els.nameInput.value);
    state.name = name;
    els.nameInput.value = name;

    render();
    save();
    sendMpState();

    if (feedback) {
      feedback.toast(t("toast.nameSaved", { name }));
      feedback.say(t("speech.greet", { name }));
    }
    if (audio) audio.sfx("pet");
  }

  function toggleSound() {
    state.sound = !state.sound;

    render();
    save();

    if (state.sound && audio) audio.sfx("pet");
    if (feedback) feedback.toast(t(state.sound ? "settings.soundOn" : "settings.soundOff"));
  }

  function toggleMusic() {
    state.music = !state.music;

    if (audio) {
      if (state.music) audio.startMusic();
      else audio.stopMusic();
    }

    render();
    save();

    if (feedback) feedback.toast(t(state.music ? "settings.musicOn" : "settings.musicOff"));
  }

  function setMusicVolume(value) {
    state.musicVol = clamp(Number(value) / 100, 0, 1);
    if (audio) audio.updateMusicVolume();
    save();
  }

  function setLanguage(lang) {
    if (!LANGS.includes(lang) || lang === state.lang) return;

    state.lang = lang;
    applyLanguage();
    save();

    if (feedback) feedback.toast(t("settings.lang") + ": " + LANG_LABELS[lang]);
    if (audio) audio.sfx("pet");
  }

  /* ---------- Mikrofon ---------- */

  function updateMicUi(active, key) {
    if (!mic) return;

    const isActive = active === undefined ? mic.isActive() : active;
    const statusKey = key || mic.statusKey();

    if (els.micSwitch) els.micSwitch.setAttribute("aria-pressed", isActive ? "true" : "false");
    if (els.micStatus) els.micStatus.textContent = t(statusKey);
    if (els.micBadge) els.micBadge.hidden = !isActive;
  }

  function toggleMic() {
    if (!mic) return;

    mic.toggle().then((result) => {
      if (!feedback) return;

      if (result.ok) feedback.toast(t("toast.micOn"));
      else if (result.reason === "denied" || result.reason === "unsupported") {
        feedback.toast(t("toast.micDenied"));
      } else {
        feedback.toast(t("toast.micOff"));
      }
    });
  }

  /* ---------- Cloud ---------- */

  function cloudErrorMessage(error) {
    const code = error && error.message ? error.message : "";

    if (code === "not_found") return t("cloud.notFound");
    if (code === "no_server") return t("cloud.noServer");
    return t("cloud.error");
  }

  function setCloudCode(code) {
    const normalized = normalizeCloudCode(code);

    saveCloudCode(win, normalized);
    if (els.cloudCode) els.cloudCode.value = normalized;
    if (els.cloudCopy) els.cloudCopy.disabled = !normalized;
  }

  async function cloudCreate() {
    if (!cloud || !cloud.available()) {
      if (feedback) feedback.toast(t("cloud.noServer"));
      return;
    }

    try {
      const data = await cloud.create();

      if (!data || !data.code) throw new Error("cloud_error");

      setCloudCode(data.code);
      if (els.cloudStatus) els.cloudStatus.textContent = t("cloud.hint");
      if (feedback) feedback.toast(t("cloud.created", { code: data.code }));
      if (audio) audio.sfx("cloud");
    } catch (error) {
      if (feedback) feedback.toast(cloudErrorMessage(error));
      if (audio) audio.sfx("error");
    }
  }

  function currentCloudCode() {
    return normalizeCloudCode(els.cloudCode ? els.cloudCode.value : loadCloudCode(win));
  }

  async function cloudUpload() {
    if (!cloud || !cloud.available()) {
      if (feedback) feedback.toast(t("cloud.noServer"));
      return;
    }

    const code = currentCloudCode();

    if (!code) {
      if (feedback) feedback.toast(t("cloud.needCode"));
      return;
    }

    try {
      await cloud.save(code, state);

      setCloudCode(code);
      if (els.cloudStatus) els.cloudStatus.textContent = t("cloud.hint");
      if (feedback) feedback.toast(t("cloud.uploaded"));
      if (audio) audio.sfx("cloud");
    } catch (error) {
      if (feedback) feedback.toast(cloudErrorMessage(error));
      if (audio) audio.sfx("error");
    }
  }

  async function cloudLoad() {
    if (!cloud || !cloud.available()) {
      if (feedback) feedback.toast(t("cloud.noServer"));
      return;
    }

    const code = currentCloudCode();

    if (!code) {
      if (feedback) feedback.toast(t("cloud.needCode"));
      return;
    }

    const ok = await overlays.confirm({
      title: t("cloud.confirmTitle"),
      text: t("cloud.confirmLoad"),
      okLabel: t("cloud.overwrite"),
      cancelLabel: t("common.cancel"),
      danger: true
    });

    if (!ok) return;

    try {
      const data = await cloud.load(code);

      if (!data || !data.state) throw new Error("not_found");

      state = sanitizeState(data.state);
      setCloudCode(code);

      overlays.close(els.settingsOverlay);
      applyLanguage();
      save();

      if (feedback) feedback.toast(t("cloud.loaded"));
      if (audio) audio.sfx("cloud");
      sendMpState();
    } catch (error) {
      if (feedback) feedback.toast(cloudErrorMessage(error));
      if (audio) audio.sfx("error");
    }
  }

  function cloudCopy() {
    const code = currentCloudCode();
    if (!code) return;

    const done = () => {
      if (feedback) feedback.toast(t("cloud.copied"));
    };

    if (win.navigator.clipboard && typeof win.navigator.clipboard.writeText === "function") {
      win.navigator.clipboard.writeText(code).then(done).catch(done);
    } else {
      done();
    }
  }

  /* ---------- Tick & reaksi ---------- */

  function maybeReact() {
    const now = Date.now();
    if (now - lastReactAt < 45_000) return;

    let key = null;

    if (state.stats.hunger < 22) key = "speech.hungry";
    else if (state.stats.clean < 22) key = "speech.dirty";
    else if (state.stats.happy < 22) key = "speech.bored";
    else if (state.stats.energy < 18) key = "speech.sleepy";

    if (key) {
      lastReactAt = now;
      if (feedback) feedback.say(t(key));
    }
  }

  function tick() {
    if (weather) weather.refresh({ notify: true });
    if (quests) quests.tick();

    if (overlays && overlays.isPaused()) return;

    if (state.sleeping) {
      state.stats.energy = clamp(state.stats.energy + SLEEP_REGEN, 0, 100);
      state.stats.hunger = clamp(state.stats.hunger - 0.012, 0, 100);
      state.stats.clean = clamp(state.stats.clean - 0.008, 0, 100);
      state.stats.happy = clamp(state.stats.happy - 0.006, 0, 100);
    } else {
      state.stats.hunger = clamp(state.stats.hunger - DECAY.hunger, 0, 100);
      state.stats.clean = clamp(state.stats.clean - DECAY.clean, 0, 100);
      state.stats.energy = clamp(state.stats.energy - DECAY.energy, 0, 100);
      state.stats.happy = clamp(state.stats.happy - DECAY.happy, 0, 100);
    }

    renderStats();
    maybeReact();
  }

  /* ---------- Event ---------- */

  function trapFocus(event, overlay) {
    overlays.trapFocus(event, overlay);
  }

  function unlockAudio() {
    if (state.music && audio) audio.startMusic();
  }

  function bindEvents() {
    for (const button of doc.querySelectorAll(".dock-btn")) {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-action");

        if (action === "feed") openFeed();
        else if (action === "bath") bath();
        else if (action === "play") {
          if (minigame) minigame.open();
        } else if (action === "sleep") sleepToggle();
        else if (action === "style") openStyle();
        else if (action === "outside") toggleScene();
      });
    }

    if (els.catWrap) {
      els.catWrap.addEventListener("pointerdown", onCatPointerDown);
      els.catWrap.addEventListener("pointermove", onCatPointerMove);
      els.catWrap.addEventListener("pointerup", onCatPointerUp);
      els.catWrap.addEventListener("pointercancel", onCatPointerCancel);

      els.catWrap.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          awardPet(true);
        }
      });
    }

    for (const button of doc.querySelectorAll("[data-food]")) {
      button.addEventListener("click", () => feed(button.getAttribute("data-food")));
    }

    if (els.soundSwitch) els.soundSwitch.addEventListener("click", toggleSound);
    if (els.musicSwitch) els.musicSwitch.addEventListener("click", toggleMusic);

    if (els.musicVol) {
      els.musicVol.addEventListener("input", () => setMusicVolume(els.musicVol.value));
    }

    if (els.micSwitch) els.micSwitch.addEventListener("click", toggleMic);
    if (els.settingsBtn) els.settingsBtn.addEventListener("click", openSettings);
    if (els.multiplayerBtn) els.multiplayerBtn.addEventListener("click", openMp);
    if (els.openMp) els.openMp.addEventListener("click", openMp);
    if (els.questBtn) els.questBtn.addEventListener("click", openQuests);
    if (els.questClose) els.questClose.addEventListener("click", () => overlays.close(els.questOverlay));

    if (els.saveName) els.saveName.addEventListener("click", saveName);

    if (els.nameInput) {
      els.nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveName();
        }
      });
    }

    if (els.resetBtn) els.resetBtn.addEventListener("click", requestReset);

    for (const button of doc.querySelectorAll(".lang-btn")) {
      button.addEventListener("click", () => setLanguage(button.getAttribute("data-lang")));
    }

    if (els.cloudCreate) els.cloudCreate.addEventListener("click", cloudCreate);
    if (els.cloudUpload) els.cloudUpload.addEventListener("click", cloudUpload);
    if (els.cloudLoad) els.cloudLoad.addEventListener("click", cloudLoad);
    if (els.cloudCopy) els.cloudCopy.addEventListener("click", cloudCopy);

    if (els.cloudCode) {
      els.cloudCode.addEventListener("input", () => {
        const normalized = normalizeCloudCode(els.cloudCode.value);
        if (els.cloudCode.value !== normalized) els.cloudCode.value = normalized;
        if (els.cloudCopy) els.cloudCopy.disabled = !normalized;
      });
    }

    if (els.mpCreate) els.mpCreate.addEventListener("click", () => mp.createRoom());
    if (els.mpJoin) els.mpJoin.addEventListener("click", () => mp.joinRoom());

    if (els.mpCode) {
      els.mpCode.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          mp.joinRoom();
        }
      });

      els.mpCode.addEventListener("input", () => {
        els.mpCode.value = els.mpCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
      });
    }

    if (els.mpCopy) els.mpCopy.addEventListener("click", () => mp.copyCode());
    if (els.mpLeave) els.mpLeave.addEventListener("click", () => mp.leaveRoom());

    if (els.mpEmotes) {
      for (const button of els.mpEmotes.querySelectorAll("[data-emote]")) {
        button.addEventListener("click", () => mp.sendEmote(button.getAttribute("data-emote")));
      }
    }

    if (els.questList) {
      els.questList.addEventListener("click", (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return;

        const button = target.closest("[data-claim]");
        if (!button) return;

        if (quests) quests.claim(button.getAttribute("data-claim"));
      });
    }

    if (els.mgStart) els.mgStart.addEventListener("click", () => minigame.start());
    if (els.mgAgain) els.mgAgain.addEventListener("click", () => minigame.start());
    if (els.mgDone) els.mgDone.addEventListener("click", () => minigame.close());
    if (els.mgClose) els.mgClose.addEventListener("click", () => minigame.close());

    if (els.weatherPill) {
      els.weatherPill.addEventListener("click", () => {
        const name = t(weatherById(state.weather.id).nameKey);
        if (feedback) feedback.toast(t("weather.aria", { name }));
      });
    }

    doc.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      const closer = target.closest("[data-close]");
      if (!closer) return;

      const overlay = closer.closest(".overlay");
      if (!overlay) return;

      if (overlay === els.minigame) minigame.close();
      else overlays.close(overlay);
    });

    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (els.minigame && !els.minigame.hidden) {
          event.preventDefault();
          minigame.close();
          return;
        }

        const open = overlays.list.find((overlay) => !overlay.hidden);
        if (open) {
          event.preventDefault();
          overlays.closeTop();
        }
        return;
      }

      if (event.key === "Tab") {
        const open = overlays.list.find((overlay) => !overlay.hidden);
        if (open) trapFocus(event, open);
      }
    });

    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) save();
      else overlays.updatePause();
    });

    win.addEventListener("beforeunload", () => {
      save();
      if (mp) mp.destroy();
    });

    win.addEventListener("pagehide", () => {
      save();
      if (mp) mp.destroy();
    });

    doc.addEventListener("pointerdown", unlockAudio, { once: true });
    doc.addEventListener("keydown", unlockAudio, { once: true });
  }

  /* ---------- Init ---------- */

  feedback = createFeedback({ win, doc, els });
  overlays = createOverlays({ win, doc, els });
  audio = createAudio({ win, getState: () => state });
  cloud = createCloud({ win });

  quests = createQuests({
    doc,
    els,
    getState: () => state,
    t,
    save,
    sfx: (name) => audio.sfx(name),
    toast: (message) => feedback.toast(message),
    onReward: (coins, xp) => {
      state.coins = Math.min(999999, state.coins + coins);
      addXp(xp);

      if (feedback) feedback.toast(t("quest.toastClaim", { coins, xp }));
      if (audio) audio.sfx("quest");

      render();
      save();
      sendMpState();
    }
  });

  weather = createWeather({
    doc,
    els,
    getState: () => state,
    t,
    save,
    isReducedMotion: () => feedback.isReducedMotion(),
    onChange: (id) => {
      const name = t(weatherById(id).nameKey);

      if (feedback) feedback.toast(t("weather.changed", { name }));
      if (audio) audio.sfx("weather");
      if (shop) shop.render();

      save();
    }
  });

  shop = createShop({
    doc,
    els,
    getState: () => state,
    t,
    confirm: (options) => overlays.confirm(options),
    toast: (message) => feedback.toast(message),
    sfx: (name) => audio.sfx(name),
    spawnFx: (symbol, count, variant) => feedback.spawnFx(symbol, count, variant),
    addXp,
    save,
    render,
    sendMpState
  });

  mp = createMultiplayer({
    win,
    doc,
    els,
    getState: () => state,
    getPublicState: () => ({
      name: state.name,
      level: state.level,
      fur: state.fur,
      acc: state.acc,
      mood: els.cat ? els.cat.getAttribute("data-mood") : "idle",
      sleeping: state.sleeping,
      scene: state.scene
    }),
    t,
    toast: (message) => feedback.toast(message),
    sfx: (name) => audio.sfx(name),
    say: (message) => feedback.say(message),
    spawnFx: (symbol, count, variant) => feedback.spawnFx(symbol, count, variant),
    onRemotePet: (name) => {
      state.stats.happy = clamp(state.stats.happy + 2, 0, 100);
      addXp(1);
      setMood("happy", 1600);

      if (feedback) {
        feedback.spawnFx("♥", 5);
        feedback.say(t("speech.friendPet", { name }));
        feedback.toast(t("mp.petted", { name }));
      }
      if (audio) audio.sfx("pet");

      render();
      save();
    },
    onEmote: () => {
      if (quests) quests.add("mpEmote");
    },
    onConnectionChange: () => updateHint()
  });

  minigame = createMinigame({
    win,
    doc,
    els,
    getState: () => state,
    t,
    toast: (message) => feedback.toast(message),
    say: (message) => feedback.say(message),
    sfx: (name) => audio.sfx(name),
    setMood,
    addXp,
    render,
    save,
    sendMpState,
    openOverlay: (overlay) => overlays.open(overlay),
    closeOverlay: (overlay) => overlays.close(overlay),
    isReducedMotion: () => feedback.isReducedMotion(),
    onPlay: () => {
      if (quests) quests.add("play");
    }
  });

  mic = createMic({
    win,
    getState: () => state,
    getAudioContext: () => audio.getContext(),
    onUpdate: (active, key) => updateMicUi(active, key),
    onVoice: () => {
      state.stats.happy = clamp(state.stats.happy + 1, 0, 100);
      addXp(1);
      setMood("happy", 1400);

      if (feedback) {
        feedback.spawnFx("♪", 3, "fx-note");
        feedback.say(t("speech.mic"));
      }

      render();
      save();
      sendMpState();
    }
  });

  function init() {
    try {
      const params = new win.URLSearchParams(win.location.search);
      const queryLang = params.get("lang");
      const queryScene = params.get("scene");

      if (LANGS.includes(queryLang)) state.lang = queryLang;
      if (queryScene === "outside" || queryScene === "inside") state.scene = queryScene;
    } catch {
      /* URLSearchParams opsional */
    }

    const offlineSeconds = applyOfflineProgress(state, Date.now());

    applyLanguage();
    bindEvents();
    render();
    save();
    weather.refresh({ notify: false });

    if (state.scene === "outside" && !state.sleeping) {
      makeButterfly();
      scheduleButterfly();
    }

    tickTimer = win.setInterval(tick, 1000);
    saveTimer = win.setInterval(save, 5000);

    if (offlineSeconds > 300) {
      win.setTimeout(() => feedback.toast(t("toast.welcomeBack")), 700);
    }

    win.setTimeout(() => {
      if (state.sleeping) feedback.say("Zzz...", 2200);
      else feedback.say(t("speech.greet", { name: state.name }));
    }, 800);
  }

  init();

  win.MochiGame = {
    getState: () => state,
    getMp: () => mp,
    getWeather: () => weather,
    getQuests: () => quests,
    getShop: () => shop,
    getMinigame: () => minigame,
    getMusicElement: () => audio.getMusicElement(),
    t,
    save,
    render,
    actions: {
      feed,
      bath,
      pet: () => awardPet(true),
      disturb: disturbCat,
      sleep: sleepToggle,
      toggleScene,
      setScene,
      openFeed,
      openStyle,
      openSettings,
      openQuests,
      openMp,
      openGame: () => minigame.open(),
      closeGame: () => minigame.close(),
      startGame: () => minigame.start(),
      toggleSound,
      toggleMusic,
      toggleMic,
      setLanguage,
      setMusicVolume,
      saveName,
      reset: requestReset,
      createRoom: () => mp.createRoom(),
      joinRoom: () => mp.joinRoom(),
      leaveRoom: () => mp.leaveRoom(),
      sendEmote: (emoji) => mp.sendEmote(emoji),
      setWeather: (id) => weather.setWeather(id),
      claimQuest: (id) => quests.claim(id),
      addQuest: (id, n) => quests.add(id, n),
      cloudCreate,
      cloudUpload,
      cloudLoad,
      cloudCopy,
      selectShop: (item) => shop.select(item),
      switchShopTab: (tab) => shop.switchTab(tab),
      saveCloudCode: (code) => setCloudCode(code),
      stop: () => {
        win.clearInterval(tickTimer);
        win.clearInterval(saveTimer);
        win.clearTimeout(butterflyTimer);
        if (mp) mp.destroy();
      }
    }
  };

  return win.MochiGame;
}
