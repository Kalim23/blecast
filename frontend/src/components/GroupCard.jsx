import { useState, useCallback } from 'react';
import ClientCard from './ClientCard';

export default function GroupCard({ group, streams, actions }) {
  const { id, name, muted, stream_id, clients } = group;
  const [localName, setLocalName] = useState(name || 'Unnamed Group');

  const handleMuteToggle = useCallback(() => {
    actions.setGroupMute(id, !muted).catch(console.error);
  }, [id, muted, actions]);

  const handleStreamChange = useCallback((e) => {
    actions.setGroupStream(id, e.target.value).catch(console.error);
  }, [id, actions]);

  const currentStream = streams.find(s => s.id === stream_id);

  return (
    <div className="bg-card border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-3">
      {/* Group header */}
      <div className="flex items-center gap-3">
        <input
          className="editable-input text-base font-semibold text-white flex-1 min-w-0"
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={() => {}}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          title="Group name (display only)"
        />

        {/* Stream selector */}
        <select
          value={stream_id || ''}
          onChange={handleStreamChange}
          className="text-xs bg-[#111] border border-[#333] rounded px-2 py-1 text-gray-300 outline-none focus:border-indigo-500 max-w-[130px] truncate"
        >
          <option value="" disabled>No stream</option>
          {streams.map(s => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </select>

        {/* Mute toggle */}
        <button
          onClick={handleMuteToggle}
          className={`flex-shrink-0 px-3 py-1 rounded text-xs font-medium transition-colors ${
            muted
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-[#2a2a2a] hover:bg-[#333] text-gray-300'
          }`}
        >
          {muted ? 'Muted' : 'Mute'}
        </button>
      </div>

      {/* Stream status badge */}
      {currentStream && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              currentStream.status === 'playing' ? 'bg-green-500' : 'bg-yellow-500'
            }`}
          />
          <span className="text-xs text-gray-500">
            {currentStream.id}
            {currentStream.uri?.query?.codec && (
              <span className="ml-1 text-gray-600">· {currentStream.uri.query.codec}</span>
            )}
          </span>
        </div>
      )}

      {/* Clients */}
      {clients && clients.length > 0 ? (
        <div className="flex flex-col gap-2">
          {clients.map(client => (
            <ClientCard key={client.id} client={client} actions={actions} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600 text-center py-2">No clients in this group</p>
      )}
    </div>
  );
}
