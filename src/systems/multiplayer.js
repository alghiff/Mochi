import { accById } from "../data/accessories.js";
import { FURS } from "../data/furs.js";
import { sanitizeName } from "../core/util.js";

const EMOTES = ["😺", "👋", "❤️", "✨", "🐟", "🎉", "😴", "🍀"];
const MAX_FALLBACK = 6;

const FUR_IDS = new Set(FURS.map((item) => item.id));
const MOODS = new Set(["idle", "happy", "sad", "sleep", "eat", "bath", "play", "annoyed"]);
const SCENES = new Set(["inside", "outside"]);

/*
 * State pemain remote selalu divalidasi ulang di sisi klien, walau server
 * sudah membersihkannya. Ini pertahanan berlapis kalau ada server yang
 * mengirim data aneh.
 */
function cleanRemoteState(raw) {
  if (!raw || typeof raw !== "object") return null;

  const acc = typeof raw.acc === "string" && accById(raw.acc) ? raw.acc : null;

  return {
    name: sanitizeName(raw.name),
    level: Math.min(99, Math.max(1, Math.floor(Number(raw.level) || 1))),
    fur: FUR_IDS.has(raw.fur) ? raw.fur : "cream",
    acc,
    mood: MOODS.has(raw.mood) ? raw.mood : "idle",
    sleeping: Boolean(raw.sleeping),
    scene: SCENES.has(raw.scene) ? raw.scene : "inside",
  };
}

/*
 * Multiplayer WebSocket.
 * Server mengirim daftar pemain; setiap pemain lain digambar sebagai satu kucing
 * di dalam stage. Jumlah pemain per room mengikuti batas dari server.
 */
export function createMultiplayer({
  win,
  doc,
  els,
  getState,
  getPublicState,
  t,
  toast,
  sfx,
  say,
  spawnFx,
  onRemotePet,
  onEmote,
  onConnectionChange,
}) {
  const mp = {
    ws: null,
    room: null,
    selfId: null,
    host: null,
    max: MAX_FALLBACK,
    players: new Map(),
    connected: false,
    connecting: false,
    stateTimer: 0,
    pingTimer: 0,
    leaving: false,
  };

  const nodes = new Map();
  const emoteTimers = new Map();

  function supported() {
    const loc = win.location;
    return Boolean(loc && (loc.protocol === "http:" || loc.protocol === "https:"));
  }

  function wsUrl() {
    const loc = win.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + loc.host + "/ws";
  }

  function playerCount() {
    return mp.room ? mp.players.size + 1 : 0;
  }

  function send(payload) {
    if (!mp.ws || mp.ws.readyState !== 1) return false;

    try {
      mp.ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function sendState() {
    if (!mp.room || !mp.ws || mp.ws.readyState !== 1) return;

    win.clearTimeout(mp.stateTimer);
    mp.stateTimer = win.setTimeout(() => {
      send({ type: "state", state: getPublicState() });
    }, 120);
  }

  function errorMessage(code) {
    if (code === "full") return t("mp.full");
    if (code === "server_full") return t("mp.serverFull");
    if (code === "not_found") return t("mp.notFound");
    if (code === "invalid_code") return t("mp.invalidCode");
    return t("mp.error");
  }

  function ensureRemoteNode(id) {
    if (!els.remoteCats) return null;

    let node = nodes.get(id);
    if (node) return node;

    node = doc.createElement("div");
    node.className = "remote-cat";
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
    node.setAttribute("data-player", id);

    const body = els.cat ? els.cat.cloneNode(true) : null;

    if (body) {
      body.removeAttribute("id");
      body.classList.add("remote-cat-body");
      const emoji = body.querySelector(".cat-acc-emoji");
      if (emoji) {
        emoji.removeAttribute("id");
        emoji.textContent = "";
      }
      node.appendChild(body);
    }

    const name = doc.createElement("span");
    name.className = "remote-cat-name";
    node.appendChild(name);

    const emote = doc.createElement("span");
    emote.className = "remote-emote";
    node.appendChild(emote);

    node.addEventListener("click", () => petRemote(id));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        petRemote(id);
      }
    });

    els.remoteCats.appendChild(node);
    nodes.set(id, node);
    return node;
  }

  function layout() {
    if (!els.remoteCats) return;

    const list = Array.from(nodes.keys());
    const total = list.length;
    const wide = Math.min(560, Math.max(240, (win.innerWidth || 800) * 0.6));
    const spacing = total <= 1 ? 0 : Math.min(150, wide / (total - 1));

    list.forEach((id, index) => {
      const node = nodes.get(id);
      if (!node) return;

      const offset = (index - (total - 1) / 2) * spacing;
      const lift = total > 2 && index % 2 === 1 ? (total > 3 ? 54 : 34) : 0;
      const scale = total > 4 ? 0.78 : total > 3 ? 0.84 : 0.94;

      node.style.setProperty("--rx", offset.toFixed(1) + "px");
      node.style.setProperty("--ry", (-lift).toFixed(1) + "px");
      node.style.setProperty("--rscale", String(scale));
      node.style.setProperty("--name-size", total > 3 ? ".46rem" : ".52rem");
      node.style.setProperty("--name-w", total > 3 ? "88px" : "120px");
    });
  }

  function renderRemoteCats() {
    if (!els.remoteCats) return;

    if (!mp.room) {
      for (const node of nodes.values()) {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
      nodes.clear();
      if (els.stage) els.stage.classList.remove("has-friends");
      return;
    }

    const state = getState();
    const active = new Set();

    for (const [id, player] of mp.players) {
      active.add(id);
      const node = ensureRemoteNode(id);
      if (!node) continue;

      const info = player.state || {};
      const body = node.querySelector(".remote-cat-body");
      const acc = accById(info.acc);
      const emoji = node.querySelector(".cat-acc-emoji");

      if (body) {
        body.setAttribute("data-fur", info.fur || "cream");
        body.setAttribute("data-acc", info.acc || "");
        body.setAttribute("data-acc-slot", acc ? acc.slot : "");
        body.setAttribute("data-mood", info.sleeping ? "sleep" : info.mood || "idle");
      }

      if (emoji) {
        emoji.textContent = acc && !acc.svg ? acc.icon : "";
      }

      const name = node.querySelector(".remote-cat-name");
      const label = info.name || "Teman";

      if (name) {
        name.textContent = `${label} · Lv ${info.level || 1}`;
      }

      node.classList.toggle("is-sleeping", Boolean(info.sleeping));
      node.classList.toggle("is-elsewhere", info.scene !== state.scene);
      node.setAttribute("aria-label", t("mp.petTarget", { name: label }));
      node.setAttribute("title", t("mp.petTarget", { name: label }));
    }

    for (const [id, node] of nodes) {
      if (active.has(id)) continue;
      if (node.parentNode) node.parentNode.removeChild(node);
      nodes.delete(id);
    }

    layout();

    if (els.stage) {
      els.stage.classList.toggle("has-friends", nodes.size > 0);
      els.stage.setAttribute("data-friends", String(nodes.size));
    }
  }

  function renderPlayers() {
    if (!els.mpPlayers) return;

    els.mpPlayers.textContent = "";

    if (!mp.room) return;

    const me = doc.createElement("li");
    me.className = "mp-player is-self";

    const meName = doc.createElement("b");
    meName.textContent = getState().name;

    const meTag = doc.createElement("span");
    meTag.textContent = t("mp.you") + (mp.host === mp.selfId ? " · " + t("mp.host") : "");

    me.appendChild(meName);
    me.appendChild(meTag);
    els.mpPlayers.appendChild(me);

    for (const player of mp.players.values()) {
      const info = player.state || {};
      const item = doc.createElement("li");
      item.className = "mp-player is-friend";

      const name = doc.createElement("b");
      name.textContent = info.name || "Teman";

      const tag = doc.createElement("span");
      const sceneKey = info.scene === "outside" ? "mp.sceneOutside" : "mp.sceneInside";
      tag.textContent = `Lv ${info.level || 1} · ${t(sceneKey)}`;

      item.appendChild(name);
      item.appendChild(tag);
      els.mpPlayers.appendChild(item);
    }
  }

  function render() {
    if (!els.mpLobby || !els.mpRoom) return;

    const inRoom = Boolean(mp.room);

    els.mpLobby.hidden = inRoom;
    els.mpRoom.hidden = !inRoom;

    if (els.mpRoomCode) els.mpRoomCode.textContent = mp.room || "-----";

    if (els.mpRoomStatus) {
      if (mp.connecting) els.mpRoomStatus.textContent = t("mp.connecting");
      else if (inRoom) {
        els.mpRoomStatus.textContent = t("mp.playersCount", { n: playerCount(), max: mp.max });
      } else els.mpRoomStatus.textContent = t("mp.waiting");
    }

    if (els.mpCount) {
      els.mpCount.textContent = t("mp.playersCount", { n: playerCount(), max: mp.max });
    }

    if (els.mpCreate) els.mpCreate.disabled = mp.connecting;
    if (els.mpJoin) els.mpJoin.disabled = mp.connecting;
    if (els.mpLeave) els.mpLeave.disabled = mp.connecting;

    if (els.mpServerNote) {
      els.mpServerNote.textContent = supported() ? t("mp.serverNote") : t("mp.serverRequired");
    }

    if (els.mpShareHint) {
      els.mpShareHint.hidden = !inRoom;
    }

    renderPlayers();
    renderRemoteCats();

    if (onConnectionChange) onConnectionChange(inRoom);
  }

  function showEmote(id, emoji) {
    const node = nodes.get(id);
    if (!node) return;

    const bubble = node.querySelector(".remote-emote");
    if (!bubble) return;

    bubble.textContent = String(emoji).slice(0, 8);
    bubble.classList.add("is-on");

    win.clearTimeout(emoteTimers.get(id));
    emoteTimers.set(
      id,
      win.setTimeout(() => {
        bubble.classList.remove("is-on");
      }, 2200),
    );
  }

  function petRemote(id) {
    if (!mp.room || !mp.players.has(id)) return;

    send({ type: "pet", target: id });

    const info = mp.players.get(id).state || {};
    const label = info.name || "Teman";

    spawnFx("♥", 4);
    say(t("mp.petTarget", { name: label }));
    sfx("pet");
  }

  function handleMessage(event) {
    let msg;

    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "room") {
      mp.room = String(msg.room || "");
      mp.selfId = String(msg.selfId || "");
      mp.host = String(msg.host || msg.selfId || "");
      mp.max = Math.max(2, Math.min(12, Math.floor(Number(msg.max) || MAX_FALLBACK)));
      mp.connected = true;
      mp.connecting = false;
      mp.leaving = false;
      mp.players.clear();

      if (Array.isArray(msg.players)) {
        for (const player of msg.players) {
          if (!player || !player.id || player.id === mp.selfId) continue;

          // Batasi jumlah pemain remote supaya DOM tidak tumbuh tanpa batas.
          if (mp.players.size >= mp.max) break;

          mp.players.set(String(player.id), {
            id: String(player.id),
            state: cleanRemoteState(player.state),
          });
        }
      }

      startPing();
      render();
      sendState();
      sfx("mp");
      toast(t("mp.connected"));
      return;
    }

    if (msg.type === "joined") {
      const id = String(msg.id || "");
      if (!id || id === mp.selfId) return;
      if (mp.players.size >= mp.max) return;

      const state = cleanRemoteState(msg.state);
      mp.players.set(id, { id, state });
      render();
      sendState();
      sfx("mp");

      const name = state && state.name ? state.name : "Teman";
      toast(t("mp.friendJoined", { name }));
      return;
    }

    if (msg.type === "left") {
      const id = String(msg.id || "");
      const player = mp.players.get(id);

      // Timer emote pemain yang keluar harus dibuang.
      const emoteTimer = emoteTimers.get(id);

      if (emoteTimer) {
        win.clearTimeout(emoteTimer);
        emoteTimers.delete(id);
      }

      if (player) {
        const name = player.state && player.state.name ? player.state.name : "Teman";
        mp.players.delete(id);
        const node = nodes.get(id);
        if (node && node.parentNode) node.parentNode.removeChild(node);
        nodes.delete(id);
        render();
        toast(t("mp.friendLeft", { name }));
      }
      return;
    }

    if (msg.type === "state") {
      const id = String(msg.id || "");
      const player = mp.players.get(id);

      if (player) {
        const state = cleanRemoteState(msg.state);

        if (!state) return;

        player.state = state;
        renderRemoteCats();
        renderPlayers();
      }
      return;
    }

    if (msg.type === "host") {
      mp.host = String(msg.host || mp.host || "");
      renderPlayers();
      return;
    }

    if (msg.type === "emote") {
      const emoji = EMOTES.includes(msg.emote) ? msg.emote : "😺";
      showEmote(String(msg.id || ""), emoji);
      return;
    }

    if (msg.type === "petted") {
      if (msg.target && msg.target !== mp.selfId) return;
      if (onRemotePet) onRemotePet(msg.name ? String(msg.name) : "Teman");
      return;
    }

    if (msg.type === "error") {
      toast(errorMessage(msg.code));
      mp.connecting = false;

      if (
        msg.code === "full" ||
        msg.code === "server_full" ||
        msg.code === "not_found" ||
        msg.code === "invalid_code"
      ) {
        mp.room = null;
        mp.players.clear();
        mp.connected = false;
      }

      render();
    }
  }

  function startPing() {
    win.clearInterval(mp.pingTimer);
    mp.pingTimer = win.setInterval(() => {
      if (mp.room) send({ type: "ping" });
    }, 25_000);
  }

  function closeSocket() {
    if (!mp.ws) return;

    const socket = mp.ws;
    mp.ws = null;

    // Tandai penutupan yang disengaja supaya handler onclose tidak
    // salah thinks koneksi terputus.
    socket.__closed = true;

    try {
      socket.close();
    } catch {
      /* socket sudah tertutup */
    }
  }

  function reset() {
    mp.room = null;
    mp.selfId = null;
    mp.host = null;
    mp.players.clear();
    mp.connected = false;
    mp.connecting = false;

    win.clearTimeout(mp.stateTimer);
    win.clearInterval(mp.pingTimer);
    mp.pingTimer = 0;

    render();
  }

  function connect(mode, code) {
    if (!supported()) {
      toast(t("mp.serverRequired"));
      return;
    }

    if (mp.connecting) return;

    closeSocket();
    mp.players.clear();
    mp.room = null;
    mp.connected = false;
    mp.connecting = true;
    render();

    let socket;

    try {
      socket = new win.WebSocket(wsUrl());
    } catch {
      mp.connecting = false;
      render();
      toast(t("mp.noServer"));
      return;
    }

    mp.ws = socket;

    socket.onopen = () => {
      // Abaikan socket lama yang kebetulan terbuka lagi.
      if (mp.ws !== socket) return;

      if (mode === "join") send({ type: "join", room: code });
      else send({ type: "create" });
    };

    socket.onmessage = (event) => {
      if (mp.ws !== socket) return;
      handleMessage(event);
    };

    socket.onerror = () => {
      // Socket lama tidak boleh menyentuh state socket yang baru.
      if (mp.ws !== socket) return;

      mp.connecting = false;
      render();
    };

    socket.onclose = () => {
      const intentional = socket.__closed === true;

      /*
       * Socket lama (yang sudah diganti socket baru) tidak boleh menghapus
       * session yang sedang berjalan.
       */
      if (mp.ws !== socket && !intentional) return;

      const wasConnected = mp.connected;

      if (mp.ws === socket) {
        mp.ws = null;
        mp.connected = false;
        mp.connecting = false;
        mp.players.clear();
        win.clearInterval(mp.pingTimer);
        mp.pingTimer = 0;
        mp.room = null;

        render();
      }

      if (!intentional && !mp.leaving) {
        if (wasConnected) toast(t("mp.connLost"));
        else toast(t("mp.noServer"));
      }

      mp.leaving = false;
    };
  }

  function createRoom() {
    connect("create");
  }

  function joinRoom() {
    const code = els.mpCode
      ? els.mpCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5)
      : "";

    if (code.length !== 5) {
      toast(t("mp.enterCode"));
      return;
    }

    if (els.mpCode) els.mpCode.value = code;
    connect("join", code);
  }

  function leaveRoom() {
    if (!mp.ws) {
      reset();
      return;
    }

    mp.leaving = true;
    send({ type: "leave" });
    closeSocket();
    reset();
    toast(t("mp.disconnected"));
  }

  function copyCode() {
    const code = mp.room || "";
    if (!code) return;

    function fallback() {
      try {
        const input = doc.createElement("textarea");
        input.value = code;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        doc.body.appendChild(input);
        input.select();
        doc.execCommand("copy");
        doc.body.removeChild(input);
        toast(t("mp.copied"));
      } catch {
        toast(t("mp.copyFail"));
      }
    }

    if (win.navigator.clipboard && typeof win.navigator.clipboard.writeText === "function") {
      win.navigator.clipboard
        .writeText(code)
        .then(() => toast(t("mp.copied")))
        .catch(fallback);
    } else {
      fallback();
    }
  }

  function sendEmote(emoji) {
    if (!mp.room) return;
    if (!EMOTES.includes(emoji)) return;

    send({ type: "emote", emote: emoji });

    // Kucing sendiri tidak punya node remote, jadi emote ditampilkan
    // sebagai partikel di layar.
    spawnFx(emoji, 1);

    if (onEmote) onEmote(emoji);
  }

  function open() {
    render();

    if (!supported()) toast(t("mp.serverRequired"));
  }

  function destroy() {
    win.clearInterval(mp.pingTimer);
    win.clearTimeout(mp.stateTimer);
    closeSocket();
    reset();
  }

  return {
    open,
    render,
    createRoom,
    joinRoom,
    leaveRoom,
    copyCode,
    sendEmote,
    sendState,
    petRemote,
    destroy,
    supported,
    playerCount,
    isInRoom: () => Boolean(mp.room),
    getPlayers: () => Array.from(mp.players.values()),
    getSelfId: () => mp.selfId,
    getRoom: () => mp.room,
  };
}
