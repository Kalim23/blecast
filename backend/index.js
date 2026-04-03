const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const SnapcastClient = require('./snapcastClient');
const PlaybackManager = require('./playbackManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] }
});

app.use(cors());
app.use(express.json());

const snapcast = new SnapcastClient();

// Read initial server config from env or defaults
const SNAPCAST_HOST = process.env.SNAPCAST_HOST || 'localhost';
const SNAPCAST_PORT = parseInt(process.env.SNAPCAST_PORT) || 1705;
snapcast.connect(SNAPCAST_HOST, SNAPCAST_PORT);

snapcast.on('event', (msg) => {
  io.emit('snapcast_event', msg);
});

snapcast.on('connected', () => {
  io.emit('snapcast_status', { connected: true });
});

snapcast.on('disconnected', () => {
  io.emit('snapcast_status', { connected: false });
});

// ── REST API ────────────────────────────────────────────────────────────────

app.get('/api/status', async (req, res) => {
  try {
    const result = await snapcast.call('Server.GetStatus');
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post('/api/client/volume', async (req, res) => {
  try {
    const { id, percent, muted } = req.body;
    const result = await snapcast.call('Client.SetVolume', {
      id,
      volume: { percent: parseInt(percent), muted: Boolean(muted) }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/client/name', async (req, res) => {
  try {
    const { id, name } = req.body;
    const result = await snapcast.call('Client.SetName', { id, name });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/client/latency', async (req, res) => {
  try {
    const { id, latency } = req.body;
    const result = await snapcast.call('Client.SetLatency', { id, latency: parseInt(latency) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/group/mute', async (req, res) => {
  try {
    const { id, mute } = req.body;
    const result = await snapcast.call('Group.SetMute', { id, mute: Boolean(mute) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/group/stream', async (req, res) => {
  try {
    const { id, stream_id } = req.body;
    const result = await snapcast.call('Group.SetStream', { id, stream_id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/group/clients', async (req, res) => {
  try {
    const { id, clients } = req.body;
    const result = await snapcast.call('Group.SetClients', { id, clients });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stream/add', async (req, res) => {
  try {
    const { streamUri } = req.body;
    const result = await snapcast.call('Stream.AddStream', { streamUri });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stream/:id', async (req, res) => {
  try {
    const result = await snapcast.call('Stream.RemoveStream', { id: req.params.id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/server', (req, res) => {
  const { host, port } = req.body;
  if (!host) return res.status(400).json({ error: 'host is required' });
  snapcast.updateServer(host, port);
  res.json({ ok: true });
});

app.get('/api/snapcast/status', (req, res) => {
  res.json({ connected: snapcast.connected });
});

// ── Playback (yt-dlp / ffmpeg → pipe) ───────────────────────────────────────

const playback = new PlaybackManager();

playback.on('playing', (status) => io.emit('playback_status', status));
playback.on('stopped', () => io.emit('playback_status', { playing: false, title: null, url: null }));
playback.on('title_update', (status) => io.emit('playback_status', status));

app.post('/api/play', (req, res) => {
  const { url, pipePath = '/tmp/snapfifo' } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const status = playback.play(url, pipePath);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/play/stop', (req, res) => {
  playback.stop();
  res.json({ ok: true });
});

app.get('/api/play/status', (req, res) => {
  res.json(playback.getStatus());
});

// ── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Blecast] Backend listening on port ${PORT}`);
});
