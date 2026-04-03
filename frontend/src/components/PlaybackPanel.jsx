import { useState } from 'react';

const SUPPORTED_HINT = 'YouTube, SoundCloud, Bandcamp, radio streams, direct audio URLs...';

function PipeSelector({ streams, value, onChange }) {
  const pipeStreams = streams.filter(s => s.uri?.scheme === 'pipe');
  if (pipeStreams.length === 0) return null;
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs bg-[#111] border border-[#333] rounded px-2 py-1.5 text-gray-300 outline-none focus:border-indigo-500 flex-shrink-0"
      title="Target pipe stream"
    >
      {pipeStreams.map(s => (
        <option key={s.id} value={s.uri.path}>
          {s.id} ({s.uri.path})
        </option>
      ))}
    </select>
  );
}

export default function PlaybackPanel({ streams, playback, actions }) {
  const defaultPipe = streams.find(s => s.uri?.scheme === 'pipe')?.uri?.path || '/tmp/snapfifo';
  const [url, setUrl] = useState('');
  const [pipePath, setPipePath] = useState(defaultPipe);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePlay = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    try {
      await actions.playUrl(url.trim(), pipePath);
      setUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setError('');
    try {
      await actions.stopPlayback();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-card border border-[#2a2a2a] rounded-xl p-4">
      <h2 className="text-base font-semibold text-white mb-3">Play Audio</h2>

      {/* Now playing */}
      {playback.playing && (
        <div className="flex items-center gap-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg px-3 py-2.5 mb-3">
          {/* Animated bars */}
          <div className="flex items-end gap-0.5 flex-shrink-0 h-4">
            {[1,2,3,4].map(i => (
              <div
                key={i}
                className="w-1 bg-indigo-400 rounded-sm"
                style={{
                  height: `${40 + i * 15}%`,
                  animation: `pulse ${0.6 + i * 0.15}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-indigo-300 font-medium truncate">
              {playback.title || 'Loading title...'}
            </p>
            <p className="text-xs text-gray-600 truncate">{playback.url}</p>
          </div>
          <button
            onClick={handleStop}
            className="flex-shrink-0 px-2.5 py-1 rounded text-xs bg-red-700 hover:bg-red-600 text-white transition-colors"
          >
            &#9646;&#9646; Stop
          </button>
        </div>
      )}

      {/* URL input form */}
      <form onSubmit={handlePlay} className="flex flex-col gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={SUPPORTED_HINT}
          className="w-full text-sm bg-[#111] border border-[#333] rounded px-3 py-2 text-gray-200 outline-none focus:border-indigo-500 placeholder-gray-600"
        />
        <div className="flex gap-2">
          <PipeSelector streams={streams} value={pipePath} onChange={setPipePath} />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="flex-1 text-sm px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition-colors"
          >
            {loading ? 'Starting...' : '▶ Play'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>

      <p className="text-xs text-gray-600 mt-2">
        Supports YouTube, SoundCloud, Bandcamp, direct radio/audio URLs and more via yt-dlp.
      </p>
    </div>
  );
}
