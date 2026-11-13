export function createFeedback({ win, doc, els }) {
  let speechTimer = 0;
  let toastTimer = 0;
  let reduceMotion = false;

  try {
    if (win.matchMedia) {
      const query = win.matchMedia("(prefers-reduced-motion: reduce)");
      reduceMotion = query.matches;
      const onChange = (event) => {
        reduceMotion = event.matches;
      };
      if (typeof query.addEventListener === "function") query.addEventListener("change", onChange);
    }
  } catch {
    reduceMotion = false;
  }

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = String(message);
    els.toast.classList.add("is-on");
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => {
      els.toast.classList.remove("is-on");
    }, 2600);
  }

  function say(message, duration) {
    if (!els.speech) return;
    els.speech.textContent = String(message);
    els.speech.classList.add("is-on");
    win.clearTimeout(speechTimer);
    speechTimer = win.setTimeout(() => {
      els.speech.classList.remove("is-on");
    }, duration || 2800);
  }

  function spawnFxAt(symbol, count, variant, x, y) {
    if (!els.fx || reduceMotion) return;

    const total = Math.min(Math.max(1, count || 1), 10);

    for (let i = 0; i < total; i += 1) {
      const particle = doc.createElement("span");
      particle.className = "fx-particle" + (variant ? " " + variant : "");
      particle.textContent = symbol;
      particle.style.setProperty("--x", (Math.random() * 46 - 23).toFixed(1) + "px");
      particle.style.setProperty("--delay", (i * 0.05).toFixed(2) + "s");
      particle.style.setProperty("--scale", (0.75 + Math.random() * 0.8).toFixed(2));
      particle.style.setProperty("--rot", (Math.random() * 46 - 23).toFixed(1) + "deg");
      if (Number.isFinite(x)) particle.style.left = x.toFixed(1) + "px";
      if (Number.isFinite(y)) particle.style.top = y.toFixed(1) + "px";
      els.fx.appendChild(particle);

      win.setTimeout(() => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      }, 1700);
    }
  }

  function spawnFx(symbol, count, variant) {
    spawnFxAt(symbol, count, variant);
  }

  function spawnBubbles() {
    if (!els.fx || reduceMotion) return;

    for (let i = 0; i < 9; i += 1) {
      const bubble = doc.createElement("span");
      bubble.className = "fx-bubble";
      bubble.style.setProperty("--x", (Math.random() * 110 - 55).toFixed(1) + "px");
      bubble.style.setProperty("--delay", (i * 0.05).toFixed(2) + "s");
      bubble.style.setProperty("--scale", (0.7 + Math.random() * 1.1).toFixed(2));
      els.fx.appendChild(bubble);

      win.setTimeout(() => {
        if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
      }, 1900);
    }
  }

  return { toast, say, spawnFx, spawnFxAt, spawnBubbles, isReducedMotion: () => reduceMotion };
}
