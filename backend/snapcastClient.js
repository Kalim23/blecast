const net = require('net');
const EventEmitter = require('events');

// Snapcast control protocol: raw TCP on port 1705.
// Messages are JSON objects followed by \r\n (newline-delimited).

class SnapcastClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.rpcId = 1;
    this.pending = new Map();
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.host = 'localhost';
    this.port = 1705;
    this.connected = false;
    this._reconnectTimer = null;
    this._buffer = '';
  }

  connect(host = 'localhost', port = 1705) {
    this.host = host;
    this.port = port;
    this._connect();
  }

  _connect() {
    console.log(`[Snapcast] Connecting to ${this.host}:${this.port}...`);

    const socket = new net.Socket();
    this.socket = socket;
    this._buffer = '';

    socket.connect(this.port, this.host, () => {
      console.log('[Snapcast] Connected');
      this.connected = true;
      this.reconnectDelay = 1000;
      this.emit('connected');
    });

    socket.on('data', (chunk) => {
      this._buffer += chunk.toString();
      const lines = this._buffer.split('\r\n');
      // Last element is incomplete (or empty after final \r\n)
      this._buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch (err) {
          console.error('[Snapcast] Failed to parse line:', err.message, line.slice(0, 100));
          continue;
        }
        this._handleMessage(msg);
      }
    });

    socket.on('close', () => {
      console.log('[Snapcast] Disconnected');
      this.connected = false;
      this.emit('disconnected');
      this._rejectAllPending();
      this._scheduleReconnect();
    });

    socket.on('error', (err) => {
      console.error('[Snapcast] TCP error:', err.message);
      // 'close' event fires after this
    });
  }

  _handleMessage(msg) {
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message || 'RPC error'));
      } else {
        resolve(msg.result);
      }
    } else if (msg.method) {
      this.emit('event', msg);
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    console.log(`[Snapcast] Reconnecting in ${this.reconnectDelay}ms`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  _rejectAllPending() {
    for (const [, { reject }] of this.pending) {
      reject(new Error('Connection closed'));
    }
    this.pending.clear();
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        return reject(new Error('Not connected to Snapcast'));
      }

      const id = this.rpcId++;
      const msg = { id, jsonrpc: '2.0', method, params };
      const line = JSON.stringify(msg) + '\r\n';

      let timer;
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });

      timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RPC timeout for ${method}`));
        }
      }, 10000);

      this.socket.write(line, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  updateServer(host, port) {
    this.host = host;
    this.port = parseInt(port) || 1705;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
    }
    this.reconnectDelay = 1000;
    this._connect();
  }
}

module.exports = SnapcastClient;
