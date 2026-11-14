import { ACCS } from "../src/data/accessories.js";
import { FURS } from "../src/data/furs.js";
import { sanitizeName } from "../src/core/util.js";
import {
  IDLE_MS,
  MAX_MESSAGE_BYTES,
  MAX_ROOMS,
  ROOM_IDLE_MS,
  ROOM_TTL_MS,
  WS_IP_RATE_LIMIT,
  WS_RATE_LIMIT,
  WS_RATE_WINDOW_MS,
} from "./config.js";

/*
 * Manajemen room multiplayer.
 *
 * Server tidak pernah menyimpan state lengkap pemain. Hanya data publik
 * yang dibutuhkan untuk menggambar kucing teman: nama, level, bulu,
 * aksesori, mood, tidur, dan scene.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const CODE_PATTERN = new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`);

/* Batas room yang boleh dibuat oleh satu alamat IP. */
const ROOMS_PER_IP = 5;

/* Batas percobaan gabung room per IP, supaya kode room tidak bisa ditebak. */
const JOIN_LIMIT = 30;
const JOIN_WINDOW_MS = 60_000;

/* Jeda minimal antara dua "belai" ke pemain yang sama. */
const PET_COOLDOWN_MS = 1_000;

/* Batas chat dan jeda antar pesan supaya room tidak bisa dibanjiri. */
const CHAT_MAX = 160;
const CHAT_COOLDOWN_MS = 500;

const MAX_LEVEL = 199;
const RTC_KINDS = new Set(["offer", "answer", "ice"]);

const FUR_IDS = new Set(FURS.map((item) => item.id));
const ACC_IDS = new Set(ACCS.map((item) => item.id));
const MOODS = new Set(["idle", "happy", "sad", "sleep", "eat", "bath", "play", "annoyed"]);
const EMOTES = new Set(["😺", "👋", "❤️", "✨", "🐟", "🎉", "😴", "🍀"]);
const SCENES = new Set(["inside", "outside"]);

const encoder = new TextEncoder();

function makeId() {
  return crypto.randomUUID();
}

function makeCode(rooms) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);

    let code = "";

    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }

    if (!rooms.has(code)) return code;
  }

  return "";
}

function send(socket, payload) {
  if (!socket || socket.readyState !== 1) return false;

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    // Peer sudah tertutup. Tutup juga sisi server supaya tidak menumpuk.
    try {
      socket.close();
    } catch {
      /* sudah tertutup */
    }

    return false;
  }
}

function broadcast(room, payload, exceptId) {
  for (const client of room.clients.values()) {
    if (client.id === exceptId) continue;
    send(client.socket, payload);
  }
}

function publicPlayers(room, exceptId) {
  const list = [];

  for (const client of room.clients.values()) {
    if (client.id === exceptId) continue;
    list.push({ id: client.id, state: client.state });
  }

  return list;
}

export function cleanPublicState(raw) {
  if (!raw || typeof raw !== "object") return null;

  const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(raw.level) || 1)));
  const fur = typeof raw.fur === "string" && FUR_IDS.has(raw.fur) ? raw.fur : "cream";
  const acc = typeof raw.acc === "string" && ACC_IDS.has(raw.acc) ? raw.acc : null;
  const mood = typeof raw.mood === "string" && MOODS.has(raw.mood) ? raw.mood : "idle";
  const scene = typeof raw.scene === "string" && SCENES.has(raw.scene) ? raw.scene : "inside";

  return {
    name: sanitizeName(raw.name),
    level,
    fur,
    acc,
    mood,
    sleeping: Boolean(raw.sleeping),
    scene,
  };
}

export function createRooms({ maxPlayers = 6, maxRooms = MAX_ROOMS } = {}) {
  const rooms = new Map();
  const limit = Math.max(2, Math.min(12, Math.floor(Number(maxPlayers) || 6)));
  const roomLimit = Math.max(5, Math.min(1000, Math.floor(Number(maxRooms) || MAX_ROOMS)));

  /* Pembatas laju per alamat IP (semua socket dari IP itu berbagi jatah). */
  const ipBuckets = new Map();

  /* Percobaan gabung room per IP. */
  const joinAttempts = new Map();

  function joinAllowed(ip) {
    const now = Date.now();
    const times = (joinAttempts.get(ip) || []).filter((time) => now - time < JOIN_WINDOW_MS);
    const allowed = times.length < JOIN_LIMIT;

    // Simpan paling banyak JOIN_LIMIT entri supaya percobaan yang terus
    // ditolak tidak membuat array tumbuh tanpa batas selama satu jendela.
    times.push(now);
    if (times.length > JOIN_LIMIT) times.splice(0, times.length - JOIN_LIMIT);

    joinAttempts.set(ip, times);

    if (joinAttempts.size > 5000) joinAttempts.clear();

    return allowed;
  }

  function meta(socket, ip) {
    if (!socket._mochi) {
      socket._mochi = {
        id: makeId(),
        ip: ip || "local",
        state: null,
        room: null,
        lastSeen: Date.now(),
        rateTimes: [],
      };
    }

    return socket._mochi;
  }

  function rateLimited(socket, now) {
    const data = meta(socket);
    const times = data.rateTimes.filter((time) => now - time < WS_RATE_WINDOW_MS);
    const socketLimited = times.length >= WS_RATE_LIMIT;

    times.push(now);
    if (times.length > WS_RATE_LIMIT) times.splice(0, times.length - WS_RATE_LIMIT);
    data.rateTimes = times;

    if (socketLimited) return true;

    // Batas tambahan untuk seluruh koneksi dari satu alamat IP.
    const ip = data.ip;
    const ipTimes = (ipBuckets.get(ip) || []).filter((time) => now - time < WS_RATE_WINDOW_MS);
    const ipLimited = ipTimes.length >= WS_IP_RATE_LIMIT;

    ipTimes.push(now);
    if (ipTimes.length > WS_IP_RATE_LIMIT) {
      ipTimes.splice(0, ipTimes.length - WS_IP_RATE_LIMIT);
    }
    ipBuckets.set(ip, ipTimes);

    if (ipBuckets.size > 5000) ipBuckets.clear();

    return ipLimited;
  }

  function roomsForIp(ip) {
    let count = 0;

    for (const room of rooms.values()) {
      if (room.ownerIp === ip) count += 1;
    }

    return count;
  }

  function evictOldestRoom() {
    let oldest = null;

    for (const room of rooms.values()) {
      if (!oldest || room.lastActivity < oldest.lastActivity) oldest = room;
    }

    if (!oldest) return;

    for (const client of Array.from(oldest.clients.values())) {
      leaveRoom(client.socket, false);

      try {
        client.socket.close(1000, "room replaced");
      } catch {
        /* sudah tertutup */
      }
    }

    rooms.delete(oldest.code);
  }

  function leaveRoom(socket, notify) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;

    const client = room.clients.get(data.id);

    if (client) {
      room.clients.delete(data.id);
      room.lastActivity = Date.now();
      broadcast(room, { type: "left", id: data.id }, data.id);

      if (room.hostId === data.id && room.clients.size > 0) {
        room.hostId = room.clients.values().next().value.id;
        broadcast(room, { type: "host", host: room.hostId });
      }
    }

    data.room = null;

    if (notify) send(socket, { type: "left_ack" });

    if (room.clients.size === 0) {
      rooms.delete(room.code);
    }
  }

  function enterRoom(socket, room) {
    const data = meta(socket);
    data.room = room;

    room.clients.set(data.id, {
      id: data.id,
      socket,
      state: data.state,
    });
    room.lastActivity = Date.now();

    send(socket, {
      type: "room",
      room: room.code,
      selfId: data.id,
      host: room.hostId,
      max: limit,
      joined: room.clients.size,
      left: Math.max(0, limit - room.clients.size),
      players: publicPlayers(room, data.id),
    });

    broadcast(room, { type: "joined", id: data.id, state: data.state }, data.id);
  }

  function create(socket) {
    leaveRoom(socket, false);

    const data = meta(socket);

    if (roomsForIp(data.ip) >= ROOMS_PER_IP) {
      send(socket, { type: "error", code: "rate_limit" });
      return;
    }

    // Batasi jumlah room aktif supaya penyang tidak bisa memenuhi memori.
    if (rooms.size >= roomLimit) {
      evictOldestRoom();
    }

    if (rooms.size >= roomLimit) {
      send(socket, { type: "error", code: "server_full" });
      return;
    }

    const code = makeCode(rooms);

    if (!code) {
      send(socket, { type: "error", code: "server_full" });
      return;
    }

    const room = {
      code,
      hostId: data.id,
      ownerIp: data.ip,
      clients: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    rooms.set(code, room);
    enterRoom(socket, room);
  }

  function join(socket, rawCode) {
    const code = typeof rawCode === "string" ? rawCode.toUpperCase().trim() : "";

    if (!CODE_PATTERN.test(code)) {
      send(socket, { type: "error", code: "invalid_code" });
      return;
    }

    const data = meta(socket);

    // Hitung percobaan SEBELUM mencari room. Kalau tidak, kode yang tidak
    // ada tidak pernah memakai jatah join dan bisa ditebak tanpa batas.
    if (!joinAllowed(data.ip)) {
      send(socket, { type: "error", code: "rate_limit" });
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      send(socket, { type: "error", code: "not_found" });
      return;
    }

    if (data.room === room) {
      send(socket, {
        type: "room",
        room: room.code,
        selfId: data.id,
        host: room.hostId,
        max: limit,
        joined: room.clients.size,
        left: Math.max(0, limit - room.clients.size),
        players: publicPlayers(room, data.id),
      });
      return;
    }

    if (room.clients.size >= limit) {
      send(socket, { type: "error", code: "full" });
      return;
    }

    leaveRoom(socket, false);
    enterRoom(socket, room);
  }

  function setState(socket, rawState) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;

    const state = cleanPublicState(rawState);
    if (!state) return;

    data.state = state;

    const client = room.clients.get(data.id);
    if (client) client.state = state;

    room.lastActivity = Date.now();
    broadcast(room, { type: "state", id: data.id, state }, data.id);
  }

  function emote(socket, emote) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;
    if (typeof emote !== "string" || !EMOTES.has(emote)) return;

    room.lastActivity = Date.now();
    broadcast(room, { type: "emote", id: data.id, emote }, data.id);
  }

  function chat(socket, rawText) {
    const data = meta(socket);
    const room = data.room;

    if (!room || typeof rawText !== "string") return;

    const text = rawText
      .replace(/\p{Cc}/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CHAT_MAX);

    if (!text) return;

    const now = Date.now();
    if (now - (data.lastChatAt || 0) < CHAT_COOLDOWN_MS) return;
    data.lastChatAt = now;

    const name = data.state && data.state.name ? data.state.name : "Teman";
    room.lastActivity = now;
    broadcast(room, { type: "chat", id: data.id, name, text }, data.id);
  }

  function voice(socket, on) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;

    room.lastActivity = Date.now();
    broadcast(room, { type: "voice", id: data.id, on: Boolean(on) }, data.id);
  }

  function rtc(socket, target, payload) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;
    if (typeof target !== "string" || !target || target === data.id) return;

    const friend = room.clients.get(target);
    if (!friend) return;
    if (!payload || typeof payload !== "object") return;
    if (!RTC_KINDS.has(payload.kind)) return;

    if (payload.kind === "ice") {
      if (!payload.candidate || typeof payload.candidate !== "object") return;
    } else if (!payload.sdp || typeof payload.sdp !== "object") {
      return;
    }

    room.lastActivity = Date.now();
    send(friend.socket, { type: "rtc", from: data.id, data: payload });
  }

  function pet(socket, target) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;

    const name = data.state && data.state.name ? data.state.name : "Teman";
    room.lastActivity = Date.now();

    if (typeof target === "string" && target && target !== data.id) {
      const friend = room.clients.get(target);

      if (friend) {
        // Cegah spam belai ke satu pemain.
        const now = Date.now();
        const last = friend.pettedAt || 0;

        if (now - last < PET_COOLDOWN_MS) return;

        friend.pettedAt = now;

        send(friend.socket, {
          type: "petted",
          from: data.id,
          target: friend.id,
          name,
        });
      }

      return;
    }

    broadcast(room, { type: "petted", from: data.id, name }, data.id);
  }

  function message(socket, raw, ip) {
    if (typeof raw !== "string") {
      send(socket, { type: "error", code: "bad_message" });
      return;
    }

    if (raw.length > MAX_MESSAGE_BYTES || encoder.encode(raw).byteLength > MAX_MESSAGE_BYTES) {
      send(socket, { type: "error", code: "message_too_large" });

      // Pesan oversized sudah dibuffer transport, jadi socket ditutup biar
      // tidak dipakai untuk flood berikutnya.
      try {
        socket.close(1009, "message too large");
      } catch {
        /* sudah tertutup */
      }

      return;
    }

    const data = meta(socket, ip);
    const now = Date.now();

    // Aktivitas selalu dihitung,even kalau pesannya lebih dari batas laju,
    // supaya pemain yang aktif tidak dianggap idle.
    data.lastSeen = now;

    if (rateLimited(socket, now)) {
      send(socket, { type: "error", code: "rate_limit" });
      return;
    }

    let payload;

    try {
      payload = JSON.parse(raw);
    } catch {
      send(socket, { type: "error", code: "bad_json" });
      return;
    }

    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      return;
    }

    if (data.room) data.room.lastActivity = now;

    switch (payload.type) {
      case "create":
        create(socket);
        break;
      case "join":
        join(socket, payload.room);
        break;
      case "state":
        setState(socket, payload.state);
        break;
      case "emote":
        emote(socket, payload.emote);
        break;
      case "chat":
        chat(socket, payload.text);
        break;
      case "voice":
        voice(socket, payload.on);
        break;
      case "rtc":
        rtc(socket, payload.to, payload.data);
        break;
      case "pet":
        pet(socket, payload.target);
        break;
      case "leave":
        leaveRoom(socket, true);
        break;
      case "ping":
        send(socket, { type: "pong" });
        break;
      default:
        break;
    }
  }

  function open(socket, ip) {
    meta(socket, ip);
    send(socket, { type: "hello", id: meta(socket, ip).id });
  }

  function close(socket) {
    leaveRoom(socket, false);
  }

  function cleanup() {
    const now = Date.now();

    for (const room of rooms.values()) {
      const stale = [];

      for (const client of room.clients.values()) {
        const last = client.socket._mochi ? client.socket._mochi.lastSeen : now;
        if (now - last > IDLE_MS) stale.push(client);
      }

      for (const client of stale) {
        leaveRoom(client.socket, false);

        try {
          client.socket.close(1000, "idle");
        } catch {
          /* sudah tertutup */
        }
      }

      const expired = now - room.createdAt > ROOM_TTL_MS;
      const inactive = now - room.lastActivity > ROOM_IDLE_MS;

      if (room.clients.size === 0 || expired || inactive) {
        for (const client of Array.from(room.clients.values())) {
          leaveRoom(client.socket, false);

          try {
            client.socket.close(1000, "room expired");
          } catch {
            /* sudah tertutup */
          }
        }

        rooms.delete(room.code);
      }
    }
  }

  function startCleanup() {
    return setInterval(() => {
      try {
        cleanup();
      } catch (error) {
        // Interval yang melempar akan menghentikan seluruh server.
        console.error("Kesalahan cleanup room:", error instanceof Error ? error.message : error);
      }
    }, 30_000);
  }

  return {
    maxPlayers: limit,
    open,
    message,
    close,
    cleanup,
    startCleanup,
    stats: () => ({
      rooms: rooms.size,
      players: Array.from(rooms.values()).reduce((total, room) => total + room.clients.size, 0),
    }),
  };
}
