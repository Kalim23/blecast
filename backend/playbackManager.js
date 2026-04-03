const { spawn } = require('child_process');
const fs = require('fs');
const EventEmitter = require('events');

const YT_DLP_HOSTS = ['youtube.com', 'youtu.be', 'soundcloud.com', 'bandcamp.com', 'tiktok.com', 'vimeo.com', 'twitch.tv'];

function isYtDlpUrl(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return YT_DLP_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

class PlaybackManager extends EventEmitter {
  constructor() {
    super();
    this.current = null;
  }

  play(url, pipePath = '/tmp/snapfifo') {
    this.stop();

    const useYtDlp = isYtDlpUrl(url);
    let ytdlp = null;

    if (useYtDlp) {
      ytdlp = spawn('yt-dlp', ['-f', 'bestaudio', '--no-playlist', '-o', '-', url], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    const ffmpegArgs = useYtDlp
      ? ['-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', '-loglevel', 'error', '-']
      : ['-re', '-i', url, '-f', 's16le', '-ar', '48000', '-ac', '2', '-loglevel', 'error', '-'];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: useYtDlp ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });

    if (ytdlp) {
      ytdlp.stdout.pipe(ffmpeg.stdin);
      ytdlp.stderr.on('data', () => {});
      ytdlp.on('error', (err) => console.error('[yt-dlp] error:', err.message));
    }

    ffmpeg.stderr.on('data', (d) => {
      const line = d.toString().trim();
      if (line) console.error('[ffmpeg]', line);
    });

    let pipeStream;
    try {
      pipeStream = fs.createWriteStream(pipePath);
    } catch (err) {
      console.error('[playback] Failed to open pipe:', err.message);
      ytdlp && ytdlp.kill();
      ffmpeg.kill();
      throw err;
    }

    ffmpeg.stdout.pipe(pipeStream);

    pipeStream.on('error', (err) => {
      console.error('[playback] Pipe write error:', err.message);
      this.stop();
    });

    this.current = { ytdlp, ffmpeg, pipeStream, url, pipePath, title: url, useYtDlp };

    ffmpeg.on('close', (code) => {
      if (this.current && this.current.ffmpeg === ffmpeg) {
        this.current = null;
        this.emit('stopped');
        console.log('[playback] Stopped (ffmpeg exited with code', code + ')');
      }
    });

    if (ytdlp) {
      ytdlp.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.error('[yt-dlp] exited with code', code);
        }
      });
    }

    // Fetch title in background without blocking playback
    this._fetchTitle(url, useYtDlp);

    console.log(`[playback] Starting: ${url} → ${pipePath}`);
    this.emit('playing', this.getStatus());
    return this.getStatus();
  }

  _fetchTitle(url, useYtDlp) {
    if (!useYtDlp) {
      // For direct streams, try to get a friendly name from the URL
      try {
        const u = new URL(url);
        const name = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
        if (this.current && this.current.url === url) {
          this.current.title = decodeURIComponent(name);
          this.emit('title_update', this.getStatus());
        }
      } catch {}
      return;
    }

    const proc = spawn('yt-dlp', ['--get-title', '--no-playlist', url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', () => {});
    proc.on('close', () => {
      const title = out.trim();
      if (title && this.current && this.current.url === url) {
        this.current.title = title;
        this.emit('title_update', this.getStatus());
      }
    });
    proc.on('error', () => {});
  }

  stop() {
    if (!this.current) return;
    const { ytdlp, ffmpeg, pipeStream } = this.current;
    this.current = null;
    try { ytdlp && ytdlp.kill('SIGTERM'); } catch {}
    try { ffmpeg.kill('SIGTERM'); } catch {}
    try { pipeStream.destroy(); } catch {}
    this.emit('stopped');
    console.log('[playback] Stopped manually');
  }

  getStatus() {
    if (!this.current) return { playing: false, title: null, url: null };
    return {
      playing: true,
      url: this.current.url,
      title: this.current.title,
      pipePath: this.current.pipePath,
    };
  }
}

module.exports = PlaybackManager;
