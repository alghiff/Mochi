import { HOST, MAX_PLAYERS, MAX_ROOMS, PORT, PUBLIC_ORIGIN, ROOT } from "./config.js";
import { handleCloud, startCountRefresh } from "./cloud.js";
import { createRooms } from "./rooms.js";
import { clientKey, hostAllowed, jsonResponse, originAllowed, textResponse } from "./security.js";
import { serveStatic } from "./static.js";
import { handleWebSocket } from "./ws.js";

/*
 * Titik masuk HTTP.
 *
 * Rute:
 *   GET  /                 game
 *   GET  /styles/*.css     stylesheet
 *   GET  /src/**\/*.js     modul game
 *   GET  /ws               WebSocket multiplayer
 *   POST /api/cloud        cloud save
 *   GET  /api/health       cek server
 */

const rooms = createRooms({ maxPlayers: MAX_PLAYERS, maxRooms: MAX_ROOMS });
rooms.startCleanup();
startCountRefresh();

function handleRequest(req, connInfo) {
  let url;

  try {
    url = new URL(req.url);
  } catch {
    return textResponse(400, "Bad request", "");
  }

  const host = url.host;

  // Dengan PUBLIC_ORIGIN, hanya Host yang cocok yang dilayani.
  if (!hostAllowed(req)) {
    return textResponse(421, "Misdirected Request", host);
  }

  const client = clientKey(req, connInfo);

  if (url.pathname === "/ws") {
    return handleWebSocket(req, rooms, host, client);
  }

  if (url.pathname === "/api/health") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return jsonResponse(405, { error: "method_not_allowed" }, host, { Allow: "GET, HEAD" });
    }

    const stats = rooms.stats();

    return jsonResponse(
      200,
      {
        ok: true,
        rooms: stats.rooms,
        players: stats.players,
        maxPlayers: rooms.maxPlayers,
      },
      host,
    );
  }

  if (url.pathname === "/api/cloud") {
    if (!originAllowed(req)) {
      return jsonResponse(403, { error: "origin_not_allowed" }, host);
    }

    return handleCloud(req, host, client);
  }

  if (url.pathname.startsWith("/api/")) {
    // Rute API yang tidak dikenal selalu 404, apa pun metodenya.
    return jsonResponse(404, { error: "not_found" }, host);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return textResponse(405, "Method not allowed", host, { Allow: "GET, HEAD" });
  }

  return serveStatic(req, ROOT, host);
}

Deno.serve(
  {
    port: PORT,
    hostname: HOST,
    onListen: ({ hostname, port }) => {
      console.log(`Mochi berjalan di http://${hostname}:${port}`);
      console.log(`Multiplayer maksimal ${rooms.maxPlayers} pemain per room.`);

      if (!PUBLIC_ORIGIN) {
        console.warn(
          "PERINGATAN: PUBLIC_ORIGIN kosong atau tidak valid. Pemeriksaan " +
            "Host/Origin memakai header permintaan (mode pengembangan). " +
            "Isi PUBLIC_ORIGIN dengan origin lengkap, mis. https://mochi.example.com.",
        );
      }

      console.log("Tekan Ctrl+C untuk berhenti.");
    },
    // Jangan biarkan error tak tertangani menjatuhkan seluruh server.
    onError: (error) => {
      console.error("Kesalahan permintaan:", error instanceof Error ? error.message : error);
      return jsonResponse(500, { error: "internal_error" }, "");
    },
  },
  handleRequest,
);
