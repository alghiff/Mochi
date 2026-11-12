export function createMic({ win, getState, getAudioContext, onUpdate, onVoice }) {
  const mic = {
    stream: null,
    source: null,
    analyser: null,
    data: null,
    raf: 0,
    active: false,
    lastAt: 0,
    denied: false,
    unsupported: false,
    loudFrames: 0
  };

  function statusKey() {
    if (mic.active) return "settings.micOn";
    if (mic.denied) return "settings.micDenied";
    if (mic.unsupported) return "settings.micUnsupported";
    return "settings.micOff";
  }

  function notify() {
    if (onUpdate) onUpdate(mic.active, statusKey());
  }

  function stop() {
    mic.active = false;

    if (mic.raf) {
      win.cancelAnimationFrame(mic.raf);
      mic.raf = 0;
    }

    if (mic.stream) {
      for (const track of mic.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* track sudah berhenti */
        }
      }
      mic.stream = null;
    }

    mic.source = null;
    mic.analyser = null;
    mic.data = null;
    mic.loudFrames = 0;
    notify();
  }

  function loop() {
    if (!mic.active || !mic.analyser || !mic.data) return;

    mic.analyser.getByteTimeDomainData(mic.data);

    let sum = 0;
    for (let i = 0; i < mic.data.length; i += 1) {
      const centered = (mic.data[i] - 128) / 128;
      sum += centered * centered;
    }

    const rms = Math.sqrt(sum / mic.data.length);

    if (rms > 0.11) mic.loudFrames += 1;
    else mic.loudFrames = Math.max(0, mic.loudFrames - 1);

    const now = Date.now();
    if (mic.loudFrames >= 3 && now - mic.lastAt > 2800) {
      mic.lastAt = now;
      mic.loudFrames = 0;
      if (onVoice) onVoice();
    }

    mic.raf = win.requestAnimationFrame(loop);
  }

  function start() {
    mic.denied = false;
    mic.unsupported = false;

    const nav = win.navigator;

    if (!nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== "function") {
      mic.unsupported = true;
      notify();
      return Promise.resolve({ ok: false, reason: "unsupported" });
    }

    const ctx = getAudioContext ? getAudioContext() : null;
    if (!ctx) {
      mic.unsupported = true;
      notify();
      return Promise.resolve({ ok: false, reason: "unsupported" });
    }

    return nav.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })
      .then((stream) => {
        mic.stream = stream;
        mic.source = ctx.createMediaStreamSource(stream);
        mic.analyser = ctx.createAnalyser();
        mic.analyser.fftSize = 1024;
        mic.analyser.smoothingTimeConstant = 0.75;
        mic.data = new Uint8Array(mic.analyser.fftSize);

        mic.source.connect(mic.analyser);
        mic.active = true;
        mic.lastAt = 0;
        mic.loudFrames = 0;
        notify();

        mic.raf = win.requestAnimationFrame(loop);
        return { ok: true };
      })
      .catch(() => {
        mic.denied = true;
        mic.active = false;
        notify();
        return { ok: false, reason: "denied" };
      });
  }

  function toggle() {
    if (mic.active) {
      stop();
      return Promise.resolve({ ok: false, reason: "off" });
    }
    return start();
  }

  return {
    toggle,
    stop,
    isActive: () => mic.active,
    statusKey
  };
}
