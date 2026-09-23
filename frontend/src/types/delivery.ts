export type DeliveryStatus =
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Delivery {
  id: number;
  order_id: number;
  delivery_partner_id?: number | null;
  status: DeliveryStatus;
  pickup_address?: string | null;
  pickup_lat: number;
  pickup_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  assigned_at: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
}

export interface DeliveryAssignmentResponse {
  assigned: boolean;
  delivery?: Delivery | null;
  distance_km?: number | null;
  reason?: string | null;
}

export interface DeliveryTrackingPoint {
  id: number;
  delivery_id: number;
  latitude: number;
  longitude: number;
  status?: DeliveryStatus | null;
  recorded_at: string;
}

export interface DeliveryTrackingListResponse {
  updates: DeliveryTrackingPoint[];
}

export interface RouteGeometry {
  type: string;
  coordinates: [number, number][]; // [lng, lat] GeoJSON format
}

export interface RouteResponse {
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  distance_km: number;
  duration_minutes: number;
  geometry?: RouteGeometry | any;
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  ASSIGNED: 'Assigned',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, { bg: string; text: string; border: string }> = {
  ASSIGNED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  PICKED_UP: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  OUT_FOR_DELIVERY: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  DELIVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CANCELLED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};
