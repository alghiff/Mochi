/*
 * Cloud save.
 * Kode cloud adalah bearer token. Server menyimpan hash SHA-256 dari kode,
 * bukan kode aslinya. Data yang diunggah adalah snapshot state publik game.
 */
export function createCloud({ win }) {
  const endpoint = "/api/cloud";
  const timeoutMs = 15_000;

  function available() {
    const loc = win.location;
    return Boolean(loc && (loc.protocol === "http:" || loc.protocol === "https:"));
  }

  async function post(payload) {
    if (!available()) throw new Error("no_server");

    const fetchImpl = win.fetch ? win.fetch.bind(win) : fetch;
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      cache: "no-store",
    };

    // Jangan menggantung selamanya kalau server tidak merespons.
    const Signal = win.AbortSignal;

    if (Signal && typeof Signal.timeout === "function") {
      options.signal = Signal.timeout(timeoutMs);
    }

    let response;

    try {
      response = await fetchImpl(endpoint, options);
    } catch (error) {
      const name = error && error.name ? error.name : "";

      if (name === "TimeoutError" || name === "AbortError") throw new Error("timeout");

      throw new Error("network_error");
    }

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const code = data && data.error ? String(data.error) : "cloud_error";
      throw new Error(code);
    }

    return data || {};
  }

  return {
    available,
    create: () => post({ action: "create" }),
    save: (code, state) => post({ action: "save", code, state }),
    load: (code) => post({ action: "load", code }),
  };
}

export function normalizeCloudCode(value) {
  const raw = String(value == null ? "" : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

  return raw.replace(/(.{4})(?=.)/g, "$1-");
}
