import { useEffect, useReducer, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = '';  // empty = same origin (works with vite proxy)

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const initialState = {
  serverInfo: null,
  groups: [],
  streams: [],
  isConnected: false,       // socket.io backend connection
  snapConnected: false,     // snapcast server connection
  playback: { playing: false, title: null, url: null },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_SNAP_CONNECTED':
      return { ...state, snapConnected: action.payload };

    case 'SET_STATUS': {
      const { server } = action.payload;
      return {
        ...state,
        serverInfo: server?.server,
        groups: server?.groups || [],
        streams: server?.streams || [],
        snapConnected: true,
      };
    }

    case 'CLIENT_VOLUME_CHANGED': {
      const { id, volume } = action.payload;
      const groups = state.groups.map(g => ({
        ...g,
        clients: g.clients.map(c =>
          c.id === id ? { ...c, config: { ...c.config, volume } } : c
        ),
      }));
      return { ...state, groups };
    }

    case 'CLIENT_CONNECT': {
      const { client } = action.payload;
      // Add to existing group or update existing entry
      const groups = state.groups.map(g => {
        const idx = g.clients.findIndex(c => c.id === client.id);
        if (idx === -1) return g;
        const clients = [...g.clients];
        clients[idx] = client;
        return { ...g, clients };
      });
      return { ...state, groups };
    }

    case 'CLIENT_DISCONNECT': {
      const { id } = action.payload;
      const groups = state.groups.map(g => ({
        ...g,
        clients: g.clients.map(c =>
          c.id === id ? { ...c, connected: false } : c
        ),
      }));
      return { ...state, groups };
    }

    case 'GROUP_MUTED': {
      const { id, mute } = action.payload;
      const groups = state.groups.map(g =>
        g.id === id ? { ...g, muted: mute } : g
      );
      return { ...state, groups };
    }

    case 'GROUP_STREAM_CHANGED': {
      const { id, stream_id } = action.payload;
      const groups = state.groups.map(g =>
        g.id === id ? { ...g, stream_id } : g
      );
      return { ...state, groups };
    }

    case 'SET_PLAYBACK':
      return { ...state, playback: action.payload };

    case 'SERVER_UPDATE': {
      const { server } = action.payload;
      return {
        ...state,
        serverInfo: server.server,
        groups: server.groups || state.groups,
        streams: server.streams || state.streams,
      };
    }

    default:
      return state;
  }
}

function apiFetch(path, options = {}) {
  return fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(r => {
    if (!r.ok) return r.json().then(e => Promise.reject(new Error(e.error || r.statusText)));
    return r.json();
  });
}

export function useSnapcast() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);

  const fetchStatus = useCallback(() => {
    return apiFetch('/api/status')
      .then(data => dispatch({ type: 'SET_STATUS', payload: data }))
      .catch(err => console.warn('[useSnapcast] fetchStatus failed:', err.message));
  }, []);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: true });
      fetchStatus();
      // Sync playback state on reconnect
      apiFetch('/api/play/status').then(s => dispatch({ type: 'SET_PLAYBACK', payload: s })).catch(() => {});
    });

    socket.on('disconnect', () => {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      dispatch({ type: 'SET_SNAP_CONNECTED', payload: false });
    });

    socket.on('snapcast_status', ({ connected }) => {
      dispatch({ type: 'SET_SNAP_CONNECTED', payload: connected });
      if (connected) fetchStatus();
    });

    socket.on('playback_status', (status) => {
      dispatch({ type: 'SET_PLAYBACK', payload: status });
    });

    socket.on('snapcast_event', (msg) => {
      const { method, params } = msg;
      switch (method) {
        case 'Client.OnVolumeChanged':
          dispatch({ type: 'CLIENT_VOLUME_CHANGED', payload: params });
          break;
        case 'Client.OnConnect':
          dispatch({ type: 'CLIENT_CONNECT', payload: params });
          break;
        case 'Client.OnDisconnect':
          dispatch({ type: 'CLIENT_DISCONNECT', payload: params });
          break;
        case 'Group.OnMute':
          dispatch({ type: 'GROUP_MUTED', payload: params });
          break;
        case 'Group.OnStreamChanged':
          dispatch({ type: 'GROUP_STREAM_CHANGED', payload: params });
          break;
        case 'Server.OnUpdate':
          dispatch({ type: 'SERVER_UPDATE', payload: params });
          break;
        default:
          break;
      }
    });

    return () => socket.disconnect();
  }, [fetchStatus]);

  const actions = {
    setVolume: (clientId, percent, muted) =>
      apiFetch('/api/client/volume', {
        method: 'POST',
        body: JSON.stringify({ id: clientId, percent, muted }),
      }),

    setName: (clientId, name) =>
      apiFetch('/api/client/name', {
        method: 'POST',
        body: JSON.stringify({ id: clientId, name }),
      }),

    setLatency: (clientId, latency) =>
      apiFetch('/api/client/latency', {
        method: 'POST',
        body: JSON.stringify({ id: clientId, latency }),
      }),

    setGroupMute: (groupId, mute) =>
      apiFetch('/api/group/mute', {
        method: 'POST',
        body: JSON.stringify({ id: groupId, mute }),
      }),

    setGroupStream: (groupId, stream_id) =>
      apiFetch('/api/group/stream', {
        method: 'POST',
        body: JSON.stringify({ id: groupId, stream_id }),
      }),

    setGroupClients: (groupId, clients) =>
      apiFetch('/api/group/clients', {
        method: 'POST',
        body: JSON.stringify({ id: groupId, clients }),
      }),

    playUrl: (url, pipePath) =>
      apiFetch('/api/play', {
        method: 'POST',
        body: JSON.stringify({ url, pipePath }),
      }),

    stopPlayback: () =>
      apiFetch('/api/play/stop', { method: 'POST' }),

    addStream: (streamUri) =>
      apiFetch('/api/stream/add', {
        method: 'POST',
        body: JSON.stringify({ streamUri }),
      }),

    removeStream: (streamId) =>
      apiFetch(`/api/stream/${encodeURIComponent(streamId)}`, {
        method: 'DELETE',
      }),

    updateServerConfig: (host, port) =>
      apiFetch('/api/config/server', {
        method: 'POST',
        body: JSON.stringify({ host, port }),
      }),
  };

  return { ...state, actions };
}
