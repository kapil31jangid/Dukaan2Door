export type OrderStatus =
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  customer_id: number;
  store_id: number;
  status: OrderStatus;
  total_amount: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_partner_id?: number | null;
  delivery_id?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface OrderStatusHistoryItem {
  status: string;
  timestamp: string;
  note?: string | null;
}

export interface OrderStatusTracking {
  order_id: number;
  current_status: OrderStatus;
  updated_at: string;
  history: OrderStatusHistoryItem[];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'New Order',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  RECEIVED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  ACCEPTED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  PREPARING: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  READY_FOR_PICKUP: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  OUT_FOR_DELIVERY: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  DELIVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  CANCELLED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};
