import { clamp, nowMs } from "../core/util.js";

const MG_SECONDS = 20;

export function createMinigame({
  win,
  doc,
  els,
  getState,
  t,
  toast,
  say,
  sfx,
  setMood,
  addXp,
  render,
  save,
  sendMpState,
  openOverlay,
  closeOverlay,
  isReducedMotion,
  onPlay
}) {
  const mg = {
    running: false,
    score: 0,
    deadline: 0,
    timer: 0,
    spawner: 0
  };

  function stopTimers() {
    if (mg.timer) {
      win.clearInterval(mg.timer);
      mg.timer = 0;
    }
    if (mg.spawner) {
      win.clearInterval(mg.spawner);
      mg.spawner = 0;
    }
  }

  function clearFish() {
    if (!els.mgArena) return;

    const nodes = els.mgArena.querySelectorAll(".mg-fish, .mg-pop");
    for (const node of nodes) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
  }

  function resetView() {
    stopTimers();
    clearFish();

    mg.running = false;
    mg.score = 0;

    if (els.mgScore) els.mgScore.textContent = "0";
    if (els.mgTime) els.mgTime.textContent = String(MG_SECONDS);
    if (els.mgIntro) els.mgIntro.hidden = false;
    if (els.mgResult) els.mgResult.hidden = true;
  }

  function open() {
    const state = getState();

    if (state.sleeping) {
      toast(t("toast.sleeping"));
      return false;
    }

    if (state.stats.energy < 12) {
      toast(t("toast.lowEnergy"));
      sfx("error");
      return false;
    }

    resetView();
    openOverlay(els.minigame);
    return true;
  }

  function spawnPop(fish) {
    if (!els.mgArena || isReducedMotion()) return;

    const arenaRect = els.mgArena.getBoundingClientRect();
    const fishRect = fish.getBoundingClientRect();

    const pop = doc.createElement("span");
    pop.className = "mg-pop";
    pop.textContent = "+1";
    pop.style.left = (fishRect.left - arenaRect.left + fishRect.width / 2).toFixed(1) + "px";
    pop.style.top = (fishRect.top - arenaRect.top + fishRect.height / 2).toFixed(1) + "px";

    els.mgArena.appendChild(pop);

    win.setTimeout(() => {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 900);
  }

  function spawnFish() {
    if (!mg.running || !els.mgArena) return;

    const width = els.mgArena.clientWidth;
    const height = els.mgArena.clientHeight;

    if (width < 80 || height < 80) return;

    const fish = doc.createElement("button");
    fish.type = "button";
    fish.className = "mg-fish";
    fish.setAttribute("aria-label", t("mg.catchAria"));

    const body = doc.createElement("span");
    body.className = "fish-body";

    const tail = doc.createElement("span");
    tail.className = "fish-tail";

    const eye = doc.createElement("span");
    eye.className = "fish-eye";

    fish.appendChild(body);
    fish.appendChild(tail);
    fish.appendChild(eye);

    const scale = 0.8 + Math.random() * 0.5;
    fish.style.width = Math.round(46 * scale) + "px";
    fish.style.height = Math.round(32 * scale) + "px";
    fish.style.left = Math.round(6 + Math.random() * Math.max(0, width - 72)) + "px";
    fish.style.top = "0px";

    els.mgArena.appendChild(fish);

    const drift = Math.random() * 70 - 35;
    const duration = isReducedMotion() ? 2400 : 2600 + Math.random() * 1400;
    const fallDistance = height + 70;
    let caught = false;
    let animation = null;

    function removeFish() {
      if (fish.parentNode) fish.parentNode.removeChild(fish);
    }

    function catchFish() {
      if (caught || !mg.running) return;

      caught = true;
      if (animation && typeof animation.cancel === "function") animation.cancel();

      mg.score += 1;
      if (els.mgScore) els.mgScore.textContent = String(mg.score);

      spawnPop(fish);
      removeFish();
      sfx("catch");
    }

    fish.addEventListener("click", catchFish);

    if (typeof fish.animate === "function") {
      animation = fish.animate(
        [
          { transform: "translate3d(0, -48px, 0) rotate(-6deg)" },
          {
            transform: `translate3d(${drift.toFixed(1)}px, ${fallDistance.toFixed(1)}px, 0) rotate(8deg)`
          }
        ],
        { duration, easing: "linear", fill: "forwards" }
      );

      animation.onfinish = () => {
        if (!caught) removeFish();
      };
    } else {
      win.setTimeout(() => {
        if (!caught) removeFish();
      }, duration);
    }
  }

  function updateClock() {
    if (!mg.running) return;

    const left = Math.max(0, Math.ceil((mg.deadline - nowMs(win)) / 1000));
    if (els.mgTime) els.mgTime.textContent = String(left);

    if (left <= 0) end();
  }

  function start() {
    if (mg.running) return;

    const state = getState();

    if (state.stats.energy < 10) {
      toast(t("mg.noEnergy"));
      sfx("error");
      return;
    }

    clearFish();

    mg.running = true;
    mg.score = 0;
    mg.deadline = nowMs(win) + MG_SECONDS * 1000;

    if (els.mgScore) els.mgScore.textContent = "0";
    if (els.mgTime) els.mgTime.textContent = String(MG_SECONDS);
    if (els.mgIntro) els.mgIntro.hidden = true;
    if (els.mgResult) els.mgResult.hidden = true;

    mg.timer = win.setInterval(updateClock, 200);
    mg.spawner = win.setInterval(spawnFish, 560);

    spawnFish();
    sfx("start");
  }

  function end() {
    if (!mg.running) return;

    mg.running = false;
    stopTimers();
    clearFish();

    if (els.mgTime) els.mgTime.textContent = "0";

    const score = mg.score;
    const state = getState();

    if (els.mgFinal) els.mgFinal.textContent = String(score);
    if (els.mgCoins) els.mgCoins.textContent = String(score);
    if (els.mgResult) els.mgResult.hidden = false;
    if (els.mgIntro) els.mgIntro.hidden = true;

    state.coins = Math.min(999999, state.coins + score);
    state.stats.happy = clamp(state.stats.happy + 10 + Math.min(6, score), 0, 100);
    state.stats.energy = clamp(state.stats.energy - 6, 0, 100);
    state.stats.hunger = clamp(state.stats.hunger - 3, 0, 100);

    addXp(6 + score);
    setMood("play", 1800);
    render();
    save();
    sendMpState();

    if (onPlay) onPlay(score);

    sfx(score > 0 ? "win" : "end");
    say(score > 0 ? t("speech.playWin", { n: score }) : t("speech.playLose"));
  }

  function close() {
    if (mg.running) end();

    closeOverlay(els.minigame);
    resetView();
  }

  return {
    open,
    start,
    end,
    close,
    isRunning: () => mg.running,
    getScore: () => mg.score
  };
}
