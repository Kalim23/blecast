import { useState, useRef, useEffect, useCallback } from 'react';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function ClientCard({ client, actions }) {
  const { id, config, connected } = client;
  const { name, volume, latency } = config;

  const [localVolume, setLocalVolume] = useState(volume.percent);
  const [localMuted, setLocalMuted] = useState(volume.muted);
  const [localName, setLocalName] = useState(name || client.host?.name || id);
  const [localLatency, setLocalLatency] = useState(latency ?? 0);

  // Sync volume from external events
  useEffect(() => {
    setLocalVolume(volume.percent);
    setLocalMuted(volume.muted);
  }, [volume.percent, volume.muted]);

  useEffect(() => {
    setLocalName(name || client.host?.name || id);
  }, [name, id, client.host?.name]);

  const debouncedSetVolume = useRef(
    debounce((percent, muted) => {
      actions.setVolume(id, percent, muted).catch(console.error);
    }, 200)
  ).current;

  const handleVolumeChange = useCallback((e) => {
    const val = parseInt(e.target.value);
    setLocalVolume(val);
    debouncedSetVolume(val, localMuted);
  }, [localMuted, debouncedSetVolume]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !localMuted;
    setLocalMuted(newMuted);
    actions.setVolume(id, localVolume, newMuted).catch(console.error);
  }, [localMuted, localVolume, id, actions]);

  const handleNameBlur = useCallback(() => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== (name || client.host?.name || id)) {
      actions.setName(id, trimmed).catch(console.error);
    }
  }, [localName, name, id, client.host?.name, actions]);

  const handleLatencyBlur = useCallback(() => {
    const val = parseInt(localLatency) || 0;
    if (val !== (latency ?? 0)) {
      actions.setLatency(id, val).catch(console.error);
    }
  }, [localLatency, latency, id, actions]);

  return (
    <div
      className={`rounded-lg p-3 border transition-opacity ${
        connected
          ? 'bg-[#222] border-[#333]'
          : 'bg-[#1a1a1a] border-[#2a2a2a] opacity-50'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            connected ? 'bg-green-500' : 'bg-gray-600'
          }`}
        />
        <input
          className="editable-input text-sm font-medium text-gray-200 flex-1 min-w-0"
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          title="Click to rename"
          disabled={!connected}
        />
        <span className="text-xs text-gray-500 flex-shrink-0">{client.host?.ip}</span>
      </div>

      {/* Volume row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Mute toggle */}
        <button
          onClick={handleMuteToggle}
          disabled={!connected}
          className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-sm transition-colors ${
            localMuted
              ? 'bg-gray-700 text-gray-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}
          title={localMuted ? 'Unmute' : 'Mute'}
        >
          {localMuted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          )}
        </button>

        {/* Volume slider */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={localMuted ? 0 : localVolume}
            onChange={handleVolumeChange}
            disabled={!connected || localMuted}
            className={localMuted ? 'muted' : ''}
            style={{
              background: localMuted
                ? '#2a2a2a'
                : `linear-gradient(to right, #6366f1 ${localVolume}%, #2a2a2a ${localVolume}%)`,
            }}
          />
          <span className="text-xs text-gray-400 w-7 text-right flex-shrink-0">
            {localMuted ? 'M' : `${localVolume}`}
          </span>
        </div>
      </div>

      {/* Latency row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Latency</span>
        <input
          type="number"
          value={localLatency}
          onChange={e => setLocalLatency(e.target.value)}
          onBlur={handleLatencyBlur}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          disabled={!connected}
          className="w-16 text-xs bg-[#111] border border-[#333] rounded px-1.5 py-0.5 text-gray-300 text-right outline-none focus:border-indigo-500"
        />
        <span className="text-xs text-gray-500">ms</span>
      </div>
    </div>
  );
}
