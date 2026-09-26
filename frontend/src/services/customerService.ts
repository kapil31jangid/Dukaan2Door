import { apiRequest } from './api';
import { CustomerProfile, CustomerUpdate } from '../types/user';
import { Product, PaginatedProductResponse } from '../types/product';
import { Order, OrderStatus, OrderStatusTracking } from '../types/order';
import { Delivery, DeliveryTrackingListResponse, RouteResponse } from '../types/delivery';

// ─── Customer Profile ─────────────────────────────────────────────────────────

export const customerService = {
  async getProfile(): Promise<CustomerProfile> {
    return apiRequest<CustomerProfile>('/api/customers/me');
  },

  async updateProfile(payload: CustomerUpdate): Promise<CustomerProfile> {
    return apiRequest<CustomerProfile>('/api/customers/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ─── Products ───────────────────────────────────────────────────────────────

  async listProducts(params?: {
    category?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedProductResponse> {
    return apiRequest<PaginatedProductResponse>('/api/products', { params });
  },

  async searchProducts(params: {
    q: string;
    category?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedProductResponse> {
    return apiRequest<PaginatedProductResponse>('/api/products/search', { params });
  },

  async getProduct(id: number): Promise<Product> {
    return apiRequest<Product>(`/api/products/${id}`);
  },

  // ─── Orders ─────────────────────────────────────────────────────────────────

  async placeOrder(payload: {
    items: { product_id: number; quantity: number }[];
    delivery_address?: string;
    delivery_lat?: number;
    delivery_lng?: number;
    notes?: string;
  }): Promise<Order> {
    return apiRequest<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getOrders(params?: {
    status?: OrderStatus;
    page?: number;
    page_size?: number;
  }): Promise<Order[]> {
    return apiRequest<Order[]>('/api/orders', { params });
  },

  async getOrder(id: number): Promise<Order> {
    return apiRequest<Order>(`/api/orders/${id}`);
  },

  async getOrderStatus(id: number): Promise<OrderStatusTracking> {
    return apiRequest<OrderStatusTracking>(`/api/orders/${id}/status`);
  },

  async cancelOrder(id: number): Promise<Order> {
    return apiRequest<Order>(`/api/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
  },

  // ─── Deliveries ─────────────────────────────────────────────────────────────

  async getDelivery(deliveryId: number): Promise<Delivery> {
    return apiRequest<Delivery>(`/api/deliveries/${deliveryId}`);
  },

  async getDeliveryRoute(deliveryId: number): Promise<RouteResponse> {
    return apiRequest<RouteResponse>(`/api/deliveries/${deliveryId}/route`);
  },

  async getDeliveryTracking(deliveryId: number): Promise<DeliveryTrackingListResponse> {
    return apiRequest<DeliveryTrackingListResponse>(`/api/deliveries/${deliveryId}/tracking`);
  },
};
