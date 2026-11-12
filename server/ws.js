import { originAllowed, textResponse } from "./security.js";

/*
 * Upgrade WebSocket. Origin diperiksa agar halaman dari domain lain
 * tidak bisa membuka koneksi ke room memakai cookie/konteks browser.
 */
export function handleWebSocket(req, rooms, host) {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return textResponse(426, "WebSocket required", host);
  }

  if (!originAllowed(req)) {
    return textResponse(403, "Origin not allowed", host);
  }

  let pair;

  try {
    pair = Deno.upgradeWebSocket(req);
  } catch {
    return textResponse(400, "WebSocket upgrade failed", host);
  }

  const { socket, response } = pair;

  socket.onopen = () => rooms.open(socket);
  socket.onmessage = (event) => rooms.message(socket, event.data);
  socket.onclose = () => rooms.close(socket);
  socket.onerror = () => rooms.close(socket);

  return response;
}
