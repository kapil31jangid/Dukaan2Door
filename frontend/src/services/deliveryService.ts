import { apiRequest } from './api';
import { DeliveryPartnerProfile, DeliveryPartnerUpdate } from '../types/user';
import {
  Delivery,
  DeliveryStatus,
  DeliveryLocationSource,
  DeliveryTrackingListResponse,
  DeliveryTrackingPoint,
  RouteResponse,
} from '../types/delivery';
import { Order, OrderStatus } from '../types/order';

type TrackingPointWire = DeliveryTrackingPoint & {
  lat?: number;
  lng?: number;
};

function normalizeTrackingPoint(point: TrackingPointWire): DeliveryTrackingPoint {
  return {
    ...point,
    latitude: point.latitude ?? point.lat as number,
    longitude: point.longitude ?? point.lng as number,
  };
}

export const deliveryService = {
  async rejectDelivery(deliveryId: number): Promise<Delivery> {
    return apiRequest<Delivery>(`/api/deliveries/${deliveryId}/reject`, {
      method: 'POST', body: JSON.stringify({ reason: 'Declined by delivery partner' }),
    });
  },
  async getProfile(): Promise<DeliveryPartnerProfile> {
    return apiRequest<DeliveryPartnerProfile>('/api/delivery-partners/me');
  },

  async updateProfile(payload: DeliveryPartnerUpdate): Promise<DeliveryPartnerProfile> {
    return apiRequest<DeliveryPartnerProfile>('/api/delivery-partners/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getAssignedOrders(statusFilter?: OrderStatus): Promise<Order[]> {
    return apiRequest<Order[]>('/api/orders', {
      params: {
        status: statusFilter,
        page_size: 50,
      },
    });
  },

  async getAvailableOrders(): Promise<Order[]> {
    return apiRequest<Order[]>('/api/deliveries/available-orders');
  },

  async declineAvailableOrder(orderId: number, reason = 'Declined by delivery partner'): Promise<{ order_id: number; declined: boolean; available_to_other_riders: boolean }> {
    return apiRequest(`/api/deliveries/available-orders/${orderId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async claimAvailableOrder(orderId: number): Promise<{ assigned: boolean; delivery: Delivery; distance_km?: number }> {
    return apiRequest<{ assigned: boolean; delivery: Delivery; distance_km?: number }>(`/api/deliveries/available-orders/${orderId}/claim`, {
      method: 'POST',
    });
  },

  async getDelivery(deliveryId: number): Promise<Delivery> {
    return apiRequest<Delivery>(`/api/deliveries/${deliveryId}`);
  },

  async updateDeliveryStatus(deliveryId: number, status: DeliveryStatus): Promise<Delivery> {
    return apiRequest<Delivery>(`/api/deliveries/${deliveryId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async updateLocation(
    deliveryId: number,
    latitude: number,
    longitude: number,
    accuracy_m?: number,
    captured_at?: string,
    source: DeliveryLocationSource = 'GPS',
  ): Promise<DeliveryTrackingPoint> {
    const point = await apiRequest<TrackingPointWire>(`/api/deliveries/${deliveryId}/location`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy_m, captured_at, source }),
    });
    return normalizeTrackingPoint(point);
  },

  async getRoute(deliveryId: number, origin?: { lat: number; lng: number }, signal?: AbortSignal): Promise<RouteResponse> {
    return apiRequest<RouteResponse>(`/api/deliveries/${deliveryId}/route`, {
      params: origin ? { origin_lat: origin.lat, origin_lng: origin.lng } : undefined,
      signal,
    });
  },

  async getTracking(deliveryId: number): Promise<DeliveryTrackingListResponse> {
    const response = await apiRequest<{ updates: TrackingPointWire[] }>(`/api/deliveries/${deliveryId}/tracking`);
    return { updates: response.updates.map(normalizeTrackingPoint) };
  },
};
