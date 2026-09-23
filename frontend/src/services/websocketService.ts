import { getToken } from './api';

export interface WebSocketEvent<T = any> {
  event: 'delivery_assigned' | 'delivery_location_updated' | 'delivery_status_updated' | 'delivery_completed' | string;
  data: T;
}

export type WebSocketListener = (event: WebSocketEvent) => void;

export class DeliveryWebSocketClient {
  private ws: WebSocket | null = null;
  private deliveryId: number;
  private listeners: Set<WebSocketListener> = new Set();
  private reconnectTimeout: number | null = null;
  private isExplicitlyClosed = false;

  constructor(deliveryId: number) {
    this.deliveryId = deliveryId;
  }

  connect(): void {
    this.isExplicitlyClosed = false;
    const token = getToken();
    if (!token) return;

    const wsBaseUrl = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
    const url = `${wsBaseUrl}/api/ws/deliveries/${this.deliveryId}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(parsed));
        } catch {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        if (!this.isExplicitlyClosed) {
          // Attempt retry once after 3 seconds
          this.reconnectTimeout = window.setTimeout(() => {
            if (!this.isExplicitlyClosed) {
              this.connect();
            }
          }, 3000);
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

  disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}
