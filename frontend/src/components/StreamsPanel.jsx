import { useState } from 'react';

function StreamStatusBadge({ status }) {
  const colors = {
    playing: 'bg-green-500 text-green-100',
    idle: 'bg-yellow-600 text-yellow-100',
    unknown: 'bg-gray-600 text-gray-300',
  };
  const cls = colors[status] || colors.unknown;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {status || 'unknown'}
    </span>
  );
}

export default function StreamsPanel({ streams, actions }) {
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUri, setFormUri] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formUri.trim()) return;
    setAdding(true);
    setError('');
    try {
      await actions.addStream(formUri.trim());
      setFormName('');
      setFormUri('');
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (streamId) => {
    if (!confirm(`Remove stream "${streamId}"?`)) return;
    try {
      await actions.removeStream(streamId);
    } catch (err) {
      alert('Failed to remove stream: ' + err.message);
    }
  };

  return (
    <div className="bg-card border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white">Streams</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add stream'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 bg-[#111] rounded-lg p-3 border border-[#333]">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Stream URI</label>
            <input
              type="text"
              value={formUri}
              onChange={e => setFormUri(e.target.value)}
              placeholder="pipe:///tmp/snapfifo?name=MyStream"
              required
              className="w-full text-xs bg-[#1a1a1a] border border-[#333] rounded px-2 py-1.5 text-gray-200 outline-none focus:border-indigo-500"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={adding}
            className="self-end text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}

      {streams.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">No streams available</p>
      ) : (
        <div className="flex flex-col gap-2">
          {streams.map(stream => (
            <div
              key={stream.id}
              className="flex items-center gap-3 bg-[#111] rounded-lg px-3 py-2 border border-[#2a2a2a]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-200 truncate">{stream.id}</span>
                  <StreamStatusBadge status={stream.status} />
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {stream.uri?.raw || ''}
                  {stream.uri?.query?.codec && (
                    <span className="ml-2 text-gray-600">codec: {stream.uri.query.codec}</span>
                  )}
                  {stream.uri?.query?.sampleformat && (
                    <span className="ml-2 text-gray-600">{stream.uri.query.sampleformat}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(stream.id)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                title="Remove stream"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
