import { ACCS } from "../src/data/accessories.js";
import { FURS } from "../src/data/furs.js";
import { sanitizeName } from "../src/core/util.js";
import { IDLE_MS, MAX_MESSAGE_BYTES, ROOM_TTL_MS, WS_RATE_LIMIT, WS_RATE_WINDOW_MS } from "./config.js";

/*
 * Manajemen room multiplayer.
 *
 * Server tidak pernah menyimpan state lengkap pemain. Hanya data publik
 * yang dibutuhkan untuk menggambar kucing teman: nama, level, bulu,
 * aksesori, mood, tidur, dan scene.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

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
  if (!socket || socket.readyState !== 1) return;

  try {
    socket.send(JSON.stringify(payload));
  } catch {
    /* socket sudah tertutup */
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

  const level = Math.min(99, Math.max(1, Math.floor(Number(raw.level) || 1)));
  const fur = typeof raw.fur === "string" && FUR_IDS.has(raw.fur) ? raw.fur : "cream";
  const acc = typeof raw.acc === "string" && ACC_IDS.has(raw.acc) ? raw.acc : null;
  const mood = typeof raw.mood === "string" && MOODS.has(raw.mood) ? raw.mood : "idle";
  const scene = raw.scene === "outside" ? "outside" : "inside";

  return {
    name: sanitizeName(raw.name),
    level,
    fur,
    acc,
    mood,
    sleeping: Boolean(raw.sleeping),
    scene
  };
}

export function createRooms({ maxPlayers = 6 } = {}) {
  const rooms = new Map();
  const limit = Math.max(2, Math.min(12, Math.floor(Number(maxPlayers) || 6)));

  function meta(socket) {
    if (!socket._mochi) {
      socket._mochi = {
        id: makeId(),
        state: null,
        room: null,
        lastSeen: Date.now(),
        rateTimes: []
      };
    }

    return socket._mochi;
  }

  function rateLimited(socket, now) {
    const data = meta(socket);
    const times = data.rateTimes.filter((time) => now - time < WS_RATE_WINDOW_MS);
    times.push(now);
    data.rateTimes = times;

    return times.length > WS_RATE_LIMIT;
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
      joinedAt: Date.now()
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
      players: publicPlayers(room, data.id)
    });

    broadcast(room, { type: "joined", id: data.id, state: data.state }, data.id);
  }

  function create(socket) {
    leaveRoom(socket, false);

    const data = meta(socket);
    const code = makeCode(rooms);

    if (!code) {
      send(socket, { type: "error", code: "server_full" });
      return;
    }

    const room = {
      code,
      hostId: data.id,
      clients: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    rooms.set(code, room);
    enterRoom(socket, room);
  }

  function join(socket, rawCode) {
    const code = typeof rawCode === "string" ? rawCode.toUpperCase().trim() : "";

    if (!new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(code)) {
      send(socket, { type: "error", code: "invalid_code" });
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      send(socket, { type: "error", code: "not_found" });
      return;
    }

    const data = meta(socket);

    if (data.room === room) {
      send(socket, {
        type: "room",
        room: room.code,
        selfId: data.id,
        host: room.hostId,
        max: limit,
        joined: room.clients.size,
        left: Math.max(0, limit - room.clients.size),
        players: publicPlayers(room, data.id)
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

  function pet(socket, target) {
    const data = meta(socket);
    const room = data.room;

    if (!room) return;

    const name = data.state && data.state.name ? data.state.name : "Teman";
    room.lastActivity = Date.now();

    if (typeof target === "string" && target && target !== data.id) {
      const friend = room.clients.get(target);

      if (friend) {
        send(friend.socket, {
          type: "petted",
          from: data.id,
          target: friend.id,
          name
        });
      }

      return;
    }

    broadcast(room, { type: "petted", from: data.id, name }, data.id);
  }

  function message(socket, raw) {
    if (typeof raw !== "string") {
      send(socket, { type: "error", code: "bad_message" });
      return;
    }

    if (raw.length > MAX_MESSAGE_BYTES || encoder.encode(raw).byteLength > MAX_MESSAGE_BYTES) {
      send(socket, { type: "error", code: "message_too_large" });
      return;
    }

    const data = meta(socket);
    const now = Date.now();

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

    data.lastSeen = now;

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

  function open(socket) {
    meta(socket);
    send(socket, { type: "hello", id: meta(socket).id });
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

      if (room.clients.size === 0 || now - room.createdAt > ROOM_TTL_MS) {
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
    return setInterval(cleanup, 30_000);
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
      players: Array.from(rooms.values()).reduce((total, room) => total + room.clients.size, 0)
    })
  };
}
