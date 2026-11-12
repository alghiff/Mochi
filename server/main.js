import { HOST, MAX_PLAYERS, PORT, ROOT } from "./config.js";
import { handleCloud } from "./cloud.js";
import { createRooms } from "./rooms.js";
import { jsonResponse, originAllowed, textResponse } from "./security.js";
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

const rooms = createRooms({ maxPlayers: MAX_PLAYERS });
rooms.startCleanup();

function hostOf(req) {
  try {
    return new URL(req.url).host;
  } catch {
    return "";
  }
}

async function handleRequest(req) {
  const host = hostOf(req);
  const url = new URL(req.url);

  if (url.pathname === "/ws") {
    return handleWebSocket(req, rooms, host);
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
        maxPlayers: rooms.maxPlayers
      },
      host
    );
  }

  if (url.pathname === "/api/cloud") {
    if (!originAllowed(req)) {
      return jsonResponse(403, { error: "origin_not_allowed" }, host);
    }

    return handleCloud(req, host);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return textResponse(405, "Method not allowed", host, { Allow: "GET, HEAD" });
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse(404, { error: "not_found" }, host);
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
      console.log("Tekan Ctrl+C untuk berhenti.");
    }
  },
  handleRequest
);
