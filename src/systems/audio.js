import { clamp } from "../core/util.js";
import { MUSIC_SRC } from "../data/music.js";

export function createAudio({ win, getState }) {
  let ctx = null;

  function getAudio() {
    if (ctx) return ctx;

    const Ctor = win.AudioContext || win.webkitAudioContext;
    if (!Ctor) return null;

    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }

    return ctx;
  }

  function resumeAudio() {
    if (!ctx || ctx.state !== "suspended" || typeof ctx.resume !== "function") return;
    try {
      const resumed = ctx.resume();
      if (resumed && typeof resumed.catch === "function") resumed.catch(() => {});
    } catch {
      /* audio opsional */
    }
  }

  function enabled() {
    const state = getState();
    return Boolean(state && state.sound);
  }

  function tone(frequency, duration, options) {
    if (!enabled()) return;

    const opts = options || {};
    const audio = getAudio();
    if (!audio) return;

    try {
      resumeAudio();

      const start = audio.currentTime + (opts.delay || 0);
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const peak = opts.gain == null ? 0.05 : opts.gain;

      oscillator.type = opts.type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.04);
    } catch {
      /* audio opsional */
    }
  }

  function meow(options) {
    if (!enabled()) return;

    const audio = getAudio();
    if (!audio) return;

    const opts = options || {};
    const low = Boolean(opts.annoyed);

    try {
      resumeAudio();

      const start = audio.currentTime + 0.02;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(low ? 300 : 540, start);
      osc.frequency.linearRampToValueAtTime(low ? 430 : 880, start + 0.08);
      osc.frequency.linearRampToValueAtTime(low ? 340 : 700, start + 0.18);
      osc.frequency.linearRampToValueAtTime(low ? 220 : 420, start + 0.3);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(low ? 700 : 1100, start);
      filter.frequency.linearRampToValueAtTime(low ? 900 : 1700, start + 0.12);
      filter.frequency.linearRampToValueAtTime(low ? 600 : 800, start + 0.32);
      filter.Q.value = 4;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(low ? 0.06 : 0.08, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(low ? 0.035 : 0.05, start + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.38);

      if (!low) {
        const purr = audio.createOscillator();
        const purrGain = audio.createGain();
        purr.type = "sine";
        purr.frequency.setValueAtTime(46, start);
        purrGain.gain.setValueAtTime(0.0001, start);
        purrGain.gain.exponentialRampToValueAtTime(0.035, start + 0.12);
        purrGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
        purr.connect(purrGain);
        purrGain.connect(audio.destination);
        purr.start(start);
        purr.stop(start + 0.44);
      }
    } catch {
      /* audio opsional */
    }
  }

  function sfx(name) {
    if (!enabled()) return;

    if (name === "meow" || name === "pet") {
      meow();
      if (name === "pet") tone(660, 0.09, { gain: 0.025, delay: 0.28 });
    } else if (name === "annoyed") {
      meow({ annoyed: true });
    } else if (name === "eat") {
      tone(440, 0.08, { type: "triangle", gain: 0.05 });
      tone(560, 0.1, { type: "triangle", gain: 0.045, delay: 0.09 });
    } else if (name === "bath") {
      tone(740, 0.07, { gain: 0.035 });
      tone(920, 0.09, { gain: 0.03, delay: 0.08 });
    } else if (name === "sleep") {
      tone(520, 0.13, { gain: 0.04 });
      tone(390, 0.18, { gain: 0.035, delay: 0.13 });
    } else if (name === "wake") {
      meow();
    } else if (name === "buy") {
      tone(660, 0.08, { gain: 0.04 });
      tone(880, 0.12, { gain: 0.035, delay: 0.08 });
    } else if (name === "error") {
      tone(180, 0.15, { type: "triangle", gain: 0.04 });
    } else if (name === "catch") {
      tone(880, 0.06, { gain: 0.03 });
      tone(1180, 0.08, { gain: 0.026, delay: 0.05 });
    } else if (name === "level") {
      tone(523, 0.1, { gain: 0.04 });
      tone(659, 0.1, { gain: 0.04, delay: 0.1 });
      tone(784, 0.16, { gain: 0.04, delay: 0.2 });
    } else if (name === "start") {
      tone(523, 0.08, { gain: 0.04 });
      tone(784, 0.12, { gain: 0.04, delay: 0.08 });
    } else if (name === "win") {
      tone(659, 0.1, { gain: 0.04 });
      tone(784, 0.1, { gain: 0.04, delay: 0.1 });
      tone(1046, 0.18, { gain: 0.04, delay: 0.2 });
    } else if (name === "end") {
      tone(392, 0.18, { type: "triangle", gain: 0.035 });
    } else if (name === "butterfly") {
      tone(1046, 0.06, { gain: 0.028 });
      tone(1318, 0.08, { gain: 0.024, delay: 0.05 });
    } else if (name === "mp") {
      tone(620, 0.07, { gain: 0.03 });
      tone(930, 0.1, { gain: 0.028, delay: 0.07 });
    } else if (name === "quest") {
      tone(784, 0.09, { gain: 0.035 });
      tone(988, 0.09, { gain: 0.033, delay: 0.09 });
      tone(1318, 0.14, { gain: 0.03, delay: 0.18 });
    } else if (name === "weather") {
      tone(587, 0.14, { type: "sine", gain: 0.025 });
      tone(880, 0.18, { type: "sine", gain: 0.02, delay: 0.12 });
    } else if (name === "cloud") {
      tone(659, 0.09, { gain: 0.03 });
      tone(1046, 0.16, { gain: 0.028, delay: 0.09 });
    }
  }

  /* ---------- Musik latar (lagu dari folder assets) ---------- */

  const MUSIC_GAIN = 0.8;
  const song = { el: null };

  function musicVolume() {
    const state = getState();
    const vol = state && Number.isFinite(state.musicVol) ? state.musicVol : 0.55;
    return clamp(vol, 0, 1) * MUSIC_GAIN;
  }

  function getSong() {
    if (song.el) return song.el;
    if (typeof win.Audio !== "function") return null;

    try {
      const el = new win.Audio(MUSIC_SRC);
      el.loop = true;
      el.preload = "metadata";
      el.volume = musicVolume();
      el.setAttribute("playsinline", "");
      song.el = el;
    } catch {
      song.el = null;
    }

    return song.el;
  }

  function startMusic() {
    const state = getState();
    if (!state || !state.music) return;

    const el = getSong();
    if (!el) return;

    try {
      el.volume = musicVolume();
      const played = el.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    } catch {
      /* audio opsional */
    }
  }

  function stopMusic() {
    if (!song.el) return;

    try {
      song.el.pause();
    } catch {
      /* audio opsional */
    }
  }

  function updateMusicVolume() {
    if (!song.el) return;

    try {
      song.el.volume = musicVolume();
    } catch {
      /* audio opsional */
    }
  }

  return {
    tone,
    meow,
    sfx,
    startMusic,
    stopMusic,
    updateMusicVolume,
    getContext: () => getAudio(),
    getMusicElement: () => song.el
  };
}
