# Mochi — virtual cat web game.
#
# Image ini hanya berisi runtime + source. Build:
#   docker build -t mochi .
# Jalankan:
#   docker run -d --name mochi -p 127.0.0.1:8000:8000 -v mochi-data:/app/data mochi

FROM denoland/deno:2.9.8

WORKDIR /app

COPY --chown=deno:deno . .

RUN mkdir -p /app/data && chown -R deno:deno /app/data

USER deno

ENV PORT=8000 \
    HOST=0.0.0.0 \
    KV_PATH=/app/data/kv.sqlite3 \
    DENO_DIR=/deno-dir \
    DENO_NO_UPDATE_CHECK=1

EXPOSE 8000

# Health check memakai runtime yang sudah ada di image, jadi tidak perlu
# curl/wget terpisah.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD deno eval --quiet --allow-net --allow-env=PORT \
    'const port = Deno.env.get("PORT") || "8000"; const res = await fetch(`http://127.0.0.1:${port}/api/health`); if (!res.ok) Deno.exit(1);'

# Izin Deno dipersempit: baca hanya /app, tulis hanya /app/data (+ cache),
# dan env yang boleh dibaca dibatasi. App hanya butuh ini.
CMD ["run", \
  "--no-prompt", \
  "--allow-net", \
  "--allow-read=/app", \
  "--allow-write=/app/data,/deno-dir", \
  "--allow-env=PORT,HOST,MAX_PLAYERS,MAX_ROOMS,MAX_CONNECTIONS,MAX_CONNECTIONS_PER_IP,WS_IP_RATE_LIMIT,KV_PATH,DENO_DEPLOYMENT_ID,PUBLIC_ORIGIN,TRUSTED_PROXIES,CLOUD_CREATE_WINDOW_MS,ROOM_IDLE_MS,CLOUD_MAX_RECORDS", \
  "--unstable-kv", \
  "server.js"]
