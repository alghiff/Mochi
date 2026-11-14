export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function nowMs(win) {
  if (win && win.performance && typeof win.performance.now === "function") {
    return win.performance.now();
  }
  return Date.now();
}

export function sanitizeName(value) {
  const name = String(value == null ? "" : value)
    .replace(/\p{Cc}/gu, "")
    .replace(/[^\p{L}\p{N} .'\-_]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);

  return name || "Mochi";
}

export function xpNeeded(level) {
  return 60 + level * 40;
}

export function validId(list, id) {
  return list.some((item) => item.id === id);
}

export function todayKey(date) {
  const value = date || new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/*
 * Kunci minggu dimulai hari Senin.
 *
 * Dipakai misi mingguan supaya reset terjadi tepat saat awal minggu, bukan
 * setiap tujuh hari sejak pemain pertama kali membuka game.
 */
export function weekKey(date) {
  const value = date ? new Date(date) : new Date();
  const day = (value.getDay() + 6) % 7;

  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - day);

  return todayKey(value);
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
