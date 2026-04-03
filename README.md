# Blecast — Snapcast Multi-Room Audio Web Controller

A modern web-based controller for [Snapcast](https://github.com/badaix/snapcast) — a free, open-source multi-room audio synchronization system. Blecast lets you control volume, mute, latency, and stream assignment for all your rooms from any browser on your local network. It also includes a built-in playback engine powered by yt-dlp and ffmpeg, so you can stream YouTube, SoundCloud, internet radio, and more directly to all your speakers — no terminal needed.

---

## Table of Contents

1. [How it works](#how-it-works)
2. [Prerequisites](#prerequisites)
3. [Install Snapcast Server](#install-snapcast-server)
4. [Install Blecast](#install-blecast)
5. [Running Blecast](#running-blecast)
6. [Auto-start on boot (systemd)](#auto-start-on-boot-systemd)
7. [Connecting client devices](#connecting-client-devices)
   - [Linux](#linux)
   - [Android](#android)
   - [iOS / iPhone / iPad](#ios--iphone--ipad)
   - [Windows](#windows)
   - [macOS](#macos)
   - [Raspberry Pi](#raspberry-pi)
8. [Playing audio](#playing-audio)
   - [Via the web UI](#via-the-web-ui)
   - [From the terminal](#from-the-terminal)
   - [Internet radio](#internet-radio)
   - [Local files](#local-files)
   - [System audio (desktop)](#system-audio-desktop)
9. [Configuring streams](#configuring-streams)
10. [Web UI overview](#web-ui-overview)
11. [Settings](#settings)
12. [Project structure](#project-structure)
13. [Troubleshooting](#troubleshooting)

---

## How it works

```
Audio source (yt-dlp, ffmpeg, VLC...)
         │
         ▼
   /tmp/snapfifo  ◄── named pipe (FIFO)
         │
         ▼
   snapserver :1705  ◄── Snapcast server (encodes + distributes audio)
         │
         ├──── snapclient (Linux PC)
         ├──── snapclient (Raspberry Pi)
         ├──── Snapcast Android app
         ├──── Snapcast iOS app
         └──── Browser (http://192.168.x.x:1780)
         
   Blecast backend :3001  ◄── Node.js / Express / Socket.io
         │  (connects to snapserver via TCP JSON-RPC on port 1705)
         ▼
   Blecast frontend :5173  ◄── React / Vite / Tailwind CSS
         │
         └──── Any browser on local network: http://192.168.x.x:5173
```

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Snapcast server** installed and running
- **ffmpeg** (for audio transcoding)
- **yt-dlp** (for YouTube, SoundCloud, etc.)

Check versions:

```bash
node --version      # must be >= 18
ffmpeg -version
yt-dlp --version
```

---

## Install Snapcast Server

### Ubuntu / Debian

```bash
sudo apt update && sudo apt install -y snapserver
```

### Arch Linux

```bash
sudo pacman -S snapcast
```

### From GitHub release (latest version)

```bash
wget https://github.com/badaix/snapcast/releases/latest/download/snapserver_0.27.0-1_amd64_noble.deb
sudo dpkg -i snapserver_*.deb
sudo apt-get install -f
```

### Enable and start

```bash
sudo systemctl enable snapserver
sudo systemctl start snapserver
sudo systemctl status snapserver   # should say "active (running)"
```

Snapcast listens on:
- **:1704** — audio streaming (clients connect here)
- **:1705** — control API (JSON-RPC over TCP) — used by Blecast
- **:1780** — built-in HTTP web player

---

## Install ffmpeg and yt-dlp

```bash
# ffmpeg
sudo apt install -y ffmpeg

# yt-dlp (latest version, not the outdated apt package)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod +x /usr/local/bin/yt-dlp
```

---

## Install Blecast

```bash
git clone https://github.com/youruser/blecast.git   # or copy the project folder
cd blecast

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

---

## Running Blecast

Open two terminals (or run both in background):

### Terminal 1 — Backend

```bash
cd blecast/backend
npm start
# Listening on port 3001, connecting to Snapcast at localhost:1705
```

### Terminal 2 — Frontend

```bash
cd blecast/frontend
npm run dev
# Available at http://localhost:5173 and http://192.168.x.x:5173
```

Open **http://192.168.0.2:5173** in any browser on your local network.

### Environment variables (backend)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend HTTP port |
| `SNAPCAST_HOST` | `localhost` | Snapcast server hostname or IP |
| `SNAPCAST_PORT` | `1705` | Snapcast control port |

Example:
```bash
SNAPCAST_HOST=192.168.0.5 PORT=3001 npm start
```

---

## Auto-start on boot (systemd)

### Backend service

```bash
sudo nano /etc/systemd/system/blecast-backend.service
```

```ini
[Unit]
Description=Blecast Backend
After=network.target snapserver.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/WEB/blecast/backend
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Frontend service (production build — recommended for always-on)

Build the frontend first:

```bash
cd blecast/frontend
npm run build
```

Then serve the built files using the backend (add static serving) or a simple HTTP server:

```bash
sudo npm install -g serve
```

```bash
sudo nano /etc/systemd/system/blecast-frontend.service
```

```ini
[Unit]
Description=Blecast Frontend
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/WEB/blecast/frontend
ExecStart=/usr/bin/npx serve dist -l 5173
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Enable both services

```bash
sudo systemctl daemon-reload
sudo systemctl enable blecast-backend blecast-frontend
sudo systemctl start blecast-backend blecast-frontend
```

Check status:

```bash
sudo systemctl status blecast-backend
sudo systemctl status blecast-frontend
```

---

## Connecting client devices

All clients must be on the **same local network** as the Snapcast server.

### Linux

Install and run snapclient:

```bash
sudo apt install snapclient

# Connect to server (replace IP with your server's IP)
snapclient -h 192.168.0.2
```

To run as a service:

```bash
sudo systemctl enable snapclient
sudo systemctl start snapclient
```

Edit `/etc/default/snapclient` to set the server IP permanently:

```bash
SNAPCLIENT_OPTS="-h 192.168.0.2"
```

### Android

**Option A — Native app (recommended, best sync)**

1. Open **Google Play Store** or **F-Droid**
2. Search for **"Snapcast"** by *badaix*
   - Play Store: `https://play.google.com/store/apps/details?id=de.badaix.snapcast`
   - F-Droid: `https://f-droid.org/en/packages/de.badaix.snapcast/`
3. Install and open the app
4. Tap the **+** or settings icon
5. Set **Server** to your server's IP: `192.168.0.2`
6. Tap **Connect** — you will appear in the Blecast UI automatically

**Option B — Browser player (no install needed)**

Open in any Android browser:
```
http://192.168.0.2:1780
```

This is Snapcast's built-in web player. Audio plays directly in the browser. Latency tuning is limited compared to the native app.

### iOS / iPhone / iPad

**Option A — Native app**

1. Open the **App Store**
2. Search for **"Snapcast"** by *Florian Winkler*
3. Install and open the app
4. Enter your server IP: `192.168.0.2`
5. Tap **Connect**

**Option B — Browser player (no install needed)**

Open Safari or any browser:
```
http://192.168.0.2:1780
```

> **Note:** iOS Safari requires user interaction before playing audio. Tap the play button once the page loads.

### Windows

Snapcast does not have an official Windows client. Options:

**Option A — WSL2 (Windows Subsystem for Linux)**

```powershell
# In PowerShell (admin)
wsl --install
```

Then inside WSL:
```bash
sudo apt install snapclient
snapclient -h 192.168.0.2
```

**Option B — Browser player**

Open Chrome or Edge:
```
http://192.168.0.2:1780
```

### macOS

Snapcast does not have an official macOS client. Options:

**Option A — Homebrew**

```bash
brew install snapcast
snapclient -h 192.168.0.2
```

**Option B — Browser player**

```
http://192.168.0.2:1780
```

### Raspberry Pi

Perfect as a passive audio client for any room with speakers.

```bash
sudo apt update && sudo apt install -y snapclient

# Edit config to point to your server
sudo nano /etc/default/snapclient
```

```
SNAPCLIENT_OPTS="-h 192.168.0.2"
```

```bash
sudo systemctl enable snapclient
sudo systemctl start snapclient
```

Connect the Pi's 3.5mm audio jack or HDMI audio to speakers.

---

## Playing audio

### Via the web UI

1. Open **http://192.168.0.2:5173**
2. Go to the **Playback** section
3. Paste any supported URL into the input field
4. Select the target pipe stream (defaults to `default`)
5. Click **▶ Play**

**Supported URL types:**
| Type | Example |
|---|---|
| YouTube | `https://www.youtube.com/watch?v=...` |
| YouTube Music | `https://music.youtube.com/watch?v=...` |
| SoundCloud | `https://soundcloud.com/artist/track` |
| Bandcamp | `https://artist.bandcamp.com/track/...` |
| Twitch stream | `https://www.twitch.tv/channel` |
| Internet radio | `http://stream.radio.example.com/stream.mp3` |
| Direct audio file URL | `https://example.com/audio.flac` |

Click **Stop** to stop playback.

### From the terminal

Pipe any audio source directly into Snapcast:

```bash
# Generic command
AUDIO_SOURCE | ffmpeg -i pipe:0 -f s16le -ar 48000 -ac 2 - > /tmp/snapfifo

# YouTube / yt-dlp supported sites
yt-dlp -f bestaudio -o - "https://www.youtube.com/watch?v=VIDEO_ID" 2>/dev/null \
  | ffmpeg -i pipe:0 -f s16le -ar 48000 -ac 2 - 2>/dev/null > /tmp/snapfifo
```

### Internet radio

```bash
ffmpeg -re -i "http://stream.radio.example.com/stream.mp3" \
  -f s16le -ar 48000 -ac 2 - > /tmp/snapfifo
```

Find radio stream URLs at [radio-browser.info](https://www.radio-browser.info).

### Local files

```bash
# Single file
ffmpeg -re -i /path/to/music.flac -f s16le -ar 48000 -ac 2 - > /tmp/snapfifo

# Entire folder (loop forever)
while true; do
  for f in /path/to/music/*.mp3; do
    ffmpeg -re -i "$f" -f s16le -ar 48000 -ac 2 - > /tmp/snapfifo
  done
done
```

### System audio (desktop)

Stream whatever is playing on your desktop to all Snapcast clients:

```bash
# Find your monitor source name
pactl list short sources | grep monitor

# Stream it (replace 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor' with your source)
pacat --record --device=alsa_output.pci-0000_00_1f.3.analog-stereo.monitor \
  --format=s16le --rate=48000 --channels=2 > /tmp/snapfifo
```

---

## Configuring streams

Streams are defined in `/etc/snapserver.conf`. Edit and restart snapserver to apply:

```bash
sudo nano /etc/snapserver.conf
sudo systemctl restart snapserver
```

### Pipe stream (push audio via FIFO — default)

```ini
[stream]
source = pipe:///tmp/snapfifo?name=Default&codec=flac&sampleformat=48000:16:2
```

### Multiple streams (multiple rooms with different audio)

```ini
[stream]
source = pipe:///tmp/snapfifo?name=Default&codec=flac&sampleformat=48000:16:2
source = pipe:///tmp/snapfifo2?name=Room2&codec=flac&sampleformat=48000:16:2
```

Then create the second pipe:

```bash
sudo mkfifo /tmp/snapfifo2
sudo chmod 777 /tmp/snapfifo2
```

### TCP stream (push audio over the network)

```ini
source = tcp://0.0.0.0:4953?name=TCPStream&mode=server
```

Push audio to it from anywhere on the network:

```bash
ffmpeg -re -i input.mp3 -f s16le -ar 48000 -ac 2 - | nc 192.168.0.2 4953
```

### Spotify (via librespot)

Install librespot: [github.com/librespot-org/librespot](https://github.com/librespot-org/librespot)

```ini
source = librespot:///usr/bin/librespot?name=Spotify&devicename=Snapcast&bitrate=320&volume=100
```

### AirPlay (via shairport-sync)

Install shairport-sync: `sudo apt install shairport-sync`

```ini
source = airplay:///shairport-sync/shairport-sync?name=AirPlay&devicename=Snapcast
```

---

## Web UI overview

### Header
- Server name and Snapcast version
- Connection status badge (green = connected, red = disconnected with pulse animation)
- Settings gear icon

### Playback panel
- URL input — paste any supported audio URL
- Stream selector — choose which pipe to send audio to
- Now Playing display with animated bars and track title
- Stop button

### Groups panel
- Each Snapcast group shown as a card
- Stream assignment dropdown (change which audio stream plays in this group)
- Group mute toggle
- Client cards within each group

### Client card (per device)
- Device name (click to rename — saved to Snapcast)
- Online/offline indicator
- Volume slider (0–100, debounced 200ms)
- Mute toggle (grays out slider)
- Latency adjustment (milliseconds — use to sync audio between rooms)

### Streams panel
- Lists all configured streams with status (playing / idle)
- Add stream button (enter a stream URI)
- Remove stream button

---

## Settings

Click the **gear icon** in the top-right corner to open Settings.

**Snapcast Server** — change the host and port Blecast connects to.
- Default: `localhost:1705`
- To connect to a remote Snapcast server: `192.168.0.5:1705`
- Saved to browser `localStorage` and applied immediately

---

## Project structure

```
blecast/
├── backend/
│   ├── index.js              Express + Socket.io server, all REST endpoints
│   ├── snapcastClient.js     TCP JSON-RPC client with auto-reconnect (exponential backoff)
│   ├── playbackManager.js    yt-dlp / ffmpeg process manager
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 Main layout, header, settings modal
│   │   ├── index.css               Dark theme, custom range slider styles
│   │   ├── main.jsx                React entry point
│   │   ├── components/
│   │   │   ├── PlaybackPanel.jsx   URL playback UI
│   │   │   ├── GroupCard.jsx       Group with stream selector, mute, client list
│   │   │   ├── ClientCard.jsx      Volume, mute, latency, name per client
│   │   │   ├── StreamsPanel.jsx    Stream list, add/remove
│   │   │   └── ConnectionStatus.jsx  Animated status dot
│   │   └── hooks/
│   │       └── useSnapcast.js      Socket.io connection, state reducer, all actions
│   ├── index.html
│   ├── vite.config.js        Proxy /api and /socket.io → backend :3001
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

### Backend API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | Full Snapcast server state |
| `POST` | `/api/client/volume` | Set client volume `{ id, percent, muted }` |
| `POST` | `/api/client/name` | Rename client `{ id, name }` |
| `POST` | `/api/client/latency` | Set latency `{ id, latency }` |
| `POST` | `/api/group/mute` | Mute/unmute group `{ id, mute }` |
| `POST` | `/api/group/stream` | Assign stream to group `{ id, stream_id }` |
| `POST` | `/api/group/clients` | Move clients between groups `{ id, clients }` |
| `POST` | `/api/stream/add` | Add stream `{ streamUri }` |
| `DELETE` | `/api/stream/:id` | Remove stream |
| `POST` | `/api/play` | Start playback `{ url, pipePath }` |
| `POST` | `/api/play/stop` | Stop playback |
| `GET` | `/api/play/status` | Current playback status |
| `POST` | `/api/config/server` | Update Snapcast server address `{ host, port }` |

### Socket.io events (backend → frontend)

| Event | Payload | Description |
|---|---|---|
| `snapcast_status` | `{ connected }` | Snapcast server connection state changed |
| `snapcast_event` | Snapcast event object | Forwarded Snapcast event (volume, connect, etc.) |
| `playback_status` | `{ playing, title, url }` | Playback state changed |

---

## Troubleshooting

### Web UI shows "Connecting to backend..."

The backend is not running. Start it:
```bash
cd blecast/backend && node index.js
```

### Web UI shows "Waiting for Snapcast server..."

Snapcast is not running or not reachable:
```bash
sudo systemctl status snapserver
sudo systemctl start snapserver
```

Check it's listening on port 1705:
```bash
ss -tlnp | grep 1705
```

### Clients not appearing after page refresh

This was a known bug (fixed). If it happens again, check that `Server.GetStatus` returns groups:
```bash
curl -s http://localhost:3001/api/status | python3 -m json.tool | grep -A5 '"groups"'
```

### Permission denied writing to /tmp/snapfifo

The pipe is owned by `_snapserver`. Fix with:
```bash
sudo chmod 777 /tmp/snapfifo
```

Or add your user to the snapserver group:
```bash
sudo usermod -aG _snapserver $USER
# Log out and back in for group change to take effect
```

### Audio plays too fast or is choppy

- Ensure ffmpeg is **not** given the `-re` flag when reading from yt-dlp (yt-dlp already controls rate)
- Use `-re` only when reading from a local file directly with ffmpeg

### yt-dlp warning about JavaScript runtime

```
WARNING: No supported JavaScript runtime could be found
```

Install Node.js (already required) and make sure it's in PATH, or install deno:
```bash
sudo snap install deno
```
This warning is harmless — audio still downloads correctly.

### Clients out of sync

Adjust the **Latency** field on each client card in the web UI. Increase latency on clients that are ahead, decrease on clients that are behind. Typical values: 0–500ms.

### Snapcast not installed (no apt package)

On newer Ubuntu versions, Snapcast may not be in apt. Install from the GitHub releases page:
```bash
wget https://github.com/badaix/snapcast/releases/latest/download/snapserver_0.27.0-1_amd64_noble.deb
sudo dpkg -i snapserver_*.deb
sudo apt-get install -f
```

---

## License

MIT
