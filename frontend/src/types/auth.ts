export type UserRole = 'customer' | 'retailer' | 'delivery_partner';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
}

export interface UserMeResponse {
  user_id: number;
  email: string;
  role: UserRole;
  name?: string | null;
  phone?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: 'customer';
  name: string;
  phone?: string;
  delivery_address?: string;
  lat?: number;
  lng?: number;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: 'customer';
  name: string;
  phone?: string;
  delivery_address?: string;
  lat?: number;
  lng?: number;
}
