export interface CustomerProfile {
  id: number;
  user_id: number;
  name: string;
  phone?: string | null;
  delivery_address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface RetailerProfile {
  id: number;
  user_id: number;
  name: string;
  phone?: string | null;
}

export interface RetailerUpdate {
  name?: string;
  phone?: string;
}

export interface StoreProfile {
  id: number;
  retailer_id: number;
  store_name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  operating_hours?: string | null;
  is_open: boolean;
}

export interface StoreUpdate {
  store_name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  operating_hours?: string;
  is_open?: boolean;
}

export interface DeliveryPartnerProfile {
  id: number;
  user_id: number;
  name: string;
  phone?: string | null;
  vehicle_info?: string | null;
  is_available: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
}

export interface DeliveryPartnerUpdate {
  name?: string;
  phone?: string;
  vehicle_info?: string;
  is_available?: boolean;
  current_lat?: number;
  current_lng?: number;
}
