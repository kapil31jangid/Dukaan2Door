import { getToken } from './api';

export interface WebSocketEvent<T = any> {
  event: 'delivery_assigned' | 'delivery_location_updated' | 'delivery_status_updated' | 'delivery_completed' | string;
  data: T;
}

export type WebSocketListener = (event: WebSocketEvent) => void;
export type WebSocketConnectionState = 'connecting' | 'connected' | 'interrupted' | 'stopped';
export type WebSocketConnectionListener = (state: WebSocketConnectionState) => void;

export const MAX_RECONNECT_ATTEMPTS = 5;
export const reconnectDelayMs = (attempt: number): number => Math.min(1000 * 2 ** Math.max(0, attempt), 15000);

export class DeliveryWebSocketClient {
  private ws: WebSocket | null = null;
  private deliveryId: number;
  private listeners: Set<WebSocketListener> = new Set();
  private connectionListeners: Set<WebSocketConnectionListener> = new Set();
  private reconnectTimeout: number | null = null;
  private isExplicitlyClosed = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;

  constructor(deliveryId: number) {
    this.deliveryId = deliveryId;
  }

  connect(): void {
    this.isExplicitlyClosed = false;
    const token = getToken();
    if (!token) return;
    this.emitConnectionState('connecting');

    const wsBaseUrl = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
    const url = `${wsBaseUrl}/api/ws/deliveries/${this.deliveryId}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emitConnectionState('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(parsed));
        } catch {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.isExplicitlyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.emitConnectionState('interrupted');
          const delay = reconnectDelayMs(this.reconnectAttempts);
          this.reconnectAttempts += 1;
          this.reconnectTimeout = window.setTimeout(() => {
            if (!this.isExplicitlyClosed) {
              this.connect();
            }
          }, delay);
        } else if (!this.isExplicitlyClosed) {
          this.emitConnectionState('interrupted');
        }
      };

      this.ws.onerror = () => {
        // Socket error handled in close
      };
    } catch {
      // Failed to instantiate socket
    }
  }

  subscribe(listener: WebSocketListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeConnection(listener: WebSocketConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  private emitConnectionState(state: WebSocketConnectionState): void {
    this.connectionListeners.forEach((listener) => listener(state));
  }

  disconnect(): void {
    this.isExplicitlyClosed = true;
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.emitConnectionState('stopped');
    this.connectionListeners.clear();
  }
}
