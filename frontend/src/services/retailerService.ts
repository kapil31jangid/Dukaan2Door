import { apiRequest, uploadFile } from './api';
import { RetailerProfile, RetailerUpdate, StoreProfile, StoreUpdate } from '../types/user';
import { Product, ProductAvailabilityPatch, ProductCreate, ProductUpdate } from '../types/product';
import { Order, OrderStatus } from '../types/order';
import { DeliveryAssignmentResponse } from '../types/delivery';

export const retailerService = {
  async getProfile(): Promise<RetailerProfile> {
    return apiRequest<RetailerProfile>('/api/retailers/me');
  },

  async updateProfile(payload: RetailerUpdate): Promise<RetailerProfile> {
    return apiRequest<RetailerProfile>('/api/retailers/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getStore(): Promise<StoreProfile> {
    return apiRequest<StoreProfile>('/api/retailers/me/store');
  },

  async updateStore(payload: StoreUpdate): Promise<StoreProfile> {
    return apiRequest<StoreProfile>('/api/retailers/me/store', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getProducts(): Promise<Product[]> {
    return apiRequest<Product[]>('/api/retailers/me/products');
  },

  async createProduct(payload: ProductCreate): Promise<Product> {
    return apiRequest<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(id: number, payload: ProductUpdate): Promise<Product> {
    return apiRequest<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteProduct(id: number): Promise<void> {
    return apiRequest<void>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  },

  async patchProductAvailability(id: number, payload: ProductAvailabilityPatch): Promise<Product> {
    return apiRequest<Product>(`/api/products/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getOrders(statusFilter?: OrderStatus, page = 1, pageSize = 50): Promise<Order[]> {
    return apiRequest<Order[]>('/api/orders', {
      params: {
        status: statusFilter,
        page,
        page_size: pageSize,
      },
    });
  },

  async getOrder(orderId: number): Promise<Order> {
    return apiRequest<Order>(`/api/orders/${orderId}`);
  },

  async updateOrderStatus(orderId: number, targetStatus: OrderStatus): Promise<Order> {
    return apiRequest<Order>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: targetStatus }),
    });
  },

  async getAvailablePartners(orderId: number): Promise<Array<{ id: number; name: string; phone: string; vehicle_info: string; distance_km: number; is_available: boolean }>> {
    return apiRequest<Array<{ id: number; name: string; phone: string; vehicle_info: string; distance_km: number; is_available: boolean }>>(`/api/deliveries/${orderId}/available-partners`);
  },

  async assignDelivery(orderId: number, partnerId?: number): Promise<DeliveryAssignmentResponse> {
    const url = partnerId ? `/api/deliveries/${orderId}/assign?partner_id=${partnerId}` : `/api/deliveries/${orderId}/assign`;
    return apiRequest<DeliveryAssignmentResponse>(url, {
      method: 'POST',
    });
  },

  async uploadProductImage(file: File): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append('file', file);
    return uploadFile<{ url: string; filename: string }>('/api/uploads/product-image', form);
  },
};
