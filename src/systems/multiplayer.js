import { accById } from "../data/accessories.js";
import { FURS } from "../data/furs.js";
import { sanitizeName } from "../core/util.js";

const EMOTES = ["😺", "👋", "❤️", "✨", "🐟", "🎉", "😴", "🍀"];
const CHAT_EMOJIS = [
  "😺",
  "👋",
  "❤️",
  "✨",
  "🐟",
  "🎉",
  "😴",
  "🍀",
  "😂",
  "🥺",
  "👍",
  "🙌",
  "🔥",
  "🌈",
  "🍰",
  "🎁",
  "💬",
  "🐾",
];
const MAX_LEVEL = 199;
const CHAT_MAX = 160;
const CHAT_LOG_MAX = 60;
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
    level: Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(raw.level) || 1))),
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
  onChat,
  getMicStream,
  isMicActive,
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
    voice: false,
  };

  const nodes = new Map();
  const emoteTimers = new Map();
  const peers = new Map();

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

  /* ---------- Chat ---------- */

  function cleanChatText(raw) {
    return String(raw == null ? "" : raw)
      .replace(/\p{Cc}/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CHAT_MAX);
  }

  function addChat(id, name, rawText, mine) {
    if (!els.chatLog) return;

    const text = cleanChatText(rawText);
    if (!text) return;

    const item = doc.createElement("p");
    item.className = "chat-msg" + (mine ? " is-mine" : "");
    if (id) item.setAttribute("data-player", String(id));

    const who = doc.createElement("b");
    who.textContent = sanitizeName(name) || "Teman";

    const body = doc.createElement("span");
    body.textContent = text;

    item.appendChild(who);
    item.appendChild(body);
    els.chatLog.appendChild(item);

    while (els.chatLog.children.length > CHAT_LOG_MAX) {
      els.chatLog.removeChild(els.chatLog.firstChild);
    }

    els.chatLog.scrollTop = els.chatLog.scrollHeight;
  }

  function sendChat(raw) {
    if (!mp.room) return false;

    const text = cleanChatText(raw);
    if (!text) return false;
    if (!send({ type: "chat", text })) return false;

    addChat(mp.selfId, getState().name, text, true);
    if (onChat) onChat(text);
    return true;
  }

  function insertEmoji(emoji) {
    if (!els.chatInput || !CHAT_EMOJIS.includes(emoji)) return;

    els.chatInput.value = (els.chatInput.value + emoji).slice(0, CHAT_MAX);
    els.chatInput.focus();
  }

  function toggleEmojiPicker(force) {
    if (!els.emojiPicker) return;

    const show = force === undefined ? els.emojiPicker.hidden : Boolean(force);
    els.emojiPicker.hidden = !show;

    if (els.chatEmojiBtn) {
      els.chatEmojiBtn.setAttribute("aria-expanded", show ? "true" : "false");
    }
  }

  function bindChat() {
    if (els.chatForm) {
      els.chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!els.chatInput) return;

        if (sendChat(els.chatInput.value)) {
          els.chatInput.value = "";
          toggleEmojiPicker(false);
          if (sfx) sfx("chat");
        }
      });
    }

    if (els.chatEmojiBtn) {
      els.chatEmojiBtn.addEventListener("click", (event) => {
        event.preventDefault();
        toggleEmojiPicker();
      });
    }

    if (els.emojiPicker) {
      els.emojiPicker.textContent = "";

      for (const emoji of CHAT_EMOJIS) {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "emoji-choice";
        button.setAttribute("data-emoji", emoji);
        button.setAttribute("aria-label", emoji);
        button.textContent = emoji;
        els.emojiPicker.appendChild(button);
      }

      els.emojiPicker.addEventListener("click", (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return;

        const button = target.closest("[data-emoji]");
        if (!button) return;

        insertEmoji(button.getAttribute("data-emoji"));
      });
    }

    doc.addEventListener("click", (event) => {
      if (!els.emojiPicker || els.emojiPicker.hidden) return;

      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest(".mp-chat")) return;

      toggleEmojiPicker(false);
    });
  }

  /* ---------- Voice chat (WebRTC mesh) ---------- */

  function voiceSupported() {
    return Boolean(win.RTCPeerConnection);
  }

  function micStream() {
    return getMicStream ? getMicStream() : null;
  }

  function micOn() {
    return isMicActive ? Boolean(isMicActive()) : false;
  }

  function audioFor(id) {
    if (!els.mpAudio) return null;

    for (const child of Array.from(els.mpAudio.children)) {
      if (child.getAttribute("data-peer") === id) return child;
    }

    const audio = doc.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.setAttribute("data-peer", id);
    els.mpAudio.appendChild(audio);
    return audio;
  }

  function closePeer(id) {
    const peer = peers.get(id);
    if (!peer) return;

    peers.delete(id);

    try {
      peer.pc.close();
    } catch {
      /* koneksi sudah tertutup */
    }

    if (peer.audio && peer.audio.parentNode) {
      peer.audio.parentNode.removeChild(peer.audio);
    }
  }

  function closeAllPeers() {
    for (const id of Array.from(peers.keys())) closePeer(id);
  }

  function ensurePeer(id) {
    const existing = peers.get(id);
    if (existing) return existing;
    if (!voiceSupported()) return null;

    let pc;

    try {
      pc = new win.RTCPeerConnection({ iceServers: [] });
    } catch {
      return null;
    }

    const peer = { pc, audio: audioFor(id), pending: [] };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      send({
        type: "rtc",
        to: id,
        data: { kind: "ice", candidate: event.candidate.toJSON ? event.candidate.toJSON() : {} },
      });
    };

    pc.ontrack = (event) => {
      if (!peer.audio) return;

      const stream = event.streams && event.streams[0] ? event.streams[0] : null;

      if (stream) peer.audio.srcObject = stream;
      else if (win.MediaStream) peer.audio.srcObject = new win.MediaStream([event.track]);

      const played = peer.audio.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        closePeer(id);
      }
    };

    const stream = micStream();

    if (stream) {
      for (const track of stream.getAudioTracks()) {
        try {
          pc.addTrack(track, stream);
        } catch {
          /* track tidak bisa ditambahkan */
        }
      }
    }

    peers.set(id, peer);
    return peer;
  }

  async function offerTo(id) {
    if (!mp.room || !mp.players.has(id)) return;

    // Saat mic dinyalakan ulang, koneksi lama dibuang lalu dibuat baru.
    // Ini menghindari renegosiasi yang rumit dan tetap kompatibel dengan
    // semua browser modern.
    const existing = peers.get(id);
    if (existing && (existing.pc.remoteDescription || existing.pc.signalingState !== "stable")) {
      closePeer(id);
    }

    const peer = ensurePeer(id);
    if (!peer) return;

    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);

      send({
        type: "rtc",
        to: id,
        data: { kind: "offer", sdp: peer.pc.localDescription },
      });
    } catch {
      closePeer(id);
    }
  }

  async function drainCandidates(peer) {
    const queued = peer.pending.splice(0);

    for (const candidate of queued) {
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch {
        /* kandidat sudah tidak relevan */
      }
    }
  }

  async function handleRtc(from, data) {
    if (!mp.players.has(from) || !data || typeof data !== "object") return;

    if (data.kind === "offer") {
      if (!data.sdp || typeof data.sdp !== "object") return;

      closePeer(from);
      const peer = ensurePeer(from);
      if (!peer) return;

      try {
        await peer.pc.setRemoteDescription(data.sdp);
        await drainCandidates(peer);

        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);

        send({
          type: "rtc",
          to: from,
          data: { kind: "answer", sdp: peer.pc.localDescription },
        });
      } catch {
        closePeer(from);
      }

      return;
    }

    if (data.kind === "answer") {
      const peer = peers.get(from);
      if (!peer || !data.sdp) return;

      try {
        await peer.pc.setRemoteDescription(data.sdp);
        await drainCandidates(peer);
      } catch {
        closePeer(from);
      }

      return;
    }

    if (data.kind === "ice") {
      const peer = peers.get(from);
      if (!peer || !data.candidate) return;

      if (!peer.pc.remoteDescription) {
        peer.pending.push(data.candidate);
        return;
      }

      try {
        await peer.pc.addIceCandidate(data.candidate);
      } catch {
        /* kandidat ICE tidak valid atau sudah lewat */
      }
    }
  }

  function syncVoice() {
    if (!mp.room) {
      closeAllPeers();
      return;
    }

    if (!micOn()) {
      send({ type: "voice", on: false });
      closeAllPeers();
      return;
    }

    // Umumkan bahwa mic menyala. Pemain dengan ID lebih kecil menjadi
    // pihak yang membuat penawaran supaya tidak terjadi tabrakan offer.
    send({ type: "voice", on: true });

    for (const id of mp.players.keys()) {
      if (mp.selfId && mp.selfId < id) offerTo(id);
    }
  }

  function setMicActive(active) {
    const on = Boolean(active);
    if (mp.voice === on) return;

    mp.voice = on;

    if (!mp.room) {
      closeAllPeers();
      return;
    }

    if (on) syncVoice();
    else {
      send({ type: "voice", on: false });
      closeAllPeers();
    }
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

      // Definisi SVG tidak perlu diduplikasi; pakai definisi yang sudah ada
      // di dokumen supaya id tidak bentrok.
      const defs = body.querySelector("defs");
      if (defs) defs.remove();
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

    const total = nodes.size;
    const stageWidth = els.stage && els.stage.clientWidth
      ? els.stage.clientWidth
      : Math.min(640, Math.max(280, (win.innerWidth || 800) * 0.9));

    /*
     * Semua kucing teman duduk dalam satu baris horizontal. Ukurannya
     * mengecil saat pemain bertambah, lalu kembali normal saat room sepi.
     */
    const mainWidth = total === 0
      ? 0
      : Math.min(stageWidth * (total >= 6 ? 0.3 : total >= 3 ? 0.34 : 0.4), 200);
    const gap = total >= 6 ? 2 : total >= 3 ? 4 : 8;
    const available = Math.max(40, stageWidth - mainWidth - gap * (total + 1) - 12);
    const size = total === 0 ? 140 : Math.max(30, Math.min(150, available / total));
    const tiny = size < 58;

    els.remoteCats.style.setProperty("--remote-w", size.toFixed(1) + "px");
    els.remoteCats.style.setProperty("--remote-gap", gap + "px");
    els.remoteCats.classList.toggle("is-tiny", tiny);

    if (els.stage) {
      els.stage.style.setProperty("--main-w", mainWidth.toFixed(1) + "px");
    }

    for (const node of nodes.values()) {
      node.style.setProperty("--name-size", tiny ? ".42rem" : size < 92 ? ".48rem" : ".55rem");
      node.style.setProperty("--name-w", Math.max(54, Math.round(size * 1.35)) + "px");
    }
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

    if (els.mpVoiceSwitch) {
      els.mpVoiceSwitch.disabled = !inRoom || !voiceSupported();
    }

    if (els.mpVoiceStatus && !voiceSupported()) {
      els.mpVoiceStatus.textContent = t("mp.voiceUnsupported");
    }

    if (els.chatInput) els.chatInput.disabled = !inRoom;
    if (els.chatSend) els.chatSend.disabled = !inRoom;

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

      mp.voice = micOn();
      startPing();
      render();
      sendState();
      syncVoice();
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

      // Kalau mic menyala, beri tahu pemain baru dan mulai koneksi suara.
      if (micOn()) {
        send({ type: "voice", on: true });
        if (mp.selfId && mp.selfId < id) offerTo(id);
      }

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

      closePeer(id);

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

    if (msg.type === "chat") {
      if (!mp.room) return;

      addChat(
        String(msg.id || ""),
        msg.name ? String(msg.name) : "Teman",
        msg.text,
        false,
      );
      if (sfx) sfx("chat");
      return;
    }

    if (msg.type === "voice") {
      const id = String(msg.id || "");
      if (!id || id === mp.selfId) return;

      if (msg.on) {
        // ID lebih kecil membuat offer, termasuk saat mic lokal sedang mati
        // supaya suara teman tetap bisa didengar.
        if (mp.selfId && mp.selfId < id) offerTo(id);
      } else {
        closePeer(id);
      }

      return;
    }

    if (msg.type === "rtc") {
      handleRtc(String(msg.from || ""), msg.data);
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

    closeAllPeers();
    if (els.chatLog) els.chatLog.textContent = "";
    toggleEmojiPicker(false);

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
    closeAllPeers();
    mp.players.clear();
    mp.room = null;
    mp.connected = false;
    mp.connecting = true;
    if (els.chatLog) els.chatLog.textContent = "";
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
        closeAllPeers();
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
    win.clearTimeout(resizeTimer);
    closeSocket();
    closeAllPeers();
    reset();
  }

  bindChat();

  let resizeTimer = 0;
  win.addEventListener("resize", () => {
    win.clearTimeout(resizeTimer);
    resizeTimer = win.setTimeout(layout, 120);
  });

  return {
    open,
    render,
    createRoom,
    joinRoom,
    leaveRoom,
    copyCode,
    sendEmote,
    sendChat,
    sendState,
    petRemote,
    setMicActive,
    destroy,
    supported,
    playerCount,
    isInRoom: () => Boolean(mp.room),
    isVoiceSupported: voiceSupported,
    getPlayers: () => Array.from(mp.players.values()),
    getSelfId: () => mp.selfId,
    getRoom: () => mp.room,
  };
}
