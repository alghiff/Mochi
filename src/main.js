import { createApp } from "./app.js";

function boot() {
  try {
    createApp();
  } catch (error) {
    console.error("Mochi gagal dimuat:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
