# Mochi — Kucing Virtual (Web Game)

Game web untuk merawat kucing virtual bernama **Mochi**. Bisa dimainkan sendiri
atau bareng teman lewat multiplayer online. Visual, animasi, dan efek suara
dibuat dengan HTML, CSS, SVG, dan Web Audio API; lagu latar memakai file MP3 di
`assets/`. Tidak ada framework atau dependensi runtime eksternal.

- **Toko & progres** — koin, level, XP, 8 warna bulu, 19 aksesori.
- **Musik latar** — lagu piano dari `assets/`, dengan toggle dan slider volume.
- **Cuaca hidup** — 5 cuaca bergilir, partikel di taman, jendela ikut berubah.
- **Misi harian** — 6 misi dengan hadiah koin/XP, reset tiap hari.
- **Multiplayer** — satu room sampai 6 pemain (bisa diatur), satu kucing per pemain.
- **Cloud save** — pindah perangkat dengan kode rahasia 12 karakter.
- **Responsif** — ponsel, tablet, dan desktop. Bahasa Indonesia, Jepang, Korea.

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

Cuaca berganti otomatis setiap **4 menit** dengan urutan:

```
spring (🌸) → hot (☀️) → autumn (🍂) → rain (🌧️) → snow (❄️) → ...
```

Cuaca hanya memengaruhi **taman**. Di dalam rumah, jendela menampilkan cuaca
yang sama (hujan di luar juga terlihat di jendela), tapi kucing tetap nyaman.
Hujan, salju, daun, dan kelopak bunga dirender sebagai partikel CSS.

Misi harian direset berdasarkan tanggal lokal perangkat. Hadiah misi:

| Misi | Target | Koin | XP |
| --- | --- | --- | --- |
| Makan | 3× | 15 | 10 |
| Mandi | 1× | 10 | 6 |
| Main tangkap ikan | 1× | 20 | 15 |
| Elus | 12× | 12 | 8 |
| Tangkap kupu-kupu | 5× | 18 | 10 |
| Kirim emoji di multiplayer | 1× | 15 | 8 |

Lima aksesori musiman hanya bisa dibeli saat cuacanya sedang aktif:
`flowercrown` (spring), `sunhat` (hot), `leafcrown` (autumn), `raincoat` (rain),
dan `earmuffs` (snow). Setelah dibeli, item tetap dimiliki selamanya.

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
    accessories.js      19 aksesori (termasuk musiman)
    weather.js          5 cuaca + durasi
    quests.js           6 misi harian
    music.js            Path lagu latar dari assets/
    i18n/               id, ja, ko + penerjemah
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
  cloud.js              Alat admin: list/show/export cloud save
server.js               Launcher tipis untuk `deno task start`
deno.json               Task start/dev/cloud/check
Dockerfile, compose.yaml
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
   remote per pemain, lengkap dengan nama dan aksesorinya.
5. Emoji diteruskan sebagai pesan `emote`. Mengelus kucing teman mengirim
   `pet` dengan target id pemain tersebut.

Yang **tidak** dikirim: koin, XP, stat, misi, atau isi `localStorage`. Progres
lengkap tetap di browser masing-masing.

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

### Protokol singkat

Klien mengirim JSON:

```json
{ "type": "create" }
{ "type": "join", "room": "K7M2Q" }
{ "type": "state", "state": { "name": "Mochi", "level": 3, "fur": "cream", "acc": "bow", "mood": "happy", "sleeping": false, "scene": "outside" } }
{ "type": "emote", "emote": "❤️" }
{ "type": "pet", "target": "<id teman>" }
{ "type": "ping" }
{ "type": "leave" }
```

Server memvalidasi ukuran pesan (maks 4 KB), rate limit (45 pesan/10 detik),
format kode room, serta isi state publik (whitelist id bulu, aksesori, mood,
scene). Pesan tak dikenal diabaikan.

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
```

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
```

Buka `http://<ip-server>:8000`. Data cloud tersimpan di volume `mochi-data`.
Ganti port host di `compose.yaml` bila perlu, misalnya `"80:8000"`.

> Folder `assets/` ikut masuk ke image karena berisi lagu latar. File lagu saat
> ini berukuran sekitar 305 MB, jadi image Docker akan besar. Kalau tidak perlu
> kualitas aslinya, kompres/transcode MP3 ke bitrate lebih rendah lebih dulu.

Tanpa Compose:

```bash
docker build -t mochi .
docker run -d --name mochi -p 8000:8000 -v mochi-data:/app/data mochi
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

### 3. Deno Deploy

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

## Keamanan

- **CSP ketat** — `default-src 'self'`, tanpa `unsafe-inline`/`unsafe-eval`,
  `object-src 'none'`, `frame-ancestors 'none'`. `connect-src` dibatasi ke
  origin sendiri + WebSocket host yang sama.
- **Allowlist statis** — hanya `/`, `/index.html`, `/styles/*.css`,
  `/src/**/*.js`, dan file audio di `/assets/` (`mp3`, `m4a`, `ogg`, `opus`,
  `wav`) yang disajikan. `server/`, `data/`, `deno.json`, `deno.lock`,
  `README.md`, `Dockerfile`, dan file titik selalu 404, termasuk percobaan
  traversal `../` dan `%2e%2e`.
- **Header lain** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy`,
  dan `Permissions-Policy` (kamera/lokasi dimatikan, mikrofon hanya untuk self).
- **Validasi input** — nama kucing dibersihkan, state cloud di-`sanitizeState()`,
  id bulu/aksesori/mood dicek whitelist, ukuran body dibatasi, tipe konten wajib
  `application/json`.
- **Rate limit & origin check** — untuk cloud API dan pesan WebSocket.
- **Tanpa dependensi runtime** — tidak ada paket npm yang dieksekusi di browser
  maupun server produksi. Permukaan serangan kecil dan mudah diaudit.
- **Tanpa cookie, pelacak, iklan, atau resource pihak ketiga.**

Mikrofon dianalisis lokal lewat Web Audio API untuk mendeteksi suara; audio tidak
direkam dan tidak dikirim ke server. Multiplayer hanya membagikan data publik
yang tercantum di atas.

## Privasi

- Progres game tersimpan lokal di browser; cloud save hanya aktif jika kamu
  menekan tombolnya.
- Tidak ada analitik atau pihak ketiga.
- Kode cloud adalah rahasia pribadi; server hanya menyimpan hash-nya.
