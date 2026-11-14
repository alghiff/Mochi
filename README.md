# Mochi — Kucing Virtual (Web Game)

[![CI](https://github.com/alghiff/Mochi/actions/workflows/ci.yml/badge.svg)](https://github.com/alghiff/Mochi/actions/workflows/ci.yml)

Game web untuk merawat kucing virtual bernama **Mochi**. Bisa dimainkan sendiri
atau bareng teman lewat multiplayer online. Visual, animasi, dan efek suara
dibuat dengan HTML, CSS, SVG, dan Web Audio API; lagu latar memakai file MP3 di
`assets/`. Tidak ada framework atau dependensi runtime eksternal.

- **Toko & progres** — koin, level (maksimal 199), XP, 8 warna bulu, 30 aksesori.
- **Hadiah level** — +10 koin tiap level, bonus tiap kelipatan 10, dan aksesori acak tiap kelipatan 25.
- **Musik latar** — lagu piano dari `assets/`, dengan toggle dan slider volume.
- **Cuaca hidup** — 5 cuaca bergilir tiap 5 menit, +3 koin tiap pergantian, partikel di taman.
- **Misi harian & mingguan** — 6 misi harian dan 7 misi mingguan dengan hadiah koin/XP.
- **Multiplayer** — satu room sampai 6 pemain (bisa diatur), chat teks, emoji, dan voice chat.
- **Cloud save** — pindah perangkat dengan kode rahasia 12 karakter.
- **Responsif** — ponsel, tablet, dan desktop. Bahasa Indonesia, Jepang, Korea, Inggris.

## Jalankan

Butuh [Deno](https://deno.com/) 2.x.

```bash
deno task start
```

Buka `http://localhost:8000`.

Untuk pengembangan dengan auto-reload:

```bash
deno task dev
```

Port dan jumlah pemain bisa diganti lewat environment variable:

```bash
PORT=8787 MAX_PLAYERS=8 deno task start
```

> Multiplayer, cloud save, dan mikrofon **tidak bekerja** kalau `index.html`
> dibuka langsung lewat `file://`. Jalankan lewat server di atas. Mikrofon juga
> butuh HTTPS (atau `localhost`) sesuai aturan browser.

Cek tipe dan sintaks:

```bash
deno task check
```

Cek kualitas kode (lint + format + tipe) dan jalankan test:

```bash
deno task verify   # lint + fmt --check + deno check
deno task test     # smoke test server + cek terjemahan
```

`deno task test` menyalakan server sungguhan di port acak lalu memeriksa
allowlist file, Range untuk audio, endpoint cloud, rate limit, dan
validasi `PUBLIC_ORIGIN`. Tidak butuh browser dan tidak menyentuh data asli.

### Cek server yang sedang aktif

Saat server berjalan, buka `http://localhost:8000` (atau port yang kamu pakai).
Untuk melihat statusnya tanpa membuka game:

```bash
curl http://localhost:8000/api/health
```

Contoh hasil:

```json
{"ok":true,"rooms":0,"players":0,"maxPlayers":6}
```

`rooms` adalah jumlah room multiplayer aktif, `players` jumlah pemain yang
sedang terhubung. Untuk melihat proses dan port yang dipakai:

```bash
ss -ltnp | grep -E '8000|8787'
```

Saat pengembangan, jalankan `deno task dev` di terminal supaya log server
(auto-reload, error, dan permintaan) terlihat langsung. Buka DevTools browser
(Console/Network) untuk melihat log klien dan request lagu.

## Kontrol

| Aksi | Cara |
| --- | --- |
| Elus Mochi | Tekan dan **geser** di atas kucing |
| Ganggu Mochi | Klik/tap sekali (kucing jadi kesal sebentar) |
| Makan | Tombol 🥣, pilih menu |
| Mandi | Tombol 🫧 |
| Main | Tombol 🐟, tangkap ikan dalam 20 detik |
| Tidur / bangun | Tombol 🌙 |
| Gaya & toko | Tombol 👕 |
| Keluar / masuk rumah | Tombol 🌿 |
| Tangkap kupu-kupu | Klik kupu-kupu saat berada di taman |
| Misi harian | Tombol 🎯 di kanan atas |
| Multiplayer | Tombol 👥 di kanan atas |
| Pengaturan | Tombol ⚙️ di kanan atas |

Pembelian di toko selalu menampilkan konfirmasi dulu; koin baru dipotong setelah
kamu menekan **Beli**. Item yang sudah dimiliki bisa langsung dipakai/dilepas.

Scene dan bahasa juga bisa diatur lewat query string:

```
http://localhost:8000/?scene=outside&lang=ja
```

## Cuaca, misi, dan toko musiman

Cuaca berganti otomatis setiap **5 menit** dengan urutan:

```
spring (🌸) → hot (☀️) → autumn (🍂) → rain (🌧️) → snow (❄️) → ...
```

Setiap pergantian cuaca memberi **+3 koin**. Kalau tab ditutup cukup lama,
semua siklus yang terlewat dihitung sekaligus (dengan batas aman) saat game
dibuka lagi. Cuaca hanya memengaruhi **taman**. Di dalam rumah, jendela
menampilkan cuaca yang sama (hujan di luar juga terlihat di jendela), tapi
kucing tetap nyaman. Hujan, salju, daun, dan kelopak bunga dirender sebagai
partikel CSS.

Misi harian direset berdasarkan tanggal lokal perangkat. Misi mingguan
direset setiap **Senin** pukul 00.00 waktu lokal. Satu aksi (mis. memberi
makan) menambah progres misi harian dan mingguan sekaligus.

Hadiah misi harian:

| Misi | Target | Koin | XP |
| --- | --- | --- | --- |
| Makan | 3× | 15 | 10 |
| Mandi | 1× | 10 | 6 |
| Main tangkap ikan | 1× | 20 | 15 |
| Elus | 12× | 12 | 8 |
| Tangkap kupu-kupu | 5× | 18 | 10 |
| Kirim emoji di multiplayer | 1× | 15 | 8 |

Hadiah misi mingguan:

| Misi | Target | Koin | XP |
| --- | --- | --- | --- |
| Makan | 15× | 80 | 40 |
| Mandi | 5× | 60 | 30 |
| Main tangkap ikan | 5× | 90 | 50 |
| Elus | 60× | 70 | 35 |
| Tangkap kupu-kupu | 20× | 80 | 40 |
| Kirim emoji di multiplayer | 5× | 60 | 30 |
| Kirim pesan chat | 10× | 50 | 25 |

Lima aksesori musiman hanya bisa dibeli saat cuacanya sedang aktif:
`flowercrown` (spring), `sunhat` (hot), `leafcrown` (autumn), `raincoat` (rain),
dan `earmuffs` (snow). Setelah dibeli, item tetap dimiliki selamanya.

Dua puluh satu aksesori digambar langsung sebagai vektor di dalam SVG kucing
(`beanie`, `scarf`, `glasses`, `bow`, `flowercrown`, `sunhat`, `earmuffs`,
`leafcrown`, `crown`, `partyhat`, `bell`, `medal`, `raincoat`, `backpack`,
`santa`, `beret`, `starclip`, `eyepatch`, `bandana`, `cape`, `halo`), jadi
tampilannya konsisten di semua ukuran layar. Sisanya memakai emoji.

Level maksimal adalah **199**. Tiap naik level mendapat +10 koin. Level
kelipatan 10 mendapat bonus +50 koin. Level kelipatan 25 mendapat aksesori
acak; kalau aksesori itu sudah dimiliki atau semua aksesori sudah lengkap,
hadiahnya dikonversi menjadi +100 koin.

## Aset visual

Semua gambar game dibuat **vektor (SVG/CSS)** — tanpa foto, tanpa emoji untuk
elemen penting, tanpa dependensi eksternal.

**Kucing** digambar sebagai satu SVG besar di `index.html`:

- Bulu tepi memakai filter `feTurbulence` + `feDisplacementMap` sehingga
  siluetnya berbulu, bukan garis mulus.
- Pencahayaan datang dari jendela (kiri atas): ada lapisan cahaya putih dan
  sisi gelap yang dipotong mengikuti bentuk tubuh dan kepala.
- Mata punya iris bergradasi, pupil, dua pantulan, dan bayangan kelopak.
- Kumis, bulu pipi, jari cakar, dan ujung ekor digambar satu per satu.

Warna bulu tetap dikendalikan CSS lewat `--fur`, `--fur-2`, `--belly`, dan
`--ear`, jadi mengganti bulu cukup mengganti `data-fur` di elemen kucing.

**Cuaca** memakai partikel yang digambar sendiri (bukan emoji):

| Cuaca | Partikel | Efek tanah |
| --- | --- | --- |
| Hujan | garis air miring + riak | genangan air dengan riak |
| Salju | kristal bintang berputar | salju menumpuk |
| Gugur | helai maple berayun | daun kering bertaburan |
| Semi | kelopak sakura | bunga kecil di rumput |
| Panas | butiran debu melayang | — |

Partikel juga muncul di jendela, dengan ukuran lebih kecil dan lebih lambat.

## Ikon dan badge vektor

Ikon cuaca sekarang berupa **simbol SVG inline** di `index.html` (sprite
`wx-spring`, `wx-hot`, `wx-autumn`, `wx-rain`, `wx-snow`). Tidak ada request
gambar terpisah, jadi ikon tidak bisa rusak karena 404, cache, atau CSP.

Badge misi tetap memakai file:

- `assets/svg/badge-*.svg` — badge untuk 6 misi harian, dipakai di panel misi.

Cara membuat ikon baru:

1. Untuk cuaca, tambahkan `<symbol id="wx-...">` di sprite `index.html`, lalu
   daftarkan `symbol`-nya di `src/data/weather.js`.
2. Untuk badge, simpan SVG di `assets/svg/` dengan nama huruf kecil, angka,
   dan tanda hubung, lalu daftarkan path-nya di `src/data/quests.js`.
3. Jalankan `deno task test` — test aset akan menolak kalau simbol/file tidak ada.

## Mengganti lagu latar

Lagu yang dipakai ada di `assets/` dan path-nya didaftarkan di
`src/data/music.js`. Untuk mengganti lagu:

1. Taruh file audio (`.mp3`, `.m4a`, `.ogg`, `.opus`, atau `.wav`) di `assets/`.
2. Ubah `MUSIC_FILE` di `src/data/music.js` menjadi nama file baru.
3. Muat ulang halaman.

Server menyajikan audio lewat `Range` request, jadi lagu besar bisa diputar
bertahap tanpa mengunduh semuanya sekaligus. Folder `assets/` hanya menyajikan
file dengan ekstensi audio; file lain di dalamnya tidak bisa diakses.

Sesuai aturan autoplay browser, lagu baru mulai setelah interaksi pertama
(klik/tap atau tombol). Toggle dan slider volume di Pengaturan tetap berlaku.

## Struktur

```
index.html              Markup game, overlay, dan UI
assets/
  *.mp3                 Lagu latar (disajikan lewat allowlist audio)
  svg/
    badge-*.svg         Badge vektor untuk 6 misi harian
                        (ikon cuaca berupa sprite inline di index.html)
styles/
  base.css              Reset, token warna, tipografi
  scene.css             Rumah, taman, kucing, cuaca, lampu
  hud.css               HUD, stat, misi, pil cuaca
  dock.css              Tombol aksi bawah
  panels.css            Overlay, toko, multiplayer, cloud, konfirmasi
  responsive.css        Penyesuaian ponsel/tablet/desktop
src/
  main.js               Titik masuk modul
  app.js                Perakitan game + hook pengujian
  core/
    state.js            Skema save v3, validasi, decay offline, XP
    util.js             Helper umum
    dom.js              Cache elemen & helper DOM
  data/
    foods.js            Menu makanan
    furs.js             8 warna bulu
    accessories.js      30 aksesori (termasuk musiman)
    weather.js          5 cuaca + durasi 5 menit
    quests.js           6 misi harian + 7 misi mingguan
    music.js            Path lagu latar dari assets/
    langs.js            Daftar bahasa yang didukung
    i18n/               id, ja, ko, en + penerjemah
  game/
    minigame.js         Tangkap ikan
  systems/
    audio.js            Lagu latar (MP3) & SFX Web Audio
    mic.js              Analisis mikrofon lokal
    weather.js          Siklus cuaca + partikel
    quests.js           Progres, reset, klaim misi
    multiplayer.js      Klien WebSocket + kucing teman
    cloud.js            Klien cloud save
  ui/
    feedback.js         Toast, ucapan, efek partikel
    overlay.js          Buka/tutup overlay, fokus, konfirmasi
    shop.js             Tab toko, kunci musim, beli/pakai
server/
  main.js               Routing HTTP + startup
  config.js             Port, batas pemain, rate limit, path data
  security.js           CSP, header keamanan, origin, rate limiter
  static.js             Server statis dengan allowlist ketat
  rooms.js              Siklus room & protokol multiplayer
  ws.js                 Upgrade WebSocket
  cloud.js              Cloud save (Deno KV / file JSON)
scripts/
  cloud.js              Alat admin: list/show/addcoins/export cloud save
tests/
  server_test.js        Smoke test HTTP, static, cloud, rate limit
  i18n_test.js          Konsistensi terjemahan id/ja/ko
  shop_test.js          Regression test toko (koin & aksesori)
  weather_test.js       Regression test ikon cuaca
  assets_test.js        Integritas file SVG (cuaca, badge, aksesori)
deploy/
  Caddyfile             Contoh reverse proxy lokal untuk tunnel
  cloudflared-config.example.yml
server.js               Launcher tipis untuk `deno task start`
deno.json               Task start/dev/cloud/check/lint/test/verify
Dockerfile, compose.yaml, .github/workflows/ci.yml
```

Tidak ada `game.js`/`game.css` monolitik lagi. Setiap modul punya tanggung jawab
kecil dan diimpor sebagai ES module (`<script type="module">`).

## Cara kerja multiplayer

Multiplayer memakai **WebSocket** di `/ws` dan **room in-memory** di server.

1. Pemain A menekan **Buat room**. Server membuat kode 5 karakter (misalnya
   `K7M2Q`) dan mengirim daftar pemain.
2. Pemain B menekan **Gabung**, memasukkan kode tersebut. Server menambahkan B
   ke room dan memberi tahu A bahwa B bergabung.
3. Setiap klien mengirim state **publik** secara berkala:
   nama, level, warna bulu, aksesori, mood, status tidur, dan scene.
4. Server mem-broadcast state itu ke pemain lain. Klien menggambar satu kucing
   remote per pemain dalam satu baris horizontal; ukurannya mengecil otomatis
   saat pemain bertambah dan kembali normal saat room sepi.
5. Emoji diteruskan sebagai pesan `emote`. Mengelus kucing teman mengirim
   `pet` dengan target id pemain tersebut.
6. Chat teks dikirim sebagai pesan `chat` dan ditampilkan di panel room,
   lengkap dengan pemilih emoji. Voice chat memakai **WebRTC mesh**: server
   hanya meneruskan sinyal `voice` dan `rtc` (offer/answer/ICE), sedangkan
   audio mengalir langsung antar browser. Pemain dengan ID lebih kecil menjadi
   pihak yang membuat offer supaya tidak terjadi tabrakan.

Yang **tidak** dikirim ke server: koin, XP, stat, misi, atau isi
`localStorage`. Progres lengkap tetap di browser masing-masing. Audio voice
chat tidak direkam dan tidak disimpan server; audio hanya mengalir langsung ke
pemain di room yang sama.

Batas default adalah **6 pemain per room**. Ubah dengan `MAX_PLAYERS`
(rentang 2–12):

```bash
MAX_PLAYERS=10 deno task start
```

Catatan penting:

- Room disimpan di memori proses. Kalau server restart, room hilang.
- Server harus mendukung WebSocket dan koneksi panjang (bukan serverless yang
  memutus koneksi). Deno Deploy, VPS, Docker, dan Fly.io bisa.
- Kalau memakai reverse proxy (Nginx/Caddy), teruskan header `Upgrade` dan
  `Connection` agar WebSocket bekerja. Contoh Caddy: `reverse_proxy 127.0.0.1:8000`.
- Origin request diperiksa: halaman dari domain lain tidak bisa membuka `/ws`
  atau memanggil `/api/cloud` memakai konteks browser pengguna.
- Ada batas jumlah room (`MAX_ROOMS`), koneksi WebSocket
  (`MAX_CONNECTIONS`, `MAX_CONNECTIONS_PER_IP`), dan pesan per IP
  (`WS_IP_RATE_LIMIT`) supaya satu sumber tidak bisa mengambil semua sumber daya.
- Room yang tidak dipakai selama `ROOM_IDLE_MS` (default 10 menit) dibuang
  otomatis; kode room berlaku maksimal 6 jam.

### Protokol singkat

Klien mengirim JSON:

```json
{ "type": "create" }
{ "type": "join", "room": "K7M2Q" }
{ "type": "state", "state": { "name": "Mochi", "level": 3, "fur": "cream", "acc": "bow", "mood": "happy", "sleeping": false, "scene": "outside" } }
{ "type": "emote", "emote": "❤️" }
{ "type": "chat", "text": "Halo!" }
{ "type": "voice", "on": true }
{ "type": "rtc", "to": "<id teman>", "data": { "kind": "offer", "sdp": { "...": "..." } } }
{ "type": "pet", "target": "<id teman>" }
{ "type": "ping" }
{ "type": "leave" }
```

Server memvalidasi ukuran pesan (maks 8 KB), rate limit (90 pesan/10 detik per
socket dan 300 pesan/10 detik per IP), format kode room, isi chat (maks 160
karakter), payload WebRTC, serta isi state publik (whitelist id bulu, aksesori,
mood, scene, dan level 1–199). Pesan tak dikenal diabaikan.

## Cloud save dan "database"

Progres normal disimpan di `localStorage` browser dengan kunci
`mochi.virtualcat.v1`. Cloud save bersifat **opsional** untuk pindah perangkat
atau backup.

Alurnya:

1. Di **Pengaturan → Cloud save**, tekan **Buat kode**. Server membuat kode
   `XXXX-XXXX-XXXX` (12 karakter) dan menyimpannya sebagai **hash SHA-256**.
   Kode asli dikembalikan ke browser dan disimpan di `localStorage` perangkat
   itu; server tidak pernah menyimpannya dalam bentuk asli.
2. Tekan **Simpan** untuk mengunggah snapshot state ke server.
3. Di perangkat lain, masukkan kode yang sama lalu tekan **Muat**.

Kode cloud berfungsi seperti *bearer token*: siapa pun yang punya kode bisa
memuat data. Jangan dibagikan. Server tidak menyimpan kode asli, jadi kalau
database bocor, kode tidak bisa dipulihkan dari hash.

Penyimpanan di server:

- **Deno KV** bila tersedia. Task `start`/`dev` menjalankan Deno dengan
  `--unstable-kv`. Secara default KV disimpan di `data/kv.sqlite3` (lokal),
  `/app/data/kv.sqlite3` (Docker), dan KV bawaan platform di Deno Deploy.
- **Fallback file JSON** `data/cloud.json` bila KV tidak tersedia. Penulisan
  dilakukan atomik lewat file sementara + rename, dan file ini di-`.gitignore`.
- Record cloud hanya berisi `{ state, createdAt, savedAt }`. State divalidasi
  ulang lewat `sanitizeState()` dan dibatasi 24 KB.
- Rate limit: 40 request/menit per IP, dan 5 pembuatan kode per 10 menit per IP.
  Identitas IP diambil dari alamat proxy yang dipercaya (`TRUSTED_PROXIES`),
  jadi spoofing header proxy tidak melewati batas.
- Jumlah record cloud dibatasi `CLOUD_MAX_RECORDS` (default 50.000). Setelah
  penuh, pembuatan kode baru ditolak dengan `server_full`.

Backup: salin folder `data/` (atau file KV) secara berkala. Untuk Docker, data
berada di volume `mochi-data`.

### Melihat data cloud (admin)

Ada skrip admin untuk memeriksa isi cloud save. Skrip membaca Deno KV yang sama
dengan server. Tanpa override, keduanya memakai `data/kv.sqlite3`:

```bash
# daftar record: nama kucing, level, koin, waktu simpan
deno task cloud list

# cari record dari kode cloud (skrip menghitung SHA-256-nya)
deno task cloud show ABCD-EFGH-JKLM

# tambah koin ke record tertentu (boleh negatif untuk mengurangi)
deno task cloud addcoins ABCD-EFGH-JKLM 5000

# backup semua record ke JSON
deno task cloud export backup-cloud.json
```

Kalau server dijalankan dengan `KV_PATH` lain, pakai nilai yang sama:

```bash
KV_PATH=/path/lain/kv.sqlite3 deno task cloud list
```

Untuk memaksa membaca fallback file:

```bash
deno task cloud list --file   # membaca data/cloud.json
```

Di Docker, `KV_PATH` sudah di-set di dalam image:

```bash
docker compose exec mochi deno task cloud list
docker compose exec mochi deno task cloud addcoins ABCD-EFGH-JKLM 5000
```

Setelah `addcoins`, buka game lalu tekan **Muat** dengan kode tersebut.
Perubahannya baru dipakai setelah dimuat; kalau perangkat lain menekan
**Simpan** dengan state lama, angka koin hasil edit bisa tertimpa.

Yang perlu dipahami:

- Kunci record adalah **hash SHA-256** dari kode, bukan kode aslinya. Daftar
  hanya menampilkan hash; pakai `show <kode>` untuk mencocokkan kode ke record.
- `state` tersimpan sebagai JSON biasa di dalam record. Siapa pun yang bisa
  membaca file KV atau `data/cloud.json` bisa melihat progres pemain, jadi
  batasi akses ke folder `data/`.
- Jangan mengedit KV langsung lewat `sqlite3`: key dan value Deno KV memakai
  encoding biner. Pakai skrip ini atau API cloud.
- Di Deno Deploy, KV dikelola layanan (tidak ada file lokal), jadi skrip ini
  hanya untuk server yang kamu jalankan sendiri.

**Kalau `list` kosong padahal sudah menyimpan:** berarti server menulis ke
database lain. `KV_PATH=data/kv.sqlite3 deno task cloud list` akan membuat file
baru yang kosong bila server sebenarnya memakai lokasi default Deno
(`~/.cache/deno/location_data/...`). Cek environment proses server, atau
jalankan ulang server dan alat ini dengan `KV_PATH` yang sama. Sejak default
dipusatkan ke `data/kv.sqlite3`, masalah ini tidak muncul lagi untuk pemakaian
normal.

## Deploy

Pemain tidak perlu menjalankan `deno task start`. Cukup hosting sekali, lalu
bagikan URL HTTPS-nya.

### 1. Docker (paling mudah untuk VPS)

```bash
docker compose up -d --build
curl http://localhost:8000/api/health
```

Port terikat ke localhost, jadi belum bisa dibuka dari perangkat lain. Untuk
akses publik gunakan Caddy + Cloudflare Tunnel (bagian 3), atau ubah
`compose.yaml` menjadi `"8000:8000"` bila memang ingin membuka port langsung.
Data cloud tersimpan di volume `mochi-data`.

> Folder `assets/` ikut masuk ke image karena berisi lagu latar
> (`assets/bgm.mp3`, sekitar 9 MB).

Image sudah dikeraskan: container berjalan tanpa privilege (`cap_drop: ALL`,
`no-new-privileges`), punya `HEALTHCHECK`, dan log dibatasi supaya disk tidak
penuh. Izin Deno di dalam image juga sempit (baca `/app`, tulis `/app/data`).

Tanpa Compose:

```bash
docker build -t mochi .
docker run -d --name mochi -p 127.0.0.1:8000:8000 -v mochi-data:/app/data mochi
```

### 2. VPS langsung dengan Deno

```bash
git clone <repo> mochi && cd mochi
PORT=8000 MAX_PLAYERS=6 deno task start
```

Agar tetap hidup, bungkus dengan systemd:

```ini
[Unit]
Description=Mochi virtual cat
After=network.target

[Service]
WorkingDirectory=/srv/mochi
ExecStart=/usr/local/bin/deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv server.js
Restart=always
Environment=PORT=8000
Environment=KV_PATH=/srv/mochi/data/kv.sqlite3
Environment=PUBLIC_ORIGIN=https://mochi.example.com

[Install]
WantedBy=multi-user.target
```

Letakkan di belakang Caddy/Nginx agar HTTPS aktif (mikrofon butuh HTTPS).
Caddy menangani WebSocket otomatis:

```
mochi.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

### 3. Domain sendiri: Cloudflare Tunnel + Caddy

Cocok untuk server di rumah/VM yang tidak punya IP publik atau berada di
belakang CGNAT. Tidak perlu port forwarding; cloudflared hanya membuka koneksi
keluar ke Cloudflare.

Alurnya:

```
pengunjung -> https://mochi.example.com -> Cloudflare (TLS)
           -> cloudflared -> http://127.0.0.1:8080 (Caddy)
           -> http://127.0.0.1:8000 (Mochi)
```

1. Pindahkan nameserver domain ke Cloudflare dan tunggu zona berstatus
   **Active**.
2. Jalankan app dengan port terbatas ke localhost (sudah menjadi default di
   `compose.yaml`) dan set origin publiknya:

   ```yaml
   ports:
     - "127.0.0.1:8000:8000"
   ```

   ```bash
   echo "PUBLIC_ORIGIN=https://mochi.example.com" > .env
   docker compose up -d --build
   ```

   `PUBLIC_ORIGIN` dipakai server untuk CSP dan cek Origin, jadi permintaan
   dengan `Host` lain dibalas 421. Compose mengisi `TRUSTED_PROXIES` default
   (`127.0.0.1,::1,172.16.0.0/12`) supaya koneksi dari Caddy di host, yang
   masuk lewat gateway Docker, tetap dikenali sebagai proxy tepercaya.

3. Pasang Caddy, lalu salin `deploy/Caddyfile`:

   ```bash
   sudo apt install -y caddy
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   curl http://127.0.0.1:8080/api/health
   ```

4. Login dan buat tunnel (butuh browser untuk memilih zona):

   ```bash
   cloudflared tunnel login
   cloudflared tunnel create mochi
   cloudflared tunnel route dns mochi mochi.example.com
   ```

5. Salin `deploy/cloudflared-config.example.yml` ke `~/.cloudflared/config.yml`,
   isi UUID dan path kredensial, lalu validasi:

   ```bash
   cloudflared tunnel ingress validate
   cloudflared tunnel run mochi    # tes, Ctrl+C setelah tersambung
   ```

6. Pasang sebagai service:

   ```bash
   sudo cloudflared --config "$HOME/.cloudflared/config.yml" service install
   sudo systemctl enable --now cloudflared
   sudo systemctl status cloudflared
   ```

7. Verifikasi:

   ```bash
   curl https://mochi.example.com/api/health
   curl -I https://mochi.example.com/
   ```

Di Cloudflare, atur **SSL/TLS → Overview** ke **Full**. Record root/wildcard
milik hosting lain sebaiknya **DNS only** (awan abu-abu); record tunnel
(`mochi`) tetap **Proxied**.

### 4. Deno Deploy

1. Push folder ini ke repositori GitHub.
2. Buat project di [Deno Deploy](https://deno.com/deploy), pilih repositori,
   entry point `server.js`.
3. Buka domain HTTPS hasil deploy.

Deno Deploy mendukung WebSocket dan Deno KV bawaan, jadi cloud save langsung
bekerja tanpa konfigurasi tambahan. Catatan: room multiplayer tetap in-memory
per instance; untuk trafik besar, jalankan satu region/instance atau gunakan
penyimpanan room terpusat.

### Environment variable

| Nama | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `8000` | Port HTTP/WebSocket |
| `HOST` | `0.0.0.0` | Alamat bind |
| `MAX_PLAYERS` | `6` | Maks pemain per room (2–12) |
| `KV_PATH` | `data/kv.sqlite3` | Path file Deno KV. Kosong hanya di Deno Deploy (pakai KV platform) |
| `PUBLIC_ORIGIN` | kosong | Origin publik, mis. `https://mochi.example.com`. Kalau diisi, CSP dan cek Origin memakai nilai ini (bukan Host header) dan Host lain dibalas 421 |
| `TRUSTED_PROXIES` | `127.0.0.1,::1` (Compose: `127.0.0.1,::1,172.16.0.0/12`) | Alamat/CIDR proxy yang dipercaya. Header `X-Forwarded-For`/`CF-Connecting-IP` hanya dipakai kalau koneksi datang dari daftar ini. `none` = tidak percaya proxy apa pun |
| `MAX_ROOMS` | `100` | Maks room multiplayer aktif |
| `ROOM_IDLE_MS` | `600000` | Room tanpa aktivitas dibuang setelah durasi ini |
| `MAX_CONNECTIONS` | `200` | Maks koneksi WebSocket aktif |
| `MAX_CONNECTIONS_PER_IP` | `10` | Maks koneksi WebSocket dari satu alamat IP |
| `WS_IP_RATE_LIMIT` | `300` | Maks pesan WebSocket per IP per 10 detik |
| `CLOUD_MAX_RECORDS` | `50000` | Maks jumlah record cloud save |
| `CLOUD_CREATE_WINDOW_MS` | `600000` | Jendela rate limit pembuatan kode cloud |

Contoh produksi (Docker Compose):

```bash
cat > .env <<'EOF'
PUBLIC_ORIGIN=https://mochi.example.com
EOF
```

`PUBLIC_ORIGIN` sangat disarankan di produksi: tanpa itu, `Host` header dari
permintaan bisa memengaruhi CSP dan pemeriksaan Origin. Isi dengan origin
lengkap (`https://domain`), bukan path. Nilai kosong/tidak valid membuat
server memakai mode pengembangan dan menampilkan peringatan saat start.

## Keamanan

- **CSP ketat** — `default-src 'self'`, tanpa `unsafe-inline`/`unsafe-eval`,
  `object-src 'none'`, `frame-ancestors 'none'`. `connect-src` dibatasi ke
  origin sendiri + WebSocket host yang sama.
- **Allowlist statis** — hanya `/`, `/index.html`, `/styles/*.css`,
  `/src/**/*.js`, file audio di `/assets/` (`mp3`, `m4a`, `ogg`, `opus`,
  `wav`), dan gambar SVG di `/assets/svg/` yang disajikan. `server/`, `data/`,
  `deno.json`, `deno.lock`, `README.md`, `Dockerfile`, dan file titik selalu
  404, termasuk percobaan traversal `../` dan `%2e%2e`.
- **Header lain** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy`,
  dan `Permissions-Policy` (kamera/lokasi dimatikan, mikrofon hanya untuk self).
- **Validasi input** — nama kucing dibersihkan, state cloud di-`sanitizeState()`,
  id bulu/aksesori/mood dicek whitelist, ukuran body dibatasi, tipe konten wajib
  `application/json`.
- **Rate limit & origin check** — untuk cloud API dan pesan WebSocket.
  Identitas klien diambil dari alamat peer, kecuali koneksi datang dari proxy
  yang dipercaya (`TRUSTED_PROXIES`); jadi `X-Forwarded-For` palsu tidak
  bisa melewati batas.
- **Batas abusive** — jumlah room, koneksi WebSocket, koneksi per IP, pesan
  per IP, dan jumlah record cloud semuanya dibatasi.
- **Kredensial tidak ikut repo** — `.env`, kunci privat, dan folder
  `.cloudflared/` di-ignore oleh Git dan Docker. Kode cloud adalah bearer
  token: siapa pun yang memegangnya bisa membaca/menimpa save, jadi jangan
  dibagikan. File `data/cloud.json` dan `data/kv.sqlite3` hanya berisi hash
  kode + state pemain; tetap batasi aksesnya.
- **Izin Deno sempit** — image Docker hanya boleh baca `/app`, tulis
  `/app/data`, dan membaca env yang memang dipakai.
- **Tanpa dependensi runtime** — tidak ada paket npm yang dieksekusi di browser
  maupun server produksi. Permukaan serangan kecil dan mudah diaudit.
- **Tanpa cookie, pelacak, iklan, atau resource pihak ketiga.**

Mikrofon dianalisis lokal lewat Web Audio API untuk mendeteksi suara. Saat
voice chat aktif di room multiplayer, audio dikirim langsung ke pemain lain
lewat WebRTC; audio tidak direkam dan tidak disimpan di server. Multiplayer
hanya membagikan data publik yang tercantum di atas.

## Privasi

- Progres game tersimpan lokal di browser; cloud save hanya aktif jika kamu
  menekan tombolnya.
- Tidak ada analitik atau pihak ketiga.
- Kode cloud adalah rahasia pribadi; server hanya menyimpan hash-nya.
