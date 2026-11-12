FROM denoland/deno:2.9.8

WORKDIR /app

COPY --chown=deno:deno . .

RUN mkdir -p /app/data && chown -R deno:deno /app/data

USER deno

ENV PORT=8000 \
    HOST=0.0.0.0 \
    KV_PATH=/app/data/kv.sqlite3

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--unstable-kv", "server.js"]
