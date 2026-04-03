import { useState } from 'react';
import { useSnapcast } from './hooks/useSnapcast';
import ConnectionStatus from './components/ConnectionStatus';
import GroupCard from './components/GroupCard';
import StreamsPanel from './components/StreamsPanel';
import PlaybackPanel from './components/PlaybackPanel';

function SettingsPanel({ actions, onClose }) {
  const saved = localStorage.getItem('snapcast_server') || 'localhost:1705';
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const [host, portStr] = value.split(':');
    const port = parseInt(portStr) || 1705;
    setSaving(true);
    try {
      await actions.updateServerConfig(host.trim(), port);
      localStorage.setItem('snapcast_server', value);
      onClose();
    } catch (err) {
      alert('Failed to update server: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-[#333] rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-base font-semibold text-white mb-4">Settings</h2>
        <label className="text-xs text-gray-400 block mb-1">Snapcast Server (host:port)</label>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="localhost:1705"
          className="w-full text-sm bg-[#111] border border-[#333] rounded px-3 py-2 text-gray-200 outline-none focus:border-indigo-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded bg-[#2a2a2a] hover:bg-[#333] text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { groups, streams, serverInfo, isConnected, snapConnected, playback, actions } = useSnapcast();
  const [showSettings, setShowSettings] = useState(false);

  const serverName = serverInfo?.host?.name || serverInfo?.host?.ip || 'Snapcast';

  return (
    <div className="min-h-screen bg-bg text-gray-200">
      {/* Header */}
      <header className="border-b border-[#1e1e1e] bg-[#121212] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white tracking-tight">
              &#9654; Blecast
            </span>
            {snapConnected && (
              <span className="text-sm text-gray-500">{serverName}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus
              isConnected={isConnected}
              snapConnected={snapConnected}
              serverInfo={serverInfo}
            />
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">Connecting to backend...</p>
          </div>
        ) : !snapConnected ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">Waiting for Snapcast server...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Groups */}
            {groups.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                No groups found. Check your Snapcast server configuration.
              </div>
            ) : (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Groups
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groups.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      streams={streams}
                      actions={actions}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Playback */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Playback
              </h2>
              <PlaybackPanel streams={streams} playback={playback} actions={actions} />
            </section>

            {/* Streams */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Streams
              </h2>
              <StreamsPanel streams={streams} actions={actions} />
            </section>
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsPanel actions={actions} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
