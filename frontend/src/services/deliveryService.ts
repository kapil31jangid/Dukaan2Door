import { apiRequest } from './api';
import { DeliveryPartnerProfile, DeliveryPartnerUpdate } from '../types/user';
import {
  Delivery,
  DeliveryStatus,
  DeliveryTrackingListResponse,
  DeliveryTrackingPoint,
  RouteResponse,
} from '../types/delivery';
import { Order, OrderStatus } from '../types/order';

export const deliveryService = {
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
  ): Promise<DeliveryTrackingPoint> {
    return apiRequest<DeliveryTrackingPoint>(`/api/deliveries/${deliveryId}/location`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy_m }),
    });
  },

  async getRoute(deliveryId: number, origin?: { lat: number; lng: number }): Promise<RouteResponse> {
    return apiRequest<RouteResponse>(`/api/deliveries/${deliveryId}/route`, {
      params: origin ? { origin_lat: origin.lat, origin_lng: origin.lng } : undefined,
    });
  },

  async getTracking(deliveryId: number): Promise<DeliveryTrackingListResponse> {
    return apiRequest<DeliveryTrackingListResponse>(`/api/deliveries/${deliveryId}/tracking`);
  },
};
