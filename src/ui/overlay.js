export function createOverlays({ win, doc, els }) {
  const list = Array.from(doc.querySelectorAll(".overlay"));
  let lastFocus = null;
  let confirmResolve = null;
  let confirmReturnFocus = null;
  let paused = false;

  function updatePause() {
    paused = list.some((overlay) => !overlay.hidden);
    if (paused) doc.body.classList.add("is-locked");
    else doc.body.classList.remove("is-locked");
  }

  function focusFirst(overlay) {
    const target = overlay.querySelector(
      "button:not([disabled]), input:not([disabled]), [tabindex='0']",
    );
    if (!target) return;
    win.setTimeout(() => {
      // Overlay bisa sudah tertutup sebelum timer menyala.
      if (overlay.hidden) return;

      try {
        target.focus();
      } catch {
        /* fokus opsional */
      }
    }, 40);
  }

  function open(overlay) {
    if (!overlay) return;

    /*
     * Dialog konfirmasi yang sedang menunggu jawaban tidak boleh hilang
     * tanpa jawaban, karena pemanggilnya akan menunggu selamanya.
     */
    if (els.confirmOverlay && !els.confirmOverlay.hidden && els.confirmOverlay !== overlay) {
      closeConfirm(false);
    }

    // Fokus asal dicatat sebelum overlay lain disembunyikan, supaya fokus
    // tidak dikembalikan ke elemen di dalam overlay yang sudah tertutup.
    const previous = doc.activeElement;

    for (const item of list) {
      if (item !== overlay) item.hidden = true;
    }

    if (!overlay.hidden) return;

    lastFocus = previous;
    overlay.hidden = false;
    updatePause();
    focusFirst(overlay);
  }

  function close(overlay) {
    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;
    updatePause();

    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus();
      } catch {
        /* fokus opsional */
      }
    }

    lastFocus = null;
  }

  function closeConfirm(value) {
    if (!els.confirmOverlay || els.confirmOverlay.hidden) return;

    els.confirmOverlay.hidden = true;
    updatePause();

    const resolve = confirmResolve;
    confirmResolve = null;

    if (confirmReturnFocus && typeof confirmReturnFocus.focus === "function") {
      try {
        confirmReturnFocus.focus();
      } catch {
        /* fokus opsional */
      }
    }

    confirmReturnFocus = null;
    if (resolve) resolve(value);
  }

  function confirm(options) {
    if (!els.confirmOverlay) return Promise.resolve(win.confirm(String(options.text || "")));

    if (els.confirmTitle) els.confirmTitle.textContent = String(options.title || "");
    if (els.confirmText) els.confirmText.textContent = String(options.text || "");
    if (els.confirmOk) els.confirmOk.textContent = String(options.okLabel || "OK");
    if (els.confirmCancel) els.confirmCancel.textContent = String(options.cancelLabel || "Cancel");
    if (els.confirmOk) els.confirmOk.classList.toggle("gbtn--danger", Boolean(options.danger));

    confirmReturnFocus = doc.activeElement;
    els.confirmOverlay.hidden = false;
    updatePause();
    focusFirst(els.confirmOverlay);

    return new Promise((resolve) => {
      confirmResolve = resolve;
    });
  }

  function top() {
    const openList = list.filter((overlay) => !overlay.hidden);
    return openList.length ? openList[openList.length - 1] : null;
  }

  function closeTop() {
    if (els.confirmOverlay && !els.confirmOverlay.hidden) {
      closeConfirm(false);
      return els.confirmOverlay;
    }

    const overlay = top();
    if (overlay) close(overlay);
    return overlay;
  }

  function trapFocus(event, overlay) {
    const nodes = overlay.querySelectorAll(
      "button, input, [href], [tabindex]:not([tabindex='-1'])",
    );

    const focusable = Array.from(nodes).filter((node) => {
      return !node.disabled && node.getAttribute("aria-hidden") !== "true" &&
        node.offsetParent !== null;
    });

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (els.confirmOk) {
    els.confirmOk.addEventListener("click", () => closeConfirm(true));
  }
  if (els.confirmCancel) {
    els.confirmCancel.addEventListener("click", () => closeConfirm(false));
  }
  if (els.confirmOverlay) {
    els.confirmOverlay.addEventListener("click", (event) => {
      if (event.target && event.target.hasAttribute("data-confirm-close")) closeConfirm(false);
    });
  }

  updatePause();

  return {
    list,
    top,
    open,
    close,
    closeTop,
    confirm,
    isPaused: () => paused,
    updatePause,
    trapFocus,
  };
}
