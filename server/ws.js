import { MAX_CONNECTIONS, MAX_CONNECTIONS_PER_IP } from "./config.js";
import { originAllowed, textResponse } from "./security.js";

/*
 * Upgrade WebSocket. Origin diperiksa agar halaman dari domain lain
 * tidak bisa membuka koneksi ke room memakai cookie/konteks browser.
 *
 * Jumlah koneksi dibatasi supaya penyerang tidak bisa membuka ribuan socket
 * cuma untuk mengirim pesan beruntun. Batas per-IP juga ada supaya satu
 * sumber tidak bisa mengambil semua slot.
 */
const openSockets = new Map();
let totalSockets = 0;

function socketCount(ip) {
  return openSockets.get(ip) || 0;
}

export function handleWebSocket(req, rooms, host, client) {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return textResponse(426, "WebSocket required", host);
  }

  if (!originAllowed(req)) {
    return textResponse(403, "Origin not allowed", host);
  }

  const ip = client || "local";

  // openSockets menyimpan jumlah per-IP; batas global harus menghitung
  // total socket, bukan jumlah alamat IP.
  if (totalSockets >= MAX_CONNECTIONS) {
    return textResponse(503, "Too many connections", host, { "Retry-After": "5" });
  }

  if (socketCount(ip) >= MAX_CONNECTIONS_PER_IP) {
    return textResponse(429, "Too many connections from this address", host, {
      "Retry-After": "10",
    });
  }

  let pair;

  try {
    pair = Deno.upgradeWebSocket(req);
  } catch {
    return textResponse(400, "WebSocket upgrade failed", host);
  }

  const { socket, response } = pair;

  openSockets.set(ip, socketCount(ip) + 1);
  totalSockets += 1;

  let closed = false;

  function release() {
    if (closed) return;
    closed = true;

    totalSockets = Math.max(0, totalSockets - 1);

    const left = socketCount(ip) - 1;

    if (left > 0) openSockets.set(ip, left);
    else openSockets.delete(ip);
  }

  socket.onopen = () => rooms.open(socket, ip);

  socket.onmessage = (event) => rooms.message(socket, event.data, ip);

  socket.onclose = () => {
    release();
    rooms.close(socket);
  };

  socket.onerror = () => {
    release();
    rooms.close(socket);
  };

  return response;
}

export function connectionStats() {
  return { total: totalSockets, addresses: openSockets.size };
}
