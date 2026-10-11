// Real-time WebSocket connection manager
export class SocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  public clientId: string = '';
  public isConnected: boolean = false;

  constructor() {
    this.connect();
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // Send ping every 15s to keep WebSocket and Cloud Run connection actively alive
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (e) {}
      }
    }, 15000);
  }

  private connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emitLocal('open', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            return; // heartbeat ack
          }
          if (data.type === 'connected') {
            this.clientId = data.clientId;
          }
          this.emitLocal(data.type, data);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emitLocal('close', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        // Silently handle error and emit local event
        this.emitLocal('error', err);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 2500);
  }

  public send(type: string, payload: Record<string, any> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      // Re-queue or wait until open
      const onOpen = () => {
        this.ws?.send(JSON.stringify({ type, ...payload }));
        this.off('open', onOpen);
      };
      this.on('open', onOpen);
    }
  }

  public on(type: string, handler: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  public off(type: string, handler: (data: any) => void) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(handler);
    }
  }

  private emitLocal(type: string, data: any) {
    if (this.listeners.has(type)) {
      for (const handler of this.listeners.get(type)!) {
        try {
          handler(data);
        } catch (err) {
          console.error('Error in socket listener:', err);
        }
      }
    }
  }
}

export const socket = new SocketClient();
